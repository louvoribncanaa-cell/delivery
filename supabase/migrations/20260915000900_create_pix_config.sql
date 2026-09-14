-- =============================================
-- CONFIGURAÇÃO PIX - chave Pix do estabelecimento
-- Usada como base para gerar os QR Codes de pagamento
-- (BR Code / EMV dinâmico com valor ou via gateway).
-- =============================================

CREATE TABLE IF NOT EXISTS pix_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_type TEXT NOT NULL CHECK (key_type IN ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria')),
  pix_key TEXT NOT NULL,
  merchant_name TEXT NOT NULL,
  merchant_city TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE pix_config IS
  'Chave Pix do estabelecimento usada na geração dos QR Codes de pagamento.';

-- =============================================
-- RLS - pix_config
-- =============================================

ALTER TABLE pix_config ENABLE ROW LEVEL SECURITY;

-- Qualquer pessoa (cliente no cardápio, atendente, caixa) pode ler a config ativa,
-- necessário para renderizar o QR Code no checkout do cliente sem gateway.
CREATE POLICY "Anyone can read active pix config"
  ON pix_config FOR SELECT
  USING (active = true OR public.has_any_role(ARRAY['admin']));

-- Apenas admin gerencia as configurações
CREATE POLICY "Admin can insert pix config"
  ON pix_config FOR INSERT
  WITH CHECK (public.has_any_role(ARRAY['admin']));

CREATE POLICY "Admin can update pix config"
  ON pix_config FOR UPDATE
  USING (public.has_any_role(ARRAY['admin']))
  WITH CHECK (public.has_any_role(ARRAY['admin']));

CREATE POLICY "Admin can delete pix config"
  ON pix_config FOR DELETE
  USING (public.has_any_role(ARRAY['admin']));

GRANT SELECT ON public.pix_config TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.pix_config TO authenticated;

-- =============================================
-- TRIGGER - atualiza updated_at
-- =============================================

CREATE OR REPLACE FUNCTION public.touch_pix_config()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_pix_config ON public.pix_config;
CREATE TRIGGER trg_touch_pix_config
  BEFORE UPDATE ON public.pix_config
  FOR EACH ROW EXECUTE FUNCTION public.touch_pix_config();

NOTIFY pgrst, 'reload schema';