-- =============================================
-- GATEWAY PIX - Credenciais do Mercado Pago
-- Armazena access token e webhook secret para
-- geração de QR Code dinâmico e baixa automática.
-- =============================================

CREATE TABLE IF NOT EXISTS pix_gateway_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'mercadopago',
  access_token TEXT NOT NULL,
  webhook_secret TEXT,
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE pix_gateway_config IS
  'Credenciais do gateway de pagamento PIX (Mercado Pago). Valores sensíveis ficam apenas server-side.';

-- =============================================
-- RLS - pix_gateway_config
-- =============================================

ALTER TABLE pix_gateway_config ENABLE ROW LEVEL SECURITY;

-- Apenas admin pode ler/configurar (access_token não deve vazar)
CREATE POLICY "Admin can manage pix gateway config"
  ON pix_gateway_config FOR ALL
  USING (public.has_any_role(ARRAY['admin']));

-- Service role (Edge Functions) bypassa RLS

-- =============================================
-- TRIGGER - atualiza updated_at
-- =============================================

CREATE OR REPLACE FUNCTION public.touch_pix_gateway_config()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_pix_gateway_config ON public.pix_gateway_config;
CREATE TRIGGER trg_touch_pix_gateway_config
  BEFORE UPDATE ON public.pix_gateway_config
  FOR EACH ROW EXECUTE FUNCTION public.touch_pix_gateway_config();

-- =============================================
-- COLUNAS PIX GATEWAY NA TABELA ORDERS
-- =============================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pix_payment_id TEXT;

COMMENT ON COLUMN public.orders.pix_payment_id IS
  'ID do pagamento no gateway (ex.: ID do pagamento no Mercado Pago). Usado para consultar status e confirmar via webhook.';

-- Índice para busca rápida pelo webhook
CREATE INDEX IF NOT EXISTS idx_orders_pix_payment_id ON public.orders(pix_payment_id);

-- =============================================
-- RPC - confirmar pagamento PIX (chamada pela Edge Function)
-- Ignora RLS via SECURITY DEFINER
-- =============================================

CREATE OR REPLACE FUNCTION public.confirm_pix_payment(
  p_pix_payment_id TEXT,
  p_amount NUMERIC
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
BEGIN
  -- Buscar pedido pelo pix_payment_id
  SELECT id, total, payment_status
  INTO v_order
  FROM orders
  WHERE pix_payment_id = p_pix_payment_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'order_not_found');
  END IF;

  -- Idempotência: já está pago?
  IF v_order.payment_status = 'pago' THEN
    RETURN json_build_object('success', true, 'message', 'already_paid');
  END IF;

  -- Validar valor (com tolerância de R$ 0.01)
  IF p_amount < v_order.total - 0.01 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'insufficient_amount',
      'expected', v_order.total,
      'received', p_amount
    );
  END IF;

  -- Atualizar para pago
  UPDATE orders
  SET payment_status = 'pago'
  WHERE id = v_order.id;

  RETURN json_build_object('success', true, 'order_id', v_order.id);
END;
$$;

COMMENT ON FUNCTION public.confirm_pix_payment IS
  'Confirma pagamento PIX de um pedido. Chamada pela Edge Function webhook. Idempotente.';

-- Garantir que a função pode ser chamada (edge functions usam service_role)
GRANT EXECUTE ON FUNCTION public.confirm_pix_payment TO service_role;

NOTIFY pgrst, 'reload schema';
