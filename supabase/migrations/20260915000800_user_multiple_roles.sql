-- Múltiplas funções por usuário: o admin pode delegar quantas funções quiser.
-- A coluna legada "role" (cargo principal) é mantida e sincronizada via trigger.

-- 1) Nova coluna com todas as funções do usuário
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS roles TEXT[] NOT NULL DEFAULT ARRAY['cliente']::TEXT[];

-- Backfill: quem já existe ganha roles = [role atual]
UPDATE public.profiles
SET roles = ARRAY[role::text]
WHERE roles IS NULL OR roles = ARRAY['cliente']::TEXT[] OR cardinality(roles) = 0;

-- 2) Trigger: mantém "role" (principal) sincronizado com roles[1]
-- e normaliza valores inválidos/vazios.
CREATE OR REPLACE FUNCTION public.sync_profile_roles()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  valid_roles TEXT[] := ARRAY['admin', 'caixa', 'cozinha', 'atendente', 'cliente'];
  cleaned TEXT[];
BEGIN
  -- No cadastro (ex.: trigger de boas-vindas com role no metadata),
  -- garante que o cargo principal entre na lista
  IF TG_OP = 'INSERT' AND NOT (NEW.role::text = ANY(COALESCE(NEW.roles, ARRAY[]::TEXT[]))) THEN
    NEW.roles := ARRAY[NEW.role::text] || COALESCE(NEW.roles, ARRAY[]::TEXT[]);
  END IF;

  -- Se roles veio vazio, herda do cargo principal
  IF NEW.roles IS NULL OR cardinality(NEW.roles) = 0 THEN
    NEW.roles := ARRAY[NEW.role::text];
  END IF;

  SELECT COALESCE(ARRAY_AGG(r ORDER BY array_position(valid_roles, r)), ARRAY[]::TEXT[])
  INTO cleaned
  FROM (SELECT DISTINCT r FROM unnest(NEW.roles) AS r WHERE r = ANY(valid_roles)) AS s(r);

  IF cleaned IS NULL OR cardinality(cleaned) = 0 THEN
    cleaned := ARRAY[NEW.role::text];
  END IF;

  NEW.roles := cleaned;
  NEW.role := cleaned[1]::public.user_role;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_roles ON public.profiles;
CREATE TRIGGER trg_sync_profile_roles
  BEFORE INSERT OR UPDATE OF role, roles ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_roles();

-- 3) Helpers RLS multi-função (mesmo padrão anti-recursão do current_user_role)
CREATE OR REPLACE FUNCTION public.current_user_roles()
RETURNS TEXT[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(roles, ARRAY[role::text]) FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(required TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_user_roles(), ARRAY[]::TEXT[]) && required;
$$;

REVOKE ALL ON FUNCTION public.current_user_roles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_roles() TO authenticated, anon;
REVOKE ALL ON FUNCTION public.has_any_role(TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_any_role(TEXT[]) TO authenticated, anon;

-- 4) Policies de profiles (admin)
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin can insert profiles" ON public.profiles;

CREATE POLICY "Admin can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_any_role(ARRAY['admin']));

CREATE POLICY "Admin can update any profile"
  ON public.profiles FOR UPDATE
  USING (public.has_any_role(ARRAY['admin']))
  WITH CHECK (public.has_any_role(ARRAY['admin']));

CREATE POLICY "Admin can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (public.has_any_role(ARRAY['admin']));

-- 5) Categorias e produtos (admin)
DROP POLICY IF EXISTS "Admin can manage categories" ON public.categories;
CREATE POLICY "Admin can manage categories"
  ON public.categories FOR ALL
  USING (public.has_any_role(ARRAY['admin']))
  WITH CHECK (public.has_any_role(ARRAY['admin']));

DROP POLICY IF EXISTS "Admin can manage products" ON public.products;
CREATE POLICY "Admin can manage products"
  ON public.products FOR ALL
  USING (public.has_any_role(ARRAY['admin']))
  WITH CHECK (public.has_any_role(ARRAY['admin']));

-- 6) Pedidos
DROP POLICY IF EXISTS "Attendant and customer can insert orders" ON public.orders;
CREATE POLICY "Attendant and customer can insert orders"
  ON public.orders FOR INSERT
  WITH CHECK (public.has_any_role(ARRAY['atendente', 'cliente', 'admin']));

DROP POLICY IF EXISTS "Kitchen can view and update order status" ON public.orders;
DROP POLICY IF EXISTS "Kitchen can update order status" ON public.orders;
DROP POLICY IF EXISTS "Cashier can view orders" ON public.orders;
DROP POLICY IF EXISTS "Cashier can update orders" ON public.orders;
DROP POLICY IF EXISTS "Attendant can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Admin can view all orders" ON public.orders;

CREATE POLICY "Kitchen can view and update order status"
  ON public.orders FOR SELECT
  USING (public.has_any_role(ARRAY['cozinha', 'admin']));

CREATE POLICY "Kitchen can update order status"
  ON public.orders FOR UPDATE
  USING (public.has_any_role(ARRAY['cozinha', 'admin']))
  WITH CHECK (public.has_any_role(ARRAY['cozinha', 'admin']));

CREATE POLICY "Cashier can view orders"
  ON public.orders FOR SELECT
  USING (public.has_any_role(ARRAY['caixa', 'admin']));

CREATE POLICY "Cashier can update orders"
  ON public.orders FOR UPDATE
  USING (public.has_any_role(ARRAY['caixa', 'admin']))
  WITH CHECK (public.has_any_role(ARRAY['caixa', 'admin']));

CREATE POLICY "Attendant can view own orders"
  ON public.orders FOR SELECT
  USING (public.has_any_role(ARRAY['atendente', 'admin']));

CREATE POLICY "Admin can view all orders"
  ON public.orders FOR SELECT
  USING (public.has_any_role(ARRAY['admin']));

-- 7) Itens do pedido
DROP POLICY IF EXISTS "Can insert order items" ON public.order_items;
CREATE POLICY "Can insert order items"
  ON public.order_items FOR INSERT
  WITH CHECK (public.has_any_role(ARRAY['atendente', 'cliente', 'admin']));

DROP POLICY IF EXISTS "Kitchen and cashier can view order items" ON public.order_items;
CREATE POLICY "Kitchen and cashier can view order items"
  ON public.order_items FOR SELECT
  USING (public.has_any_role(ARRAY['cozinha', 'caixa', 'admin']));

DROP POLICY IF EXISTS "Admin can manage order items" ON public.order_items;
CREATE POLICY "Admin can manage order items"
  ON public.order_items FOR ALL
  USING (public.has_any_role(ARRAY['admin']))
  WITH CHECK (public.has_any_role(ARRAY['admin']));

-- 8) Caixa (insert/update; o SELECT já é público)
DROP POLICY IF EXISTS "Admin and cashier can insert cash register" ON cash_register;
CREATE POLICY "Admin and cashier can insert cash register"
  ON cash_register FOR INSERT
  WITH CHECK (public.has_any_role(ARRAY['admin', 'caixa']));

DROP POLICY IF EXISTS "Admin and cashier can update cash register" ON cash_register;
CREATE POLICY "Admin and cashier can update cash register"
  ON cash_register FOR UPDATE
  USING (public.has_any_role(ARRAY['admin', 'caixa']))
  WITH CHECK (public.has_any_role(ARRAY['admin', 'caixa']));

NOTIFY pgrst, 'reload schema';
