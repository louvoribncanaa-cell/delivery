-- O cardapio publico precisa ler o pedido criado para acompanhar seu status.
CREATE POLICY "Anyone can view orders from digital menu"
  ON orders FOR SELECT
  USING (true);
