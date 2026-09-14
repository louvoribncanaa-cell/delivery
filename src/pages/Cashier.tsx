import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CreditCard, Search, Check, Clock, DollarSign, Banknote, Smartphone, Lock, Unlock, XCircle, Trash2 } from 'lucide-react'
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

export default function Cashier() {
  const { isOpen, currentRegister, openRegister, closeRegister } = useCashRegister()
  const [orders, setOrders] = useState<OrderWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterPayment, setFilterPayment] = useState<string>('')
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  // Register modals
  const [isOpenModalOpen, setIsOpenModalOpen] = useState(false)
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false)
  const [initialAmount, setInitialAmount] = useState('')
  const [finalAmount, setFinalAmount] = useState('')
  const [registerLoading, setRegisterLoading] = useState(false)

  useEffect(() => {
    fetchOrders()

    const channel = supabase
      .channel('cashier-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => fetchOrders()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function fetchOrders() {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            products (name)
          )
        `)
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
    if (error) {
      toast.error(error)
    } else {
      toast.success('Caixa aberto com sucesso!')
      setIsOpenModalOpen(false)
      setInitialAmount('')
    }
    setRegisterLoading(false)
  }

  async function handleCloseRegister() {
    setRegisterLoading(true)
    const amount = Number(currentRegister?.initial_amount || 0) + totalPaid
    const { error } = await closeRegister(amount)
    if (error) {
      toast.error(error)
    } else {
      toast.success('Caixa fechado com sucesso!')
      setIsCloseModalOpen(false)
      setFinalAmount('')
    }
    setRegisterLoading(false)
  }

  async function markAsPaid(orderId: string) {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ payment_status: 'pago' })
        .eq('id', orderId)

      if (error) throw error
      toast.success('Pedido marcado como pago!')
      setIsDetailOpen(false)
      fetchOrders()
    } catch (error) {
      toast.error('Erro ao atualizar pagamento')
    }
  }

  async function markAsDelivered(orderId: string) {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'entregue' })
        .eq('id', orderId)

      if (error) throw error
      toast.success('Pedido entregue!')
      setIsDetailOpen(false)
      fetchOrders()
    } catch (error) {
      toast.error('Erro ao atualizar status')
    }
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
    if (!confirm('Limpar todos os pedidos desta tela? Eles ficarão disponíveis no histórico.')) return
    const { error } = await supabase.from('orders').update({ archived: true }).eq('archived', false)
    if (error) { toast.error('Não foi possível limpar os pedidos'); return }
    fetchOrders()
    toast.success('Pedidos movidos para o histórico')
  }

  const filteredOrders = orders.filter((o) => {
    const matchesSearch = !search ||
      o.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      o.order_number.toString().includes(search)
    const matchesStatus = !filterStatus || o.status === filterStatus
    const matchesPayment = !filterPayment || o.payment_status === filterPayment
    return matchesSearch && matchesStatus && matchesPayment
  })

  // Stats
  const todayOrders = orders.filter((o) => {
    const today = new Date().toDateString()
    return new Date(o.created_at).toDateString() === today
  })

  const totalPaid = todayOrders
    .filter((o) => o.payment_status === 'pago')
    .reduce((sum, o) => sum + Number(o.total), 0)

  const totalPending = todayOrders
    .filter((o) => o.payment_status === 'pendente')
    .reduce((sum, o) => sum + Number(o.total), 0)

  const byPaymentMethod = todayOrders
    .filter((o) => o.payment_status === 'pago')
    .reduce((acc, o) => {
      acc[o.payment_method] = (acc[o.payment_method] || 0) + Number(o.total)
      return acc
    }, {} as Record<string, number>)

  if (loading) {
    return (
      <Layout title="Caixa">
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber-500 border-t-transparent" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Caixa">
      {/* Register Status Bar */}
      <div className={cn(
        'mb-6 rounded-2xl p-5 border-2 transition-all',
        isOpen
          ? 'bg-emerald-50 border-emerald-300'
          : 'bg-crimson-50 border-crimson-300'
      )}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className={cn(
              'w-14 h-14 rounded-2xl flex items-center justify-center',
              isOpen ? 'bg-emerald-500' : 'bg-crimson-500'
            )}>
              {isOpen ? (
                <Unlock className="w-7 h-7 text-white" />
              ) : (
                <Lock className="w-7 h-7 text-white" />
              )}
            </div>
            <div>
              <h3 className={cn(
                'text-lg font-bold',
                isOpen ? 'text-emerald-800' : 'text-crimson-800'
              )}>
                {isOpen ? 'Caixa Aberto' : 'Caixa Fechado'}
              </h3>
              {isOpen && currentRegister && (
                <p className="text-sm text-emerald-600">
                  Aberto às {formatDate(currentRegister.opened_at)}
                  {currentRegister.initial_amount > 0 && (
                    <> • Valor inicial: {formatCurrency(currentRegister.initial_amount)}</>
                  )}
                </p>
              )}
              {!isOpen && (
                <p className="text-sm text-crimson-600">
                  Abra o caixa para iniciar as vendas
                </p>
              )}
            </div>
          </div>
          <div>
            {isOpen ? (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsCloseModalOpen(true)}
                className="px-8 py-2.5 bg-crimson-500 hover:bg-crimson-600 text-white text-sm font-semibold leading-none rounded-xl shadow-lg transition-colors flex items-center justify-center gap-1 whitespace-nowrap"
              >
                <Lock className="w-5 h-5" />
                Fechar Caixa
              </motion.button>
            ) : (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpenModalOpen(true)}
                className="px-8 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold leading-none rounded-xl shadow-lg transition-colors flex items-center justify-center gap-1 whitespace-nowrap"
              >
                <Unlock className="w-5 h-5" />
                Abrir Caixa
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Recebido Hoje</p>
              <p className="font-bold text-emerald-600">{formatCurrency(totalPaid)}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Pendente</p>
              <p className="font-bold text-amber-600">{formatCurrency(totalPending)}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Pix</p>
              <p className="font-bold text-slate-900">{formatCurrency(byPaymentMethod.pix || 0)}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Banknote className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Dinheiro</p>
              <p className="font-bold text-slate-900">{formatCurrency(byPaymentMethod.dinheiro || 0)}</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome ou nº do pedido..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-amber-500"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="min-w-0 flex-1 sm:flex-none px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-amber-500"
          >
          <option value="">Todos os Status</option>
          <option value="pendente">Pendente</option>
          <option value="em_preparo">Em Preparo</option>
          <option value="pronto">Pronto</option>
          <option value="entregue">Entregue</option>
          <option value="cancelado">Cancelado</option>
        </select>
          <button onClick={clearOrdersFromScreen} className="inline-flex shrink-0 items-center justify-center gap-1 rounded-xl bg-slate-800 px-5 py-2.5 text-xs font-medium leading-none text-white hover:bg-slate-700 whitespace-nowrap">
          <Trash2 className="h-4 w-4" /> Limpar tela
        </button>
        <select
          value={filterPayment}
          onChange={(e) => setFilterPayment(e.target.value)}
          className="min-w-0 flex-1 sm:flex-none px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-amber-500"
        >
          <option value="">Todos Pagamentos</option>
          <option value="pendente">Pendente</option>
          <option value="pago">Pago</option>
        </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Pedido</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Pagamento</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Total</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <motion.tr
                  key={order.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => { setSelectedOrder(order); setIsDetailOpen(true) }}
                >
                  <td className="px-4 py-3">
                    <span className="font-bold text-slate-900">#{order.order_number}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{order.customer_name}</p>
                      <p className="text-xs text-slate-500">{formatDate(order.created_at)}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex px-2.5 py-1 rounded-full text-xs font-medium border', getStatusColor(order.status))}>
                      {getStatusLabel(order.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'inline-flex px-2.5 py-1 rounded-full text-xs font-medium',
                      order.payment_status === 'pago' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    )}>
                      {order.payment_status === 'pago' ? 'Pago' : 'Pendente'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-900">{formatCurrency(Number(order.total))}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-[220px]" onClick={(e) => e.stopPropagation()}>
                      {order.payment_status === 'pendente' && (
                        <button
                          onClick={() => markAsPaid(order.id)}
                          className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium leading-none transition-colors flex items-center justify-center gap-1 whitespace-nowrap min-h-[28px]"
                        >
                          <Check className="w-3 h-3" /> Pago
                        </button>
                      )}
                      {order.status === 'pronto' && (
                        <button
                          onClick={() => markAsDelivered(order.id)}
                          className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-medium leading-none transition-colors flex items-center justify-center gap-1 whitespace-nowrap min-h-[28px]"
                        >
                          Entregue
                        </button>
                      )}
                      <button onClick={() => cancelOrder(order.id)} className="px-3 py-1.5 bg-crimson-500 hover:bg-crimson-600 text-white rounded-lg text-xs font-medium leading-none transition-colors flex items-center justify-center gap-1 whitespace-nowrap min-h-[28px]">
                        <XCircle className="w-3 h-3" /> Cancelar
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredOrders.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum pedido encontrado</p>
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      <Modal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title={selectedOrder ? `Pedido #${selectedOrder.order_number}` : ''}
      >
        {selectedOrder && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">Cliente</p>
                <p className="font-medium text-slate-900">{selectedOrder.customer_name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Telefone</p>
                <p className="font-medium text-slate-900">{selectedOrder.customer_phone || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Mesa/Endereço</p>
                <p className="font-medium text-slate-900">{selectedOrder.table_or_address || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Pagamento</p>
                <p className="font-medium text-slate-900">{getPaymentMethodLabel(selectedOrder.payment_method)}</p>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <p className="text-xs text-slate-500 mb-2">Itens</p>
              <div className="space-y-2">
                {selectedOrder.order_items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between bg-slate-50 rounded-xl p-3">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-amber-600">{item.quantity}x</span>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{item.products?.name}</p>
                        {item.notes && <p className="text-xs text-crimson-500">📝 {item.notes}</p>}
                      </div>
                    </div>
                    <p className="font-medium text-sm">{formatCurrency(Number(item.unit_price) * item.quantity)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4 flex items-center justify-between text-lg font-bold">
              <span>Total</span>
              <span className="text-amber-600">{formatCurrency(Number(selectedOrder.total))}</span>
            </div>

            <div className="flex gap-2">
              {selectedOrder.payment_status === 'pendente' && (
                <button
                  onClick={() => markAsPaid(selectedOrder.id)}
                  className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors"
                >
                  Marcar como Pago
                </button>
              )}
              {selectedOrder.status === 'pronto' && (
                <button
                  onClick={() => markAsDelivered(selectedOrder.id)}
                  className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors"
                >
                  Marcar como Entregue
                </button>
              )}
              <button onClick={() => cancelOrder(selectedOrder.id)} className="flex-1 py-2.5 bg-crimson-500 hover:bg-crimson-600 text-white rounded-xl font-medium transition-colors">Cancelar Pedido</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Open Register Modal */}
      <Modal
        isOpen={isOpenModalOpen}
        onClose={() => setIsOpenModalOpen(false)}
        title="Abrir Caixa"
      >
        <div className="space-y-6">
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Informe o valor inicial em caixa para começar o expediente.
          </p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Valor Inicial (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={initialAmount}
              onChange={(e) => setInitialAmount(e.target.value)}
              className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-xl text-lg font-bold focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 min-h-[56px]"
              placeholder="0,00"
            />
          </div>
          <button
            onClick={handleOpenRegister}
            disabled={registerLoading}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 text-base min-h-[56px]"
          >
            {registerLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
            ) : (
              <>
                <Unlock className="w-5 h-5" />
                Abrir Caixa
              </>
            )}
          </button>
        </div>
      </Modal>

      {/* Close Register Modal */}
      <Modal
        isOpen={isCloseModalOpen}
        onClose={() => setIsCloseModalOpen(false)}
        title="Fechar Caixa"
      >
        <div className="space-y-6">
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Informe o valor final em caixa para encerrar o expediente.
          </p>
          {currentRegister && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
              <div className="space-y-1">
                <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Valor inicial</span>
                <span className="block text-2xl font-bold text-slate-900">{formatCurrency(currentRegister.initial_amount)}</span>
              </div>
            </div>
          )}
          <div>
             <label className="block text-sm font-medium text-slate-700 mb-2">Valor Final (inicial + arrecadado)</label>
             <input
               type="number"
               step="0.01"
               min="0"
               value={(Number(currentRegister?.initial_amount || 0) + totalPaid).toFixed(2)}
               readOnly
               className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-xl text-lg font-bold focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 min-h-[56px]"
             />
             <p className="mt-2 text-xs sm:text-sm text-slate-500">
               {formatCurrency(Number(currentRegister?.initial_amount || 0))} inicial + {formatCurrency(totalPaid)} arrecadado hoje.
             </p>
          </div>
          <button
            onClick={handleCloseRegister}
            disabled={registerLoading}
            className="w-full py-4 bg-crimson-500 hover:bg-crimson-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 text-base min-h-[56px]"
          >
            {registerLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
            ) : (
              <>
                <Lock className="w-5 h-5" />
                Fechar Caixa
              </>
            )}
          </button>
        </div>
      </Modal>
    </Layout>
  )
}
