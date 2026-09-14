-- Função para a cozinha cancelar pedido em QUALQUER status.
-- Diferente da cancel_order (que é para cliente/atendente e só aceita pendente).
CREATE OR REPLACE FUNCTION public.kitchen_cancel_order(p_order_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_record RECORD;
BEGIN
  SELECT id, status, archived INTO v_order_record
  FROM orders
  WHERE id = p_order_id;

  IF v_order_record IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Pedido não encontrado.');
  END IF;

  IF v_order_record.archived = true THEN
    RETURN json_build_object('success', false, 'error', 'Este pedido já foi arquivado.');
  END IF;

  UPDATE orders
  SET status = 'cancelado', archived = true
  WHERE id = p_order_id;

  RETURN json_build_object('success', true, 'message', 'Pedido cancelado pela cozinha.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.kitchen_cancel_order(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.kitchen_cancel_order(UUID) TO authenticated;
