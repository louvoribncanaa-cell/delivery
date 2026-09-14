import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, Check, Flame, Archive, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { notifyOrderReady } from '../lib/webhook'
import { formatCurrency, getElapsedTime, cn } from '../lib/utils'
import type { Database } from '../lib/supabase'

type Order = Database['public']['Tables']['orders']['Row']
type OrderItem = Database['public']['Tables']['order_items']['Row'] & {
  products: { name: string } | null
}

interface OrderWithItems extends Order {
  order_items: OrderItem[]
}

const statusColumns = [
  { key: 'pendente', label: 'Pendente', icon: <Clock className="w-5 h-5" />, color: 'amber' },
  { key: 'em_preparo', label: 'Em Preparo', icon: <Flame className="w-5 h-5" />, color: 'blue' },
  { key: 'pronto', label: 'Pronto', icon: <Check className="w-5 h-5" />, color: 'emerald' },
] as const

export default function Kitchen() {
  const [orders, setOrders] = useState<OrderWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const audioContextRef = useRef<AudioContext | null>(null)
  const fetchSequenceRef = useRef(0)

  function getAudioContext(): AudioContext | null {
    try {
      const AudioContextClass = window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioContextClass) return null
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass()
      }
      return audioContextRef.current
    } catch {
      return null
    }
  }

  // Navegadores bloqueiam áudio sem gesto do usuário: primeiro toque/tecla libera
  useEffect(() => {
    function unlockAudio() {
      const ctx = getAudioContext()
      if (!ctx) return
      void ctx.resume().catch(() => {})
    }
    window.addEventListener('pointerdown', unlockAudio)
    window.addEventListener('keydown', unlockAudio)
    return () => {
      window.removeEventListener('pointerdown', unlockAudio)
      window.removeEventListener('keydown', unlockAudio)
    }
  }, [])

  async function playNewOrderAlert() {
    try {
      const audioContext = getAudioContext()
      if (!audioContext) return

      if (audioContext.state === 'suspended') {
        try {
          await audioContext.resume()
        } catch {
          return
        }
      }
      if (audioContext.state !== 'running') return

      // Som de cogumelo do Mario: arpejo ascendente em onda quadrada
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98, 2093.0]
      const noteDuration = 0.09
      const startTime = audioContext.currentTime + 0.05

      notes.forEach((frequency, index) => {
        const oscillator = audioContext.createOscillator()
        const gain = audioContext.createGain()
        const noteStart = startTime + index * noteDuration
        oscillator.type = 'square'
        oscillator.frequency.value = frequency
        gain.gain.setValueAtTime(0.0001, noteStart)
        gain.gain.exponentialRampToValueAtTime(0.22, noteStart + 0.015)
        gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + noteDuration)
        oscillator.connect(gain)
        gain.connect(audioContext.destination)
        oscillator.start(noteStart)
        oscillator.stop(noteStart + noteDuration + 0.02)
      })
    } catch (error) {
      console.warn('Não foi possível reproduzir o alerta sonoro:', error)
    }
  }


  useEffect(() => {
    fetchOrders()

    // Realtime: escuta todas as mudanças na tabela orders
    const channel = supabase
      .channel('kitchen-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          // REMOVE imediatamente da tela se cancelado, arquivado, ou entregue
          if (payload.eventType === 'UPDATE') {
            const newOrder = payload.new as Order
            if (newOrder.status === 'cancelado' || newOrder.archived || newOrder.status === 'entregue') {
              setOrders((current) => current.filter((o) => o.id !== newOrder.id))
              return
            }
            // Se mudou de status dentro das colunas visíveis, atualiza localmente
            if (['pendente', 'em_preparo', 'pronto'].includes(newOrder.status)) {
              setOrders((current) =>
                current.map((o) => o.id === newOrder.id ? { ...o, status: newOrder.status as Order['status'] } : o)
              )
            }
          }

          // REMOVE se DELETE direto no banco
          if (payload.eventType === 'DELETE') {
            setOrders((current) => current.filter((o) => o.id !== payload.old.id))
            return
          }

          // Novo pedido: busca todos para garantir dados completos com items
          if (payload.eventType === 'INSERT') {
            void playNewOrderAlert()
            toast('Novo pedido recebido!', { icon: '🔔' })
            fetchOrders()
            return
          }

          // Qualquer outra mudança: refaz a lista completa
          fetchOrders()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function fetchOrders() {
    const requestSequence = ++fetchSequenceRef.current
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
        .in('status', ['pendente', 'em_preparo', 'pronto'])
        .eq('archived', false)
        .order('created_at', { ascending: true })

      if (error) throw error
      if (requestSequence === fetchSequenceRef.current) {
        setOrders((data as OrderWithItems[]) || [])
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoading(false)
    }
  }

  async function updateOrderStatus(orderId: string, newStatus: string) {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId)

      if (error) throw error
      toast.success(`Pedido atualizado para ${newStatus === 'em_preparo' ? 'Em Preparo' : 'Pronto'}`)

      // Cozinha marcou como pronto + pedido tem telefone => avisa o n8n (não bloqueia a tela se falhar)
      if (newStatus === 'pronto') {
        const readyOrder = orders.find((o) => o.id === orderId)
        if (readyOrder) {
          void notifyOrderReady(readyOrder).then((sent) => {
            if (sent) toast.success('Cliente avisado via WhatsApp!', { icon: '📲' })
          })
        }
      }
    } catch (error) {
      toast.error('Erro ao atualizar pedido')
      console.error(error)
    }
  }

  async function archiveOrder(orderId: string) {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ archived: true })
        .eq('id', orderId)

      if (error) throw error
      toast.success('Pedido arquivado')
    } catch (error) {
      toast.error('Não foi possível arquivar o pedido')
    }
  }

  async function cancelOrder(orderId: string) {
    if (!confirm('Cancelar este pedido?')) return
    try {
      const { data, error } = await supabase.rpc('kitchen_cancel_order', { p_order_id: orderId })
      if (error) throw error
      const result = data as { success: boolean; error?: string }
      if (!result.success) {
        toast.error(result.error || 'Não foi possível cancelar o pedido')
        return
      }
      toast.success('Pedido cancelado')
    } catch (error) {
      toast.error('Não foi possível cancelar o pedido')
      console.error(error)
    }
  }

  function getOrdersForStatus(status: string) {
    return orders.filter((o) => o.status === status)
  }

  if (loading) {
    return (
      <Layout title="Cozinha">
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber-500 border-t-transparent" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Cozinha">
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 lg:mx-0 lg:px-0 h-[calc(100vh-120px)]">
        {statusColumns.map((col) => {
          const colOrders = getOrdersForStatus(col.key)
          return (
            <div key={col.key} className="flex-1 min-w-[300px]">
              <div className={cn(
                'flex items-center gap-2 px-4 py-3 rounded-xl mb-4',
                col.color === 'amber' && 'bg-amber-100 text-amber-800',
                col.color === 'blue' && 'bg-blue-100 text-blue-800',
                col.color === 'emerald' && 'bg-emerald-100 text-emerald-800'
              )}>
                {col.icon}
                <h2 className="font-bold text-sm">{col.label}</h2>
                <span className="ml-auto bg-white/50 px-2 py-0.5 rounded-full text-xs font-bold">
                  {colOrders.length}
                </span>
              </div>

              <div className="space-y-3">
                <AnimatePresence>
                  {colOrders.map((order) => (
                    <motion.div
                      key={order.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -100 }}
                      className={cn(
                        'bg-white rounded-2xl border shadow-sm overflow-hidden',
                        order.status === 'pendente' && 'border-amber-300 animate-pulse-glow',
                        order.status === 'em_preparo' && 'border-blue-300',
                        order.status === 'pronto' && 'border-emerald-300'
                      )}
                    >
                      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                        <div>
                          <span className="text-xs text-slate-500">Pedido</span>
                          <p className="font-bold text-slate-900">#{order.order_number}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-slate-500">Tempo</span>
                          <p className={cn(
                            'font-bold',
                            order.status === 'pendente' && 'text-amber-600',
                            order.status === 'em_preparo' && 'text-blue-600',
                            order.status === 'pronto' && 'text-emerald-600'
                          )}>
                            {getElapsedTime(order.created_at)}
                          </p>
                        </div>
                      </div>

                      <div className="px-4 py-3">
                        <p className="text-sm text-slate-600 mb-1">
                          <span className="font-medium">{order.customer_name}</span>
                          {order.table_or_address && (
                            <span className="text-slate-400"> — {order.table_or_address}</span>
                          )}
                        </p>

                        <div className="space-y-1.5 mt-2">
                          {order.order_items.map((item) => (
                            <div key={item.id} className="flex items-start gap-2 text-sm">
                              <span className="font-bold text-amber-600 min-w-[24px]">{item.quantity}x</span>
                              <div className="flex-1">
                                <span className="text-slate-800">{item.products?.name}</span>
                                {item.notes && (
                                  <p className="text-xs text-crimson-500 mt-0.5">{item.notes}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                       <div className="space-y-2 px-4 py-3 border-t border-slate-100 bg-slate-50">
                        {order.status === 'pendente' && (
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => updateOrderStatus(order.id, 'em_preparo')}
                            className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors"
                          >
                            <Flame className="w-4 h-4" />
                            Iniciar Preparo
                          </motion.button>
                        )}
                        {order.status === 'em_preparo' && (
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => updateOrderStatus(order.id, 'pronto')}
                            className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors"
                          >
                            <Check className="w-4 h-4" />
                            Marcar como Pronto
                          </motion.button>
                        )}
                         {order.status === 'pronto' && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-emerald-600 font-medium text-sm justify-center">
                              <Check className="w-4 h-4" />
                              Aguardando Retirada
                            </div>
                            <button
                              onClick={() => archiveOrder(order.id)}
                              className="w-full py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors"
                            >
                              <Archive className="w-4 h-4" />
                              Arquivar pedido
                            </button>
                          </div>
                         )}
                         <button
                           onClick={() => cancelOrder(order.id)}
                           className="w-full py-2 text-crimson-600 hover:bg-crimson-50 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors"
                         >
                           <XCircle className="w-4 h-4" /> Cancelar pedido
                         </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {colOrders.length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-sm">
                    Nenhum pedido
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Layout>
  )
}
