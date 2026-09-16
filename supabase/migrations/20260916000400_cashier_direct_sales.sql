-- Cashier-only direct sales bypass the kitchen queue.
CREATE POLICY "Cashier can insert direct sales" ON public.orders
  FOR INSERT WITH CHECK (
    public.has_any_role(ARRAY['caixa', 'admin'])
    AND status = 'entregue'
  );

CREATE POLICY "Cashier can insert direct sale items" ON public.order_items
  FOR INSERT WITH CHECK (
    public.has_any_role(ARRAY['caixa', 'admin'])
  );
