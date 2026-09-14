-- Função server-side para cancelar pedido com validação de status.
-- Retorna JSON com sucesso/erro para o frontend tratar.
CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_status TEXT;
  v_order_record RECORD;
BEGIN
  -- Busca o pedido atual
  SELECT id, status, archived INTO v_order_record
  FROM orders
  WHERE id = p_order_id;

  -- Verifica se o pedido existe
  IF v_order_record IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Pedido não encontrado.'
    );
  END IF;

  v_current_status := v_order_record.status;

  -- Se já está cancelado ou arquivado, retorna erro
  IF v_current_status = 'cancelado' OR v_order_record.archived = true THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Este pedido já foi cancelado ou arquivado.'
    );
  END IF;

  -- Se o pedido já foi aceito pela cozinha (não é mais pendente), recusa
  IF v_current_status != 'pendente' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'O pedido já foi aceito pela cozinha e não pode mais ser cancelado por aqui.'
    );
  END IF;

  -- Cancela o pedido (o trigger já dispara a notificação realtime)
  UPDATE orders
  SET status = 'cancelado', archived = true
  WHERE id = p_order_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Pedido cancelado com sucesso.'
  );
END;
$$;

-- Permite que anon e authenticated chamem a função
GRANT EXECUTE ON FUNCTION public.cancel_order(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.cancel_order(UUID) TO authenticated;
