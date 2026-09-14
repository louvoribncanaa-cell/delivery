-- Permitir que qualquer pessoa insira pedidos pelo cardápio digital
-- Isso é necessário para o cardápio público funcionar sem login

CREATE POLICY "Anyone can insert orders via digital menu"
  ON orders FOR INSERT
  WITH CHECK (true);

-- Permitir que qualquer pessoa insira itens de pedido
CREATE POLICY "Anyone can insert order items via digital menu"
  ON order_items FOR INSERT
  WITH CHECK (true);
