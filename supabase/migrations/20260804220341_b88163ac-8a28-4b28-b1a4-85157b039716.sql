ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS price_single_pence integer NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS price_five_pence integer NOT NULL DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS price_gallery_pence integer NOT NULL DEFAULT 5000;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS refunded_pence integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

CREATE INDEX IF NOT EXISTS idx_orders_payment_intent ON public.orders(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON public.orders(status, created_at);

CREATE OR REPLACE FUNCTION public.validate_event_prices()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.price_single_pence < 100 OR NEW.price_single_pence > 100000
     OR NEW.price_five_pence < 100 OR NEW.price_five_pence > 500000
     OR NEW.price_gallery_pence < 100 OR NEW.price_gallery_pence > 1000000 THEN
    RAISE EXCEPTION 'Prices must be between £1 and a sensible maximum';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_event_prices() FROM PUBLIC;

DROP TRIGGER IF EXISTS validate_event_prices_trigger ON public.events;
CREATE TRIGGER validate_event_prices_trigger
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.validate_event_prices();