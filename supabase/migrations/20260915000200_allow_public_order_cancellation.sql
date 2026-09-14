-- O cliente pode cancelar um pedido enquanto ele ainda estiver pendente.
GRANT INSERT, UPDATE ON public.orders TO anon;
GRANT INSERT ON public.order_items TO anon;

CREATE POLICY "Anyone can cancel pending orders"
  ON orders FOR UPDATE
  USING (status = 'pendente' AND archived = false)
  WITH CHECK (status = 'cancelado' AND archived = true);
