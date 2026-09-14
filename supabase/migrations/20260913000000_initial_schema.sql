-- =============================================
-- SUPABASE SQL SCHEMA - SISTEMA DE DELIVERY
-- =============================================

-- =============================================
-- ENUM TYPES
-- =============================================

CREATE TYPE user_role AS ENUM ('admin', 'caixa', 'cozinha', 'atendente', 'cliente');
CREATE TYPE order_status AS ENUM ('pendente', 'em_preparo', 'pronto', 'entregue', 'cancelado');
CREATE TYPE payment_status AS ENUM ('pendente', 'pago');
CREATE TYPE payment_method AS ENUM ('pix', 'cartao_credito', 'cartao_debito', 'dinheiro');

-- =============================================
-- TABLES
-- =============================================

-- Profiles (ligado ao auth.users do Supabase)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'cliente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon_svg TEXT DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true
);

-- Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price DECIMAL(10,2) NOT NULL,
  image_url TEXT DEFAULT '',
  available BOOLEAN NOT NULL DEFAULT true
);

-- Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number SERIAL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT DEFAULT '',
  table_or_address TEXT DEFAULT '',
  status order_status NOT NULL DEFAULT 'pendente',
  payment_status payment_status NOT NULL DEFAULT 'pendente',
  payment_method payment_method NOT NULL DEFAULT 'pix',
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Order Items
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  notes TEXT DEFAULT ''
);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- =============================================
-- POLICIES - PROFILES
-- =============================================

-- Todos podem ver seu próprio perfil
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Admin pode ver todos os perfis
CREATE POLICY "Admin can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admin pode atualizar qualquer perfil
CREATE POLICY "Admin can update any profile"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admin pode inserir perfis
CREATE POLICY "Admin can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================
-- POLICIES - CATEGORIES
-- =============================================

-- Todos autenticados podem ver categorias ativas
CREATE POLICY "Authenticated users can view active categories"
  ON categories FOR SELECT
  USING (active = true OR auth.uid() IS NOT NULL);

-- Apenas admin pode gerenciar categorias
CREATE POLICY "Admin can manage categories"
  ON categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================
-- POLICIES - PRODUCTS
-- =============================================

-- Todos podem ver produtos disponíveis
CREATE POLICY "Anyone can view available products"
  ON products FOR SELECT
  USING (available = true OR auth.uid() IS NOT NULL);

-- Apenas admin pode gerenciar produtos
CREATE POLICY "Admin can manage products"
  ON products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================
-- POLICIES - ORDERS
-- =============================================

-- Atendente e cliente podem inserir pedidos
CREATE POLICY "Attendant and customer can insert orders"
  ON orders FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() 
      AND role IN ('atendente', 'cliente', 'admin')
    )
  );

-- Cozinha pode ver pedidos e atualizar status
CREATE POLICY "Kitchen can view and update order status"
  ON orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() 
      AND role IN ('cozinha', 'admin')
    )
  );

CREATE POLICY "Kitchen can update order status"
  ON orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() 
      AND role IN ('cozinha', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() 
      AND role IN ('cozinha', 'admin')
    )
  );

-- Caixa pode ver e atualizar pedidos (pagamento e status)
CREATE POLICY "Cashier can view orders"
  ON orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() 
      AND role IN ('caixa', 'admin')
    )
  );

CREATE POLICY "Cashier can update orders"
  ON orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() 
      AND role IN ('caixa', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() 
      AND role IN ('caixa', 'admin')
    )
  );

-- Atendente pode ver seus próprios pedidos
CREATE POLICY "Attendant can view own orders"
  ON orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() 
      AND role IN ('atendente', 'admin')
    )
  );

-- Admin pode ver todos os pedidos
CREATE POLICY "Admin can view all orders"
  ON orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================
-- POLICIES - ORDER ITEMS
-- =============================================

-- Quem pode inserir itens de pedido
CREATE POLICY "Can insert order items"
  ON order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() 
      AND role IN ('atendente', 'cliente', 'admin')
    )
  );

-- Cozinha e caixa podem ver itens
CREATE POLICY "Kitchen and cashier can view order items"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() 
      AND role IN ('cozinha', 'caixa', 'admin')
    )
  );

-- Admin pode gerenciar itens
CREATE POLICY "Admin can manage order items"
  ON order_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================
-- REALTIME - Habilitar para tabela orders
-- =============================================

ALTER PUBLICATION supabase_realtime ADD TABLE orders;

-- =============================================
-- TRIGGER - Auto-criar perfil ao registrar usuário
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'cliente')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- DADOS INICIAIS (SEED)
-- =============================================

-- Categorias de exemplo
INSERT INTO categories (name, icon_svg, active) VALUES
  ('Lanches', '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2"/><path d="m7 10 3-3 3 3"/></svg>', true),
  ('Bebidas', '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" x2="6" y1="2" y2="4"/><line x1="10" x2="10" y1="2" y2="4"/><line x1="14" x2="14" y1="2" y2="4"/></svg>', true),
  ('Pizzas', '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2"/><circle cx="12" cy="12" r="2"/></svg>', true),
  ('Sobremesas', '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 18h20"/><path d="M12 2v8"/><path d="m4.93 10.93 1.41 1.41"/><path d="m17.66 12.34 1.41-1.41"/><path d="M2 10h20"/><circle cx="12" cy="6" r="4"/></svg>', true),
  ('Acompanhamentos', '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>', true);
