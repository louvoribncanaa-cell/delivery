GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.profiles, public.categories, public.products TO anon, authenticated;
GRANT SELECT, INSERT ON public.orders, public.order_items TO authenticated;
GRANT UPDATE ON public.orders TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

NOTIFY pgrst, 'reload schema';
