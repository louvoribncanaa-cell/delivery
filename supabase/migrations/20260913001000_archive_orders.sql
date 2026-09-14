ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_orders_archived ON public.orders(archived);

NOTIFY pgrst, 'reload schema';
