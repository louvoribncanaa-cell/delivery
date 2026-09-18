import { useEffect, useState } from 'react'
import { History as HistoryIcon, Search } from 'lucide-react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { formatCurrency, formatDate, getPaymentMethodLabel, getStatusColor, getStatusLabel, cn } from '../lib/utils'
import type { Database } from '../lib/supabase'

type Order = Database['public']['Tables']['orders']['Row']

export default function History() {
  const [orders, setOrders] = useState<Order[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [payment, setPayment] = useState('')
  const [period, setPeriod] = useState('')

  useEffect(() => {
    async function loadHistory() {
      const { data } = await supabase.from('orders').select('*').eq('archived', true).order('created_at', { ascending: false })
      if (data) setOrders(data)
    }
    loadHistory()
  }, [])

  const filteredOrders = orders.filter((order) => {
    const term = search.toLowerCase()
    const matchesSearch = !term || order.customer_name.toLowerCase().includes(term) || String(order.order_number).includes(term)
    const matchesStatus = !status || order.status === status
    const matchesPayment = !payment || order.payment_status === payment
    const age = Date.now() - new Date(order.created_at).getTime()
    const matchesPeriod = !period || (period === 'today' ? age < 86400000 : period === 'week' ? age < 604800000 : true)
    return matchesSearch && matchesStatus && matchesPayment && matchesPeriod
  })

  return (
    <Layout title="Histórico">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white"><HistoryIcon className="h-5 w-5" /></div>
        <div><h2 className="text-xl font-bold text-slate-900">Histórico de pedidos</h2><p className="text-sm text-slate-500">Pedidos cancelados, entregues ou removidos das telas</p></div>
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2 lg:col-span-1"><Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar pedido ou cliente" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-13 pr-3 text-sm" /></div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">Todos os status</option><option value="cancelado">Cancelado</option><option value="entregue">Entregue</option><option value="pronto">Pronto</option></select>
        <select value={payment} onChange={(e) => setPayment(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">Todos pagamentos</option><option value="pendente">Pendente</option><option value="pago">Pago</option></select>
        <select value={period} onChange={(e) => setPeriod(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">Qualquer período</option><option value="today">Hoje</option><option value="week">Últimos 7 dias</option></select>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="w-full min-w-[680px]"><thead><tr className="border-b bg-slate-50"><th className="px-4 py-3 text-left text-xs uppercase text-slate-500">Pedido</th><th className="px-4 py-3 text-left text-xs uppercase text-slate-500">Cliente</th><th className="px-4 py-3 text-left text-xs uppercase text-slate-500">Status</th><th className="px-4 py-3 text-left text-xs uppercase text-slate-500">Pagamento</th><th className="px-4 py-3 text-left text-xs uppercase text-slate-500">Total</th></tr></thead><tbody>{filteredOrders.map((order) => <tr key={order.id} className="border-b border-slate-100"><td className="px-4 py-3 font-bold">#{order.order_number}<p className="text-xs font-normal text-slate-500">{formatDate(order.created_at)}</p></td><td className="px-4 py-3 text-sm">{order.customer_name}</td><td className="px-4 py-3"><span className={cn('rounded-full border px-2.5 py-1 text-xs font-medium', getStatusColor(order.status))}>{getStatusLabel(order.status)}</span></td><td className="px-4 py-3 text-sm">{getPaymentMethodLabel(order.payment_method)}<p className="text-xs text-slate-500">{order.payment_status === 'pago' ? 'Pago' : 'Pendente'}</p></td><td className="px-4 py-3 font-bold">{formatCurrency(Number(order.total))}</td></tr>)}</tbody></table>{filteredOrders.length === 0 && <p className="py-12 text-center text-slate-500">Nenhum pedido encontrado.</p>}</div>
    </Layout>
  )
}
