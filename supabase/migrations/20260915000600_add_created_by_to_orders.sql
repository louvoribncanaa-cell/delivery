-- Vincula cada pedido ao usuário que o criou (atendente) para a tela "Meus Pedidos".
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_created_by ON public.orders(created_by);
CREATE INDEX IF NOT EXISTS idx_orders_created_by_created_at ON public.orders(created_by, created_at DESC);

-- Garante que atendentes autenticados consigam ler os próprios pedidos.
-- (As policies existentes já permitem SELECT para atendente/admin, mantemos compatibilidade.)
-- Apenas garante RLS continua válido após a nova coluna; sem remover policies antigas.

NOTIFY pgrst, 'reload schema';
