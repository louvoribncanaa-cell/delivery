-- =============================================
-- PIX POR PEDIDO - payload e identificador
-- O QR Code gerado no envio do pedido fica gravado no pedido,
-- garantindo que atendente e cliente vejam exatamente o mesmo código,
-- mesmo que a chave Pix seja alterada depois.
-- =============================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pix_copy_paste TEXT,
  ADD COLUMN IF NOT EXISTS pix_txid TEXT,
  ADD COLUMN IF NOT EXISTS pix_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN public.orders.pix_copy_paste IS
  'Payload Pix (BR Code / Copia e Cola) gerado no momento do envio do pedido.';
COMMENT ON COLUMN public.orders.pix_txid IS
  'Identificador da transação Pix usado no payload (até 25 caracteres alfanuméricos).';
COMMENT ON COLUMN public.orders.pix_expires_at IS
  'Validade sugerida do QR Code Pix (soft expiry, não bloqueia confirmação posterior).';

NOTIFY pgrst, 'reload schema';