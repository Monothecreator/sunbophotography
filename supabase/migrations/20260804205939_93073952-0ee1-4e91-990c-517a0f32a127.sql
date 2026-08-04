ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS receipt_email text,
  ADD COLUMN IF NOT EXISTS receipt_sent_at timestamptz;