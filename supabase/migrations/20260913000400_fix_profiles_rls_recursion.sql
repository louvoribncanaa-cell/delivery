-- Evita recursão infinita nas policies que consultam profiles.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin can insert profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admin can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.current_user_role() = 'admin');

CREATE POLICY "Admin can update any profile"
  ON public.profiles FOR UPDATE
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "Admin can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "Admin can manage categories" ON public.categories;
CREATE POLICY "Admin can manage categories"
  ON public.categories FOR ALL
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "Admin can manage products" ON public.products;
CREATE POLICY "Admin can manage products"
  ON public.products FOR ALL
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "Kitchen can view and update order status" ON public.orders;
DROP POLICY IF EXISTS "Kitchen can update order status" ON public.orders;
DROP POLICY IF EXISTS "Cashier can view orders" ON public.orders;
DROP POLICY IF EXISTS "Cashier can update orders" ON public.orders;
DROP POLICY IF EXISTS "Attendant can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Admin can view all orders" ON public.orders;

CREATE POLICY "Kitchen can view and update order status"
  ON public.orders FOR SELECT
  USING (public.current_user_role() IN ('cozinha', 'admin'));

CREATE POLICY "Kitchen can update order status"
  ON public.orders FOR UPDATE
  USING (public.current_user_role() IN ('cozinha', 'admin'))
  WITH CHECK (public.current_user_role() IN ('cozinha', 'admin'));

CREATE POLICY "Cashier can view orders"
  ON public.orders FOR SELECT
  USING (public.current_user_role() IN ('caixa', 'admin'));

CREATE POLICY "Cashier can update orders"
  ON public.orders FOR UPDATE
  USING (public.current_user_role() IN ('caixa', 'admin'))
  WITH CHECK (public.current_user_role() IN ('caixa', 'admin'));

CREATE POLICY "Attendant can view own orders"
  ON public.orders FOR SELECT
  USING (public.current_user_role() IN ('atendente', 'admin'));

CREATE POLICY "Admin can view all orders"
  ON public.orders FOR SELECT
  USING (public.current_user_role() = 'admin');
