-- 1. Roles enum
CREATE TYPE public.studio_role AS ENUM ('owner', 'member');

-- 2. Studios
CREATE TABLE public.studios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  logo_url text,
  contact_email text,
  website text,
  slug text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(6), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studios TO authenticated;
GRANT ALL ON public.studios TO service_role;
ALTER TABLE public.studios ENABLE ROW LEVEL SECURITY;

-- 3. Memberships
CREATE TABLE public.studio_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.studio_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (studio_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_members TO authenticated;
GRANT ALL ON public.studio_members TO service_role;
ALTER TABLE public.studio_members ENABLE ROW LEVEL SECURITY;

-- 4. Invitations
CREATE TABLE public.studio_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.studio_role NOT NULL DEFAULT 'member',
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_invitations TO authenticated;
GRANT ALL ON public.studio_invitations TO service_role;
ALTER TABLE public.studio_invitations ENABLE ROW LEVEL SECURITY;

-- 5. Security definer helpers (avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.is_studio_member(_studio_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.studio_members m
    WHERE m.studio_id = _studio_id AND m.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_studio_owner(_studio_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.studio_members m
    WHERE m.studio_id = _studio_id AND m.user_id = _user_id AND m.role = 'owner'
  );
$$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER studios_touch_updated_at BEFORE UPDATE ON public.studios
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 6. Studio columns on existing tables
ALTER TABLE public.events ADD COLUMN studio_id uuid REFERENCES public.studios(id) ON DELETE CASCADE;
ALTER TABLE public.payouts ADD COLUMN studio_id uuid REFERENCES public.studios(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.event_studio_id(_event_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.studio_id FROM public.events e WHERE e.id = _event_id;
$$;

-- 7. Backfill: one studio per existing photographer
INSERT INTO public.studios (owner_id, name, contact_email)
SELECT p.id,
       COALESCE(NULLIF(p.business_name, ''), NULLIF(p.name, ''), 'My Studio'),
       p.email
FROM public.profiles p;

INSERT INTO public.studios (owner_id, name)
SELECT DISTINCT e.photographer_id, 'My Studio'
FROM public.events e
WHERE NOT EXISTS (SELECT 1 FROM public.studios s WHERE s.owner_id = e.photographer_id);

INSERT INTO public.studio_members (studio_id, user_id, role)
SELECT s.id, s.owner_id, 'owner' FROM public.studios s
ON CONFLICT (studio_id, user_id) DO NOTHING;

UPDATE public.events e
SET studio_id = s.id
FROM public.studios s
WHERE s.owner_id = e.photographer_id AND e.studio_id IS NULL;

UPDATE public.payouts pay
SET studio_id = s.id
FROM public.studios s
WHERE s.owner_id = pay.user_id AND pay.studio_id IS NULL;

ALTER TABLE public.events ALTER COLUMN studio_id SET NOT NULL;

CREATE INDEX idx_events_studio_id ON public.events(studio_id);
CREATE INDEX idx_payouts_studio_id ON public.payouts(studio_id);
CREATE INDEX idx_studio_members_user_id ON public.studio_members(user_id);

-- 8. New signups get their own studio
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_studio_id uuid;
BEGIN
  INSERT INTO public.profiles (id, email, name, business_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'business_name')
  ON CONFLICT (id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.studio_members m WHERE m.user_id = NEW.id) THEN
    INSERT INTO public.studios (owner_id, name, contact_email)
    VALUES (
      NEW.id,
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'business_name', ''), NULLIF(NEW.raw_user_meta_data->>'name', ''), 'My Studio'),
      NEW.email
    )
    RETURNING id INTO new_studio_id;

    INSERT INTO public.studio_members (studio_id, user_id, role)
    VALUES (new_studio_id, NEW.id, 'owner')
    ON CONFLICT (studio_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- 9. Policies for the new tables
CREATE POLICY "members read studio" ON public.studios FOR SELECT TO authenticated
  USING (public.is_studio_member(id, auth.uid()));
CREATE POLICY "owner updates studio" ON public.studios FOR UPDATE TO authenticated
  USING (public.is_studio_owner(id, auth.uid()))
  WITH CHECK (public.is_studio_owner(id, auth.uid()));

CREATE POLICY "members read team" ON public.studio_members FOR SELECT TO authenticated
  USING (public.is_studio_member(studio_id, auth.uid()));
CREATE POLICY "owner manages team" ON public.studio_members FOR DELETE TO authenticated
  USING (public.is_studio_owner(studio_id, auth.uid()) AND user_id <> auth.uid());
CREATE POLICY "owner updates team" ON public.studio_members FOR UPDATE TO authenticated
  USING (public.is_studio_owner(studio_id, auth.uid()))
  WITH CHECK (public.is_studio_owner(studio_id, auth.uid()));

CREATE POLICY "owner reads invitations" ON public.studio_invitations FOR SELECT TO authenticated
  USING (public.is_studio_owner(studio_id, auth.uid()));
CREATE POLICY "owner creates invitations" ON public.studio_invitations FOR INSERT TO authenticated
  WITH CHECK (public.is_studio_owner(studio_id, auth.uid()) AND invited_by = auth.uid());
CREATE POLICY "owner revokes invitations" ON public.studio_invitations FOR DELETE TO authenticated
  USING (public.is_studio_owner(studio_id, auth.uid()));

-- 10. Rewrite existing policies to studio scope
DROP POLICY IF EXISTS "own events" ON public.events;
CREATE POLICY "studio events" ON public.events FOR ALL TO authenticated
  USING (public.is_studio_member(studio_id, auth.uid()))
  WITH CHECK (public.is_studio_member(studio_id, auth.uid()));

DROP POLICY IF EXISTS "own people" ON public.people;
CREATE POLICY "studio people" ON public.people FOR ALL TO authenticated
  USING (public.is_studio_member(public.event_studio_id(event_id), auth.uid()))
  WITH CHECK (public.is_studio_member(public.event_studio_id(event_id), auth.uid()));

DROP POLICY IF EXISTS "own photos" ON public.photos;
CREATE POLICY "studio photos" ON public.photos FOR ALL TO authenticated
  USING (public.is_studio_member(public.event_studio_id(event_id), auth.uid()))
  WITH CHECK (public.is_studio_member(public.event_studio_id(event_id), auth.uid()));

DROP POLICY IF EXISTS "own views" ON public.gallery_views;
CREATE POLICY "studio views" ON public.gallery_views FOR SELECT TO authenticated
  USING (public.is_studio_member(public.event_studio_id(event_id), auth.uid()));

DROP POLICY IF EXISTS "own orders" ON public.orders;
CREATE POLICY "studio owner orders" ON public.orders FOR SELECT TO authenticated
  USING (public.is_studio_owner(public.event_studio_id(event_id), auth.uid()));

DROP POLICY IF EXISTS "Photographers can view their own payouts" ON public.payouts;
CREATE POLICY "studio owner payouts" ON public.payouts FOR SELECT TO authenticated
  USING (studio_id IS NOT NULL AND public.is_studio_owner(studio_id, auth.uid()));