import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronRight, Clock3, ExternalLink, List, MapPin, MessageCircle, PackageCheck, Phone, UserRound, X } from 'lucide-react'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/utils'
import type { Database } from '../lib/supabase'

type Order = Database['public']['Tables']['orders']['Row']
type OrderItem = Database['public']['Tables']['order_items']['Row'] & { products: { name: string } | null }

export default function Driver() {
  const [orders, setOrders] = useState<Order[]>([])
  const [selected, setSelected] = useState<Order | null>(null)
  const [finishing, setFinishing] = useState(false)
  const [finished, setFinished] = useState(false)
  const [slideValue, setSlideValue] = useState(0)
  const [selectedItems, setSelectedItems] = useState<OrderItem[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)

  useEffect(() => {
    loadOrders()
    const channel = supabase.channel('driver-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, loadOrders)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function loadOrders() {
    const { data } = await supabase.from('orders').select('*').eq('status', 'pronto').eq('archived', false).order('created_at')
    if (data) {
      setOrders(data)
      setSelected((current) => current ? data.find((order) => order.id === current.id) || current : null)
    }
  }

  function openOrder(order: Order) {
    setSelected(order)
    setFinished(false)
    setSlideValue(0)
    setSelectedItems([])
    setItemsLoading(true)
    supabase.from('order_items').select('*, products(name)').eq('order_id', order.id).then(({ data }) => {
      setSelectedItems((data as OrderItem[]) || [])
      setItemsLoading(false)
    })
  }

  function openMaps(address: string | null) {
    if (!address?.trim()) {
      toast.error('Este pedido não possui endereço informado')
      return
    }
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${address}, Brasil`)}`, '_blank', 'noopener,noreferrer')
  }

  function openWhatsApp(phone: string | null) {
    const number = phone?.replace(/\D/g, '')
    if (!number) {
      toast.error('Este pedido não possui telefone informado')
      return
    }
    window.open(`https://wa.me/${number}`, '_blank', 'noopener,noreferrer')
  }

  async function finishOrder() {
    if (!selected || finishing || finished) return
    setFinishing(true)
    const { error } = await supabase.from('orders').update({ status: 'entregue' }).eq('id', selected.id).eq('status', 'pronto')
    if (error) {
      toast.error('Não foi possível finalizar a entrega')
      setFinishing(false)
      return
    }
    setFinished(true)
    toast.success(`Pedido #${selected.order_number} finalizado e baixado no sistema`)
    window.setTimeout(() => {
      setOrders((current) => current.filter((order) => order.id !== selected.id))
      setSelected(null)
      setFinishing(false)
    }, 1100)
  }

  return (
    <Layout title="Minhas Entregas">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-[#14917a]">Rota de hoje</p>
            <h2 className="text-2xl font-black tracking-tight text-slate-950">Minhas entregas</h2>
            <p className="mt-1 text-sm text-slate-500">Toque em um pedido para ver os detalhes.</p>
          </div>
          <div className="rounded-2xl bg-white px-4 py-3 text-right shadow-sm ring-1 ring-slate-200">
            <p className="text-2xl font-black text-slate-900">{orders.length}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">em rota</p>
          </div>
        </div>
        <div className="mb-5 flex items-center gap-2 rounded-2xl border border-[#b8e8dd] bg-[#e9faf6] px-4 py-3 text-sm font-medium text-[#087461]">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#14917a]" /> Status sincronizado em tempo real
        </div>
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {orders.map((order) => (
              <motion.button key={order.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ x: 240, opacity: 0 }} onClick={() => openOrder(order)} className="group flex w-full items-center gap-4 rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-[#8bd8c9] hover:shadow-md">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#e9faf6] text-[#14917a]"><PackageCheck className="h-7 w-7" /></div>
                <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="font-black text-slate-900">#{order.order_number}</span><span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold uppercase text-amber-700">Pronto</span></div><p className="mt-1 truncate text-sm font-semibold text-slate-700">{order.customer_name}</p><p className="mt-1 flex items-center gap-1 truncate text-xs text-slate-400"><MapPin className="h-3.5 w-3.5" /> {order.table_or_address || 'Endereço não informado'}</p></div>
                <ChevronRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-[#14917a]" />
              </motion.button>
            ))}
          </AnimatePresence>
          {orders.length === 0 && <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><Check className="mx-auto mb-3 h-10 w-10 rounded-full bg-[#e9faf6] p-2 text-[#14917a]" /><p className="font-bold text-slate-800">Tudo entregue por aqui</p><p className="mt-1 text-sm text-slate-500">Novos pedidos aparecem automaticamente.</p></div>}
        </div>
      </div>
      <AnimatePresence>
        {selected && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm" onClick={() => !finishing && setSelected(null)}>
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28 }} onClick={(event) => event.stopPropagation()} className="absolute bottom-0 left-0 right-0 mx-auto max-h-[92dvh] max-w-2xl overflow-y-auto rounded-t-[2rem] bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl">
            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-slate-200" />
            <button onClick={() => setSelected(null)} disabled={finishing} className="absolute right-4 top-4 rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            {finished ? <div className="flex min-h-[330px] flex-col items-center justify-center text-center"><motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><Check className="h-10 w-10" strokeWidth={3} /></motion.div><h3 className="text-xl font-black text-slate-900">Entrega concluída com sucesso!</h3><p className="mt-2 text-sm text-slate-500">O caixa foi atualizado automaticamente.</p></div> : <><div className="mb-6"><p className="text-xs font-bold uppercase tracking-widest text-[#14917a]">Detalhes da entrega</p><div className="flex items-center gap-3"><h3 className="mt-1 text-3xl font-black text-slate-950">#{selected.order_number}</h3><span className={`mt-2 rounded-full px-2.5 py-1 text-xs font-bold ${selected.payment_status === 'pago' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{selected.payment_status === 'pago' ? 'Pago' : 'Pagamento pendente'}</span></div></div><div className="space-y-3"><div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4"><UserRound className="h-5 w-5 text-[#14917a]" /><div><p className="text-xs text-slate-400">Cliente</p><p className="font-bold text-slate-800">{selected.customer_name}</p></div><div className="ml-auto flex gap-2"><button onClick={() => openWhatsApp(selected.customer_phone)} disabled={!selected.customer_phone?.trim()} className="rounded-xl bg-[#25d366] p-3 text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"><MessageCircle className="h-4 w-4" /></button><a href={`tel:${selected.customer_phone}`} className="rounded-xl bg-white p-3 text-[#14917a] shadow-sm"><Phone className="h-4 w-4" /></a></div></div><div className="rounded-2xl bg-slate-50 p-4"><div className="mb-3 flex items-center gap-2"><List className="h-5 w-5 text-[#14917a]" /><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Resumo do pedido</p></div>{itemsLoading ? <div className="h-12 animate-pulse rounded-xl bg-slate-200" /> : selectedItems.length > 0 ? <div className="space-y-2">{selectedItems.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate text-slate-700"><strong className="mr-2 text-[#14917a]">{item.quantity}x</strong>{item.products?.name || 'Produto'}</span><span className="shrink-0 font-semibold text-slate-600">{formatCurrency(Number(item.unit_price) * item.quantity)}</span></div>)}</div> : <p className="text-sm text-slate-500">Itens não informados</p>}<div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3"><span className="text-sm font-semibold text-slate-500">Total do pedido</span><strong className="text-xl text-slate-900">{formatCurrency(Number(selected.total))}</strong></div></div><div className="rounded-2xl bg-slate-50 p-4"><div className="flex items-start gap-3"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#14917a]" /><div className="min-w-0"><p className="text-xs text-slate-400">Endereço de entrega</p><p className="font-bold text-slate-800 break-words">{selected.table_or_address || 'Endereço não informado'}</p></div></div><button onClick={() => openMaps(selected.table_or_address)} disabled={!selected.table_or_address?.trim()} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0c6f63] px-4 text-sm font-bold text-white transition hover:bg-[#09594f] disabled:cursor-not-allowed disabled:opacity-50"><ExternalLink className="h-4 w-4" /> Abrir rota no Google Maps</button></div></div><div className="mt-6"><p className="mb-3 text-center text-xs font-medium text-slate-400">Deslize para confirmar e evitar baixas acidentais</p><div className="relative h-14 overflow-hidden rounded-2xl bg-[#0c6f63]"><motion.div drag="x" dragConstraints={{ left: 0, right: 250 }} dragElastic={0} onDrag={(_, info) => setSlideValue(Math.max(0, Math.min(100, info.offset.x / 2.5)))} onDragEnd={(_, info) => { if (info.offset.x > 190) finishOrder(); else setSlideValue(0) }} className="absolute inset-y-1 left-1 z-10 flex w-16 cursor-grab items-center justify-center rounded-xl bg-white text-[#0c6f63] shadow-lg active:cursor-grabbing"><ChevronRight className="h-6 w-6" /></motion.div><div className="flex h-full items-center justify-center gap-2 text-sm font-bold text-white"><span style={{ opacity: 1 - slideValue / 130 }}>Deslize para finalizar</span></div></div><button onClick={finishOrder} disabled={finishing} className="mt-3 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[#14917a] text-base font-black text-white shadow-lg shadow-[#14917a]/25 transition hover:bg-[#0d7c67] disabled:opacity-70">{finishing ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <><PackageCheck className="h-5 w-5" /> Finalizar Entrega</>}</button></div></>}
          </motion.div>
        </motion.div>}
      </AnimatePresence>
    </Layout>
  )
}
