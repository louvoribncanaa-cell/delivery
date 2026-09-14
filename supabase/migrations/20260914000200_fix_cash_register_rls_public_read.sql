-- Permitir que qualquer pessoa (autenticada ou não) veja se o caixa está aberto
-- Isso é necessário para o cardápio digital (público) e para atendentes verificarem o status

DROP POLICY IF EXISTS "Admin and cashier can view cash register" ON cash_register;
DROP POLICY IF EXISTS "Anyone can view cash register status" ON cash_register;

-- Qualquer pessoa pode VER o status do caixa (SELECT)
CREATE POLICY "Anyone can view cash register status"
  ON cash_register FOR SELECT
  USING (true);
