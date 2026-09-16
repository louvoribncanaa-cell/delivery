import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CreditCard, Search, Check, Clock, DollarSign, Banknote, Smartphone, Lock, Unlock, XCircle, Trash2, Eye, Timer, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import { supabase } from '../lib/supabase'
import { useCashRegister } from '../contexts/CashRegisterContext'
import { formatCurrency, formatDate, getStatusColor, getStatusLabel, getPaymentMethodLabel, cn } from '../lib/utils'
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
  { value: 'em_preparo', label: 'Em Preparo' },
  { value: 'pronto', label: 'Pronto' },
  { value: 'entregue', label: 'Entregue' },
  { value: 'cancelado', label: 'Cancelado' },
]

const paymentFilters = [
  { value: '', label: 'Todos' },
  { value: 'pendente', label: 'Pix' },
  { value: 'pago', label: 'Pago' },
]

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  pendente: { bg: '#fff3e0', text: '#e65100', dot: '#fb8c00' },
  em_preparo: { bg: '#e3f2fd', text: '#1565c0', dot: '#42a5f5' },
  pronto: { bg: '#e8f5e9', text: '#2e7d32', dot: '#66bb6a' },
  entregue: { bg: '#f3e5f5', text: '#6a1b9a', dot: '#ab47bc' },
  cancelado: { bg: '#fbe9e7', text: '#c62828', dot: '#ef5350' },
}

const statusLabels: Record<string, string> = {
  pendente: 'Novo',
  em_preparo: 'Preparo',
  pronto: 'Pronto',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
}

function getPaymentIcon(method: string) {
  if (method === 'pix') return <Smartphone className="w-4 h-4" />
  if (method === 'credito' || method === 'debito') return <CreditCard className="w-4 h-4" />
  return <Banknote className="w-4 h-4" />
}

function getWaitTime(createdAt: string) {
  const diff = Date.now() - new Date(createdAt).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}min`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ${mins % 60}min`
}

export default function Cashier() {
  const { isOpen, currentRegister, openRegister, closeRegister } = useCashRegister()
  const [orders, setOrders] = useState<OrderWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterPayment, setFilterPayment] = useState<string>('')
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const [isOpenModalOpen, setIsOpenModalOpen] = useState(false)
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false)
  const [initialAmount, setInitialAmount] = useState('')
  const [finalAmount, setFinalAmount] = useState('')
  const [registerLoading, setRegisterLoading] = useState(false)

  useEffect(() => {
    fetchOrders()
    const channel = supabase
      .channel('cashier-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function fetchOrders() {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`*, order_items (*, products (name))`)
        .eq('archived', false)
        .order('created_at', { ascending: false })
      if (error) throw error
      setOrders((data as OrderWithItems[]) || [])
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleOpenRegister() {
    setRegisterLoading(true)
    const amount = parseFloat(initialAmount) || 0
    const { error } = await openRegister(amount)
    if (error) { toast.error(error) } else { toast.success('Caixa aberto com sucesso!'); setIsOpenModalOpen(false); setInitialAmount('') }
    setRegisterLoading(false)
  }

  async function handleCloseRegister() {
    setRegisterLoading(true)
    const amount = Number(currentRegister?.initial_amount || 0) + totalPaid
    const { error } = await closeRegister(amount)
    if (error) { toast.error(error) } else { toast.success('Caixa fechado com sucesso!'); setIsCloseModalOpen(false); setFinalAmount('') }
    setRegisterLoading(false)
  }

  async function markAsPaid(orderId: string) {
    try {
      const { error } = await supabase.from('orders').update({ payment_status: 'pago' }).eq('id', orderId)
      if (error) throw error
      toast.success('Pedido marcado como pago!')
      setIsDetailOpen(false)
      fetchOrders()
    } catch { toast.error('Erro ao atualizar pagamento') }
  }

  async function markAsDelivered(orderId: string) {
    try {
      const { error } = await supabase.from('orders').update({ status: 'entregue' }).eq('id', orderId)
      if (error) throw error
      toast.success('Pedido entregue!')
      setIsDetailOpen(false)
      fetchOrders()
    } catch { toast.error('Erro ao atualizar status') }
  }

  async function cancelOrder(orderId: string) {
    if (!confirm('Cancelar este pedido?')) return
    const { error } = await supabase.from('orders').update({ status: 'cancelado', archived: true }).eq('id', orderId)
    if (error) { toast.error('Não foi possível cancelar o pedido'); return }
    setIsDetailOpen(false)
    fetchOrders()
    toast.success('Pedido cancelado e enviado para o histórico')
  }

  async function clearOrdersFromScreen() {
    if (!confirm('Limpar todos os pedidos desta tela?')) return
    const { error } = await supabase.from('orders').update({ archived: true }).eq('archived', false)
    if (error) { toast.error('Não foi possível limpar os pedidos'); return }
    fetchOrders()
    toast.success('Pedidos movidos para o histórico')
  }

  const filteredOrders = orders.filter((o) => {
    const matchesSearch = !search || o.customer_name.toLowerCase().includes(search.toLowerCase()) || o.order_number.toString().includes(search)
    const matchesStatus = !filterStatus || o.status === filterStatus
    const matchesPayment = !filterPayment || o.payment_status === filterPayment
    return matchesSearch && matchesStatus && matchesPayment
  })

  const todayOrders = orders.filter((o) => new Date(o.created_at).toDateString() === new Date().toDateString())
  const totalPaid = todayOrders.filter((o) => o.payment_status === 'pago').reduce((sum, o) => sum + Number(o.total), 0)
  const totalPending = todayOrders.filter((o) => o.payment_status === 'pendente').reduce((sum, o) => sum + Number(o.total), 0)
  const byPaymentMethod = todayOrders
    .filter((o) => o.payment_status === 'pago')
    .reduce((acc, o) => { acc[o.payment_method] = (acc[o.payment_method] || 0) + Number(o.total); return acc }, {} as Record<string, number>)

  if (loading) {
    return (
      <Layout title="Caixa">
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-transparent" style={{ borderColor: '#14917a', borderTopColor: 'transparent' }} />
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Caixa">
      {/* ── Status Banner ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 rounded-[24px] overflow-hidden"
        style={{ background: isOpen ? 'linear-gradient(135deg, #e0f7f1 0%, #d1f2eb 100%)' : 'linear-gradient(135deg, #fff0ed 0%, #ffe4de 100%)' }}
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between px-8 py-7">
          <div className="flex items-center gap-5">
            <div
              className="w-[72px] h-[72px] rounded-[20px] flex items-center justify-center shadow-lg"
              style={{
                background: isOpen ? 'linear-gradient(135deg, #14917a, #0d7c67)' : 'linear-gradient(135deg, #f97066, #ef4444)',
                boxShadow: isOpen ? '0 8px 24px rgba(20, 145, 130, 0.35)' : '0 8px 24px rgba(249, 112, 102, 0.35)',
              }}
            >
              {isOpen
                ? <Unlock className="w-9 h-9 text-white" />
                : <Lock className="w-9 h-9 text-white" />
              }
            </div>
            <div>
              <h3 className="text-[22px] font-bold" style={{ color: isOpen ? '#0d5e4f' : '#991b1b' }}>
                {isOpen ? 'Caixa Aberto' : 'Caixa Fechado'}
              </h3>
              {isOpen && currentRegister && (
                <p className="text-[14px] mt-1" style={{ color: '#0d7c67' }}>
                  Aberto às {formatDate(currentRegister.opened_at)}
                  {currentRegister.initial_amount > 0 && <> · Inicial: {formatCurrency(currentRegister.initial_amount)}</>}
                </p>
              )}
              {!isOpen && (
                <p className="text-[14px] mt-1" style={{ color: '#b91c1c' }}>
                  Abra o caixa para iniciar as vendas
                </p>
              )}
            </div>
          </div>
          <div>
            {isOpen ? (
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => setIsCloseModalOpen(true)}
                className="px-8 py-3.5 text-white text-[14px] font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2.5 whitespace-nowrap hover:shadow-xl hover:scale-[1.02]"
                style={{ background: 'linear-gradient(135deg, #f97066, #ef4444)', boxShadow: '0 6px 20px rgba(239, 68, 68, 0.3)' }}
              >
                <Lock className="w-5 h-5" />
                Fechar Caixa
              </motion.button>
            ) : (
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => setIsOpenModalOpen(true)}
                className="px-8 py-3.5 text-white text-[14px] font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2.5 whitespace-nowrap hover:shadow-xl hover:scale-[1.02]"
                style={{ background: 'linear-gradient(135deg, #14917a, #0d7c67)', boxShadow: '0 6px 20px rgba(20, 145, 130, 0.35)' }}
              >
                <Unlock className="w-5 h-5" />
                Abrir Caixa
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Financial Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="rounded-2xl p-4 border flex items-center gap-3"
          style={{ background: 'linear-gradient(135deg, #e6f9f5, #d5f5ee)', borderColor: '#b8e8dc' }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(20, 145, 130, 0.15)' }}>
            <DollarSign className="w-5 h-5" style={{ color: '#14917a' }} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold truncate" style={{ color: '#0d7c67' }}>Recebido Hoje</p>
            <p className="text-[18px] font-extrabold text-slate-900 leading-tight truncate">{formatCurrency(totalPaid)}</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-2xl p-4 border flex items-center gap-3"
          style={{ background: 'linear-gradient(135deg, #fff0ed, #ffe4de)', borderColor: '#fdd' }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(249, 112, 102, 0.15)' }}>
            <Clock className="w-5 h-5" style={{ color: '#f97066' }} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold truncate" style={{ color: '#c0392b' }}>Pendente</p>
            <p className="text-[18px] font-extrabold text-slate-900 leading-tight truncate">{formatCurrency(totalPending)}</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="rounded-2xl p-4 border flex items-center gap-3"
          style={{ background: 'linear-gradient(135deg, #e8f4fd, #d6ecfb)', borderColor: '#bddaf6' }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(33, 150, 243, 0.15)' }}>
            <Smartphone className="w-5 h-5" style={{ color: '#2196f3' }} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold truncate" style={{ color: '#1565c0' }}>Pix</p>
            <p className="text-[18px] font-extrabold text-slate-900 leading-tight truncate">{formatCurrency(byPaymentMethod.pix || 0)}</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="rounded-2xl p-4 border flex items-center gap-3"
          style={{ background: 'linear-gradient(135deg, #f5f0ff, #ede5ff)', borderColor: '#ddd0f9' }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(149, 97, 227, 0.15)' }}>
            <Banknote className="w-5 h-5" style={{ color: '#9561e3' }} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold truncate" style={{ color: '#6a1b9a' }}>Dinheiro</p>
            <p className="text-[18px] font-extrabold text-slate-900 leading-tight truncate">{formatCurrency(byPaymentMethod.dinheiro || 0)}</p>
          </div>
        </motion.div>
      </div>

      {/* ── Filters ── */}
      <div className="mb-6 rounded-[22px] border border-slate-200/60 p-5" style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)' }}>
        <div className="flex flex-col gap-5">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou nº do pedido..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-slate-50/80 border border-slate-200 rounded-2xl text-[14px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-[#14917a] focus:bg-white focus:shadow-[0_0_0_3px_rgba(20,145,130,0.1)] transition-all"
            />
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Status</span>
              <div className="flex flex-wrap gap-2">
                {statusFilters.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setFilterStatus(f.value)}
                    className={`px-4 py-2 rounded-xl text-[13px] font-semibold transition-all ${
                      filterStatus === f.value
                        ? 'text-white shadow-md'
                        : 'text-slate-500 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                    style={filterStatus === f.value ? { background: 'linear-gradient(135deg, #14917a, #0d7c67)', boxShadow: '0 4px 12px rgba(20, 145, 130, 0.3)' } : undefined}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="hidden lg:block w-px h-10 bg-slate-200" />

            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pagamento</span>
              <div className="flex flex-wrap gap-2">
                {paymentFilters.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setFilterPayment(f.value)}
                    className={`px-4 py-2 rounded-xl text-[13px] font-semibold transition-all ${
                      filterPayment === f.value
                        ? 'text-white shadow-md'
                        : 'text-slate-500 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                    style={filterPayment === f.value ? { background: 'linear-gradient(135deg, #14917a, #0d7c67)', boxShadow: '0 4px 12px rgba(20, 145, 130, 0.3)' } : undefined}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:ml-auto">
              <button onClick={clearOrdersFromScreen} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-slate-700 transition-colors">
                <Trash2 className="h-4 w-4" /> Limpar tela
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Order Cards Grid ── */}
      <div className="mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredOrders.map((order) => {
            const sc = statusColors[order.status] || statusColors.pendente
            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -2 }}
                className="rounded-[20px] border border-slate-200/60 p-5 cursor-pointer transition-all hover:shadow-lg hover:border-slate-300/60"
                style={{ background: 'rgba(255,255,255,0.95)' }}
                onClick={() => { setSelectedOrder(order); setIsDetailOpen(true) }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <span className="text-[22px] font-extrabold text-slate-900">#{order.order_number}</span>
                    <p className="text-[13px] font-medium text-slate-600 mt-0.5">{order.customer_name}</p>
                  </div>
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold"
                    style={{ background: sc.bg, color: sc.text }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc.dot }} />
                    {statusLabels[order.status] || order.status}
                  </span>
                </div>

                <div className="flex items-center gap-4 mb-4 text-[12px] text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Timer className="w-3.5 h-3.5" />
                    {getWaitTime(order.created_at)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {getPaymentIcon(order.payment_method)}
                    {getPaymentMethodLabel(order.payment_method)}
                  </span>
                  <span className={cn(
                    'px-2 py-0.5 rounded-md text-[11px] font-semibold',
                    order.payment_status === 'pago' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  )}>
                    {order.payment_status === 'pago' ? 'Pago' : 'Pendente'}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <span className="text-[20px] font-extrabold text-slate-900">{formatCurrency(Number(order.total))}</span>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {order.payment_status === 'pendente' && (
                      <button
                        onClick={() => markAsPaid(order.id)}
                        className="px-3 py-1.5 rounded-xl text-[12px] font-semibold text-white transition-colors"
                        style={{ background: 'linear-gradient(135deg, #14917a, #0d7c67)' }}
                      >
                        <Check className="w-3 h-3 inline mr-1" />Pago
                      </button>
                    )}
                    {order.status === 'pronto' && (
                      <button
                        onClick={() => markAsDelivered(order.id)}
                        className="px-3 py-1.5 rounded-xl text-[12px] font-semibold text-white transition-colors"
                        style={{ background: 'linear-gradient(135deg, #2196f3, #1976d2)' }}
                      >
                        Entregue
                      </button>
                    )}
                    <button
                      onClick={() => cancelOrder(order.id)}
                      className="px-3 py-1.5 rounded-xl text-[12px] font-semibold text-white transition-colors"
                      style={{ background: 'linear-gradient(135deg, #f97066, #ef4444)' }}
                    >
                      <XCircle className="w-3 h-3 inline mr-1" />Cancelar
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {filteredOrders.length === 0 && (
          <div className="text-center py-16 rounded-[22px] border border-slate-200/60" style={{ background: 'rgba(255,255,255,0.9)' }}>
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: '#f0f4f8' }}>
              <CreditCard className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-[15px] font-semibold text-slate-500">Nenhum pedido encontrado</p>
            <p className="text-[13px] text-slate-400 mt-1">Ajuste os filtros ou aguarde novos pedidos</p>
          </div>
        )}
      </div>

      {/* ── Counter ── */}
      <div className="flex items-center justify-between mt-6 px-2">
        <p className="text-[13px] font-semibold text-slate-500">
          Total Pedidos: <span className="font-bold text-slate-800">{filteredOrders.length}</span>
        </p>
      </div>

      {/* ── Order Detail Modal ── */}
      <Modal isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} title={selectedOrder ? `Pedido #${selectedOrder.order_number}` : ''}>
        {selectedOrder && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Cliente</p>
                <p className="text-[14px] font-semibold text-slate-900">{selectedOrder.customer_name}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Telefone</p>
                <p className="text-[14px] font-semibold text-slate-900">{selectedOrder.customer_phone || '—'}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Mesa/Endereço</p>
                <p className="text-[14px] font-semibold text-slate-900">{selectedOrder.table_or_address || '—'}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Pagamento</p>
                <p className="text-[14px] font-semibold text-slate-900">{getPaymentMethodLabel(selectedOrder.payment_method)}</p>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Itens</p>
              <div className="space-y-2">
                {selectedOrder.order_items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between bg-slate-50 rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-[#14917a]">{item.quantity}x</span>
                      <div>
                        <p className="text-[13px] font-medium text-slate-900">{item.products?.name}</p>
                        {item.notes && <p className="text-[11px] text-crimson-500 mt-0.5">{item.notes}</p>}
                      </div>
                    </div>
                    <p className="text-[13px] font-semibold text-slate-700">{formatCurrency(Number(item.unit_price) * item.quantity)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4 flex items-center justify-between">
              <span className="text-[18px] font-bold text-slate-900">Total</span>
              <span className="text-[22px] font-extrabold" style={{ color: '#14917a' }}>{formatCurrency(Number(selectedOrder.total))}</span>
            </div>

            <div className="flex gap-3 pt-2">
              {selectedOrder.payment_status === 'pendente' && (
                <button onClick={() => markAsPaid(selectedOrder.id)} className="flex-1 py-3 text-white rounded-2xl font-semibold transition-all text-[14px]"
                  style={{ background: 'linear-gradient(135deg, #14917a, #0d7c67)' }}>
                  Marcar como Pago
                </button>
              )}
              {selectedOrder.status === 'pronto' && (
                <button onClick={() => markAsDelivered(selectedOrder.id)} className="flex-1 py-3 text-white rounded-2xl font-semibold transition-all text-[14px]"
                  style={{ background: 'linear-gradient(135deg, #2196f3, #1976d2)' }}>
                  Marcar como Entregue
                </button>
              )}
              <button onClick={() => cancelOrder(selectedOrder.id)} className="flex-1 py-3 text-white rounded-2xl font-semibold transition-all text-[14px]"
                style={{ background: 'linear-gradient(135deg, #f97066, #ef4444)' }}>
                Cancelar Pedido
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Open Register Modal ── */}
      <Modal isOpen={isOpenModalOpen} onClose={() => setIsOpenModalOpen(false)} title="Abrir Caixa">
        <div className="space-y-6">
          <p className="text-[14px] text-slate-600 leading-relaxed">
            Informe o valor inicial em caixa para começar o expediente.
          </p>
          <div>
            <label className="block text-[13px] font-semibold text-slate-700 mb-2">Valor Inicial (R$)</label>
            <input
              type="number" step="0.01" min="0" value={initialAmount}
              onChange={(e) => setInitialAmount(e.target.value)}
              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-[18px] font-bold focus:outline-none focus:border-[#14917a] focus:shadow-[0_0_0_3px_rgba(20,145,130,0.1)] min-h-[56px]"
              placeholder="0,00"
            />
          </div>
          <button onClick={handleOpenRegister} disabled={registerLoading}
            className="w-full py-4 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-[15px] min-h-[56px] hover:shadow-lg"
            style={{ background: 'linear-gradient(135deg, #14917a, #0d7c67)' }}>
            {registerLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
            ) : (<><Unlock className="w-5 h-5" /> Abrir Caixa</>)}
          </button>
        </div>
      </Modal>

      {/* ── Close Register Modal ── */}
      <Modal isOpen={isCloseModalOpen} onClose={() => setIsCloseModalOpen(false)} title="Fechar Caixa">
        <div className="space-y-6">
          <p className="text-[14px] text-slate-600 leading-relaxed">
            Informe o valor final em caixa para encerrar o expediente.
          </p>
          {currentRegister && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Valor inicial</span>
              <span className="block text-[24px] font-bold text-slate-900">{formatCurrency(currentRegister.initial_amount)}</span>
            </div>
          )}
          <div>
            <label className="block text-[13px] font-semibold text-slate-700 mb-2">Valor Final (inicial + arrecadado)</label>
            <input type="number" step="0.01" min="0"
              value={(Number(currentRegister?.initial_amount || 0) + totalPaid).toFixed(2)} readOnly
              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-[18px] font-bold focus:outline-none focus:border-[#14917a] min-h-[56px]" />
            <p className="mt-2 text-[12px] text-slate-500">
              {formatCurrency(Number(currentRegister?.initial_amount || 0))} inicial + {formatCurrency(totalPaid)} arrecadado hoje.
            </p>
          </div>
          <button onClick={handleCloseRegister} disabled={registerLoading}
            className="w-full py-4 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-[15px] min-h-[56px] hover:shadow-lg"
            style={{ background: 'linear-gradient(135deg, #f97066, #ef4444)' }}>
            {registerLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
            ) : (<><Lock className="w-5 h-5" /> Fechar Caixa</>)}
          </button>
        </div>
      </Modal>
    </Layout>
  )
}
