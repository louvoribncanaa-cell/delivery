-- Permite que o atendente veja os itens dos pedidos que ele mesmo criou.
-- (A tabela orders já é legível, mas order_items só tinha policy para cozinha/caixa/admin.)
DROP POLICY IF EXISTS "Attendant can view own order items" ON public.order_items;
CREATE POLICY "Attendant can view own order items"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
        AND orders.created_by = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
