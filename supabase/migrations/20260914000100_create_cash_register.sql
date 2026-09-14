-- =============================================
-- TABELA CAIXA - Controle de abertura/fechamento
-- =============================================

CREATE TABLE cash_register (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opened_by UUID NOT NULL REFERENCES profiles(id),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  initial_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  final_amount DECIMAL(10,2)
);

-- =============================================
-- RLS - cash_register
-- =============================================

ALTER TABLE cash_register ENABLE ROW LEVEL SECURITY;

-- Admin e caixa podem ver registros de caixa
CREATE POLICY "Admin and cashier can view cash register"
  ON cash_register FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() 
      AND role IN ('admin', 'caixa')
    )
  );

-- Admin e caixa podem inserir registros de caixa
CREATE POLICY "Admin and cashier can insert cash register"
  ON cash_register FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() 
      AND role IN ('admin', 'caixa')
    )
  );

-- Admin e caixa podem atualizar registros de caixa
CREATE POLICY "Admin and cashier can update cash register"
  ON cash_register FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() 
      AND role IN ('admin', 'caixa')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() 
      AND role IN ('admin', 'caixa')
    )
  );

-- =============================================
-- VIEW para verificar se caixa está aberto (qualquer autenticado)
-- =============================================

CREATE OR REPLACE VIEW cash_register_status AS
SELECT 
  cr.id,
  cr.status,
  cr.opened_at,
  cr.opened_by,
  p.name AS opened_by_name
FROM cash_register cr
JOIN profiles p ON p.id = cr.opened_by
WHERE cr.status = 'open'
LIMIT 1;

-- Habilitar realtime para cash_register
ALTER PUBLICATION supabase_realtime ADD TABLE cash_register;
