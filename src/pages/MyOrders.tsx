import { useEffect, useMemo, useState } from 'react'
import { ClipboardList, Search, RefreshCw, XCircle, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency, formatDate, getPaymentMethodLabel, getStatusColor, getStatusLabel, cn } from '../lib/utils'
import type { Database } from '../lib/supabase'

type Order = Database['public']['Tables']['orders']['Row']
type OrderItem = Database['public']['Tables']['order_items']['Row'] & {
  products: { name: string } | null
}

interface OrderWithItems extends Order {
  order_items: OrderItem[]
}

const statusFilters = [
  { value: '', label: 'Todos' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'em_preparo', label: 'Em preparo' },
  { value: 'pronto', label: 'Pronto' },
  { value: 'entregue', label: 'Entregue' },
  { value: 'cancelado', label: 'Cancelado' },
]

export default function MyOrders() {
  const { user, profile } = useAuth()
  const authorId = user?.id ?? profile?.id ?? null
  const [orders, setOrders] = useState<OrderWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [missingColumn, setMissingColumn] = useState(false)

  useEffect(() => {
    if (!authorId) {
      setLoading(false)
      return
    }
    fetchMyOrders()

    const channel = supabase
      .channel(`my-orders-${authorId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        const record = (payload.new ?? payload.old) as { created_by?: string | null; id?: string } | undefined
        if (!record) {
          fetchMyOrders()
          return
        }
        // Só recarrega se for um pedido deste atendente (ou se ainda não sabemos o autor)
        if (!record.created_by || record.created_by === authorId) fetchMyOrders()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorId])

  async function fetchMyOrders() {
    if (!authorId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*, products(name))')
        .eq('created_by', authorId)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      setOrders((data as OrderWithItems[]) || [])
      setMissingColumn(false)
    } catch (error) {
      const message = error && typeof error === 'object' && 'message' in error ? String((error as { message: unknown }).message) : ''
      if (message.toLowerCase().includes('created_by')) {
        setMissingColumn(true)
      } else {
        console.error('Erro ao buscar meus pedidos:', error)
        toast.error('Não foi possível carregar seus pedidos')
      }
    } finally {
      setLoading(false)
    }
  }

  async function cancelOrder(orderId: string) {
    if (!confirm('Cancelar este pedido?')) return
    try {
      const { data, error } = await supabase.rpc('cancel_order', { p_order_id: orderId })
      if (error) throw error
      const result = data as { success: boolean; error?: string }
      if (!result.success) {
        toast.error(result.error || 'Não foi possível cancelar o pedido')
        return
      }
      toast.success('Pedido cancelado')
      fetchMyOrders()
    } catch (error) {
      toast.error('Não foi possível cancelar o pedido')
      console.error(error)
    }
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return orders.filter((order) => {
      const matchesSearch =
        !term ||
        order.customer_name.toLowerCase().includes(term) ||
        String(order.order_number).includes(term)
      const matchesStatus = !status || order.status === status
      return matchesSearch && matchesStatus
    })
  }, [orders, search, status])

  const counts = useMemo(() => {
    const active = orders.filter((o) => ['pendente', 'em_preparo', 'pronto'].includes(o.status)).length
    const today = orders.filter((o) => new Date(o.created_at).toDateString() === new Date().toDateString()).length
    return { total: orders.length, active, today }
  }, [orders])

  if (loading) {
    return (
      <Layout title="Meus Pedidos">
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber-500 border-t-transparent" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Meus Pedidos">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500 text-white">
          <ClipboardList className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Meus pedidos</h2>
          <p className="text-sm text-slate-500">
            {counts.total} {counts.total === 1 ? 'pedido realizado' : 'pedidos realizados'} por você
            {counts.active > 0 && ` • ${counts.active} em andamento`}
            {counts.today > 0 && ` • ${counts.today} hoje`}
          </p>
        </div>
        <button
          onClick={fetchMyOrders}
          className="ml-auto flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:border-amber-300 hover:text-amber-600 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </button>
      </div>

      {missingColumn && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Atenção:</strong> a coluna <code>created_by</code> ainda não existe no banco.
          Rode <code>npx supabase db push</code> para aplicar a migration{' '}
          <code>20260915000600_add_created_by_to_orders</code> e liberar a listagem por atendente.
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente ou nº do pedido..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-11 pr-3 text-sm focus:outline-none focus:border-amber-500"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {statusFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatus(f.value)}
              className={cn(
                'whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                status === f.value
                  ? 'border-amber-500 bg-amber-500 text-white shadow-md'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-amber-300'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center text-slate-500">
          <ClipboardList className="mx-auto mb-3 h-10 w-10 opacity-40" />
          <p className="font-medium">Nenhum pedido encontrado</p>
          <p className="mt-1 text-sm">Os pedidos que você lançar aparecerão aqui com o status em tempo real.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const expanded = expandedId === order.id
            return (
              <div key={order.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <button
                  onClick={() => setExpandedId(expanded ? null : order.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900">#{order.order_number}</span>
                      <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-medium', getStatusColor(order.status))}>
                        {getStatusLabel(order.status)}
                      </span>
                      <span
                        className={cn(
                          'rounded-full px-2.5 py-0.5 text-xs font-medium',
                          order.payment_status === 'pago' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        )}
                      >
                        {order.payment_status === 'pago' ? 'Pago' : 'Pagamento pendente'}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm text-slate-600">
                      {order.customer_name}
                      {order.table_or_address && <span className="text-slate-400"> — {order.table_or_address}</span>}
                      <span className="text-slate-400"> • {formatDate(order.created_at)}</span>
                    </p>
                  </div>
                  <span className="font-bold text-slate-900">{formatCurrency(Number(order.total))}</span>
                  <ChevronDown className={cn('h-4 w-4 text-slate-400 transition-transform', expanded && 'rotate-180')} />
                </button>

                {expanded && (
                  <div className="border-t border-slate-100 px-4 py-3">
                    <div className="grid gap-3 text-sm sm:grid-cols-3">
                      <div>
                        <p className="text-xs uppercase text-slate-400">Cliente</p>
                        <p className="font-medium text-slate-900">{order.customer_name}</p>
                        {order.customer_phone && <p className="text-slate-500">{order.customer_phone}</p>}
                      </div>
                      <div>
                        <p className="text-xs uppercase text-slate-400">Pagamento</p>
                        <p className="font-medium text-slate-900">{getPaymentMethodLabel(order.payment_method)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-slate-400">Total</p>
                        <p className="font-bold text-amber-600">{formatCurrency(Number(order.total))}</p>
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      {order.order_items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                          <span className="text-slate-700">
                            <span className="font-bold text-amber-600">{item.quantity}x</span> {item.products?.name ?? 'Item'}
                            {item.notes && <span className="block text-xs text-crimson-500">📝 {item.notes}</span>}
                          </span>
                          <span className="font-medium">{formatCurrency(Number(item.unit_price) * item.quantity)}</span>
                        </div>
                      ))}
                    </div>

                    {order.status === 'pendente' && (
                      <button
                        onClick={() => cancelOrder(order.id)}
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-crimson-600 hover:bg-crimson-50 transition-colors"
                      >
                        <XCircle className="h-4 w-4" />
                        Cancelar pedido
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Layout>
  )
}
