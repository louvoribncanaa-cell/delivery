-- Drivers need the item summary shown in the delivery detail sheet.
CREATE POLICY "Driver can view order items" ON public.order_items
  FOR SELECT USING (public.has_any_role(ARRAY['entregador', 'admin']));
