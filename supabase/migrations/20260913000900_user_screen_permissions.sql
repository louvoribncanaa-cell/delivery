ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS allowed_screens TEXT[] NOT NULL DEFAULT ARRAY['menu']::TEXT[];

UPDATE public.profiles
SET allowed_screens = CASE role::text
  WHEN 'admin' THEN ARRAY['admin', 'orders', 'kitchen', 'cashier', 'menu']::TEXT[]
  WHEN 'atendente' THEN ARRAY['orders', 'menu']::TEXT[]
  WHEN 'cozinha' THEN ARRAY['kitchen']::TEXT[]
  WHEN 'caixa' THEN ARRAY['cashier']::TEXT[]
  ELSE ARRAY['menu']::TEXT[]
END
WHERE allowed_screens = ARRAY['menu']::TEXT[] OR allowed_screens IS NULL;
