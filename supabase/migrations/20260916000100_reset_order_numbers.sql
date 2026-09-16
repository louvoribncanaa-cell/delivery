-- Permite ao administrador reiniciar a numeração sem apagar pedidos ou histórico.
CREATE OR REPLACE FUNCTION public.reset_order_number_sequence()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND 'admin' = ANY(COALESCE(roles, ARRAY[role::text]))
  ) THEN
    RAISE EXCEPTION 'Apenas administradores podem reiniciar a numeração';
  END IF;

  PERFORM setval('public.orders_order_number_seq', 1, false);
END;
$$;

REVOKE ALL ON FUNCTION public.reset_order_number_sequence() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_order_number_sequence() TO authenticated;
