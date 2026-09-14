-- Garante que o usuário administrativo tenha acesso ao painel.
INSERT INTO public.profiles (id, name, role)
SELECT id, 'Jak', 'admin'::public.user_role
FROM auth.users
WHERE lower(email) = 'jakbitencourtcachos@gmail.com'
ON CONFLICT (id) DO UPDATE
SET name = 'Jak', role = 'admin'::public.user_role;

-- Produtos iniciais para o cardápio demonstrativo.
INSERT INTO public.products (category_id, name, description, price, available)
SELECT c.id, seed.name, seed.description, seed.price, true
FROM (VALUES
  ('Lanches', 'X-Burger Clássico', 'Hambúrguer, queijo, alface, tomate e molho especial.', 24.90::DECIMAL),
  ('Lanches', 'X-Bacon Artesanal', 'Hambúrguer artesanal, bacon crocante e queijo cheddar.', 32.90::DECIMAL),
  ('Bebidas', 'Refrigerante Lata', 'Lata de 350ml.', 6.00::DECIMAL),
  ('Bebidas', 'Suco Natural', 'Suco natural da fruta, 400ml.', 9.90::DECIMAL),
  ('Sobremesas', 'Brownie com Sorvete', 'Brownie de chocolate com uma bola de sorvete.', 16.90::DECIMAL)
) AS seed(category_name, name, description, price)
JOIN public.categories c ON c.name = seed.category_name
WHERE NOT EXISTS (
  SELECT 1 FROM public.products p WHERE p.name = seed.name
);
