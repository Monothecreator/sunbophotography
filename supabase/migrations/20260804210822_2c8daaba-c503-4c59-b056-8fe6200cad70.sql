ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS public_token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(24), 'hex');

CREATE UNIQUE INDEX IF NOT EXISTS events_public_token_key ON public.events (public_token);

ALTER TABLE public.orders ALTER COLUMN person_id DROP NOT NULL;