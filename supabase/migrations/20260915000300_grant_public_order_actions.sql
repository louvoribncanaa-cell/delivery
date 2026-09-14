-- Permissões necessárias para o cardápio público criar itens e cancelar pedidos pendentes.
GRANT INSERT, UPDATE ON public.orders TO anon;
GRANT INSERT ON public.order_items TO anon;
