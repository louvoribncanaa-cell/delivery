import { useEffect, useState } from 'react'
import { BarChart3, Lock, Unlock, WalletCards, History as HistoryIcon, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import { useCashRegister } from '../contexts/CashRegisterContext'
import { supabase } from '../lib/supabase'
import { formatCurrency, formatDate } from '../lib/utils'
import type { Database } from '../lib/supabase'

type Register = Database['public']['Tables']['cash_register']['Row']
type Order = Database['public']['Tables']['orders']['Row']

export default function CashManagement() {
  const { isOpen, currentRegister, openRegister, closeRegister } = useCashRegister()
  const [orders, setOrders] = useState<Order[]>([])
  const [history, setHistory] = useState<Register[]>([])
  const [openModal, setOpenModal] = useState(false)
  const [closeModal, setCloseModal] = useState(false)
  const [initialAmount, setInitialAmount] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadData() {
    const [ordersResult, historyResult] = await Promise.all([
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('cash_register').select('*').eq('status', 'closed').order('closed_at', { ascending: false }).limit(8),
    ])
    if (ordersResult.data) setOrders(ordersResult.data)
    if (historyResult.data) setHistory(historyResult.data)
  }

  useEffect(() => { loadData() }, [])

  const today = orders.filter((order) => new Date(order.created_at).toDateString() === new Date().toDateString() && order.status !== 'cancelado')
  const received = today.filter((order) => order.payment_status === 'pago').reduce((sum, order) => sum + Number(order.total), 0)
  const pending = today.filter((order) => order.payment_status !== 'pago').reduce((sum, order) => sum + Number(order.total), 0)
  const gross = today.reduce((sum, order) => sum + Number(order.total), 0)
  const cashReceived = today.filter((order) => order.payment_status === 'pago' && order.payment_method === 'dinheiro').reduce((sum, order) => sum + Number(order.total), 0)
  const expectedCash = Number(currentRegister?.initial_amount || 0) + cashReceived

  async function handleOpen() {
    setSaving(true)
    const result = await openRegister(Number(initialAmount) || 0)
    if (result.error) toast.error(result.error)
    else { toast.success('Caixa aberto com sucesso'); setOpenModal(false); setInitialAmount('') }
    setSaving(false)
  }

  async function handleClose() {
    setSaving(true)
    const result = await closeRegister(expectedCash)
    if (result.error) toast.error(result.error)
    else { toast.success('Caixa fechado com sucesso'); setCloseModal(false); await loadData() }
    setSaving(false)
  }

  return (
    <Layout title="Gestão de Caixa">
      <div className="mb-6 flex flex-col justify-between gap-4 rounded-3xl bg-slate-900 p-6 text-white sm:flex-row sm:items-center">
        <div><p className="text-sm text-slate-300">Central financeira</p><h1 className="mt-1 text-2xl font-extrabold">Gestão de Caixa</h1><p className="mt-1 text-sm text-slate-400">Controle de turnos, conferência e fechamentos</p></div>
        <button onClick={() => isOpen ? setCloseModal(true) : setOpenModal(true)} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 font-bold ${isOpen ? 'bg-rose-500 hover:bg-rose-600' : 'bg-teal-500 hover:bg-teal-600'}`}>
          {isOpen ? <><Lock className="h-5 w-5" /> Fechar caixa</> : <><Unlock className="h-5 w-5" /> Abrir caixa</>}
        </button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[['Faturamento bruto', gross, TrendingUp], ['Recebido', received, WalletCards], ['Pendente', pending, BarChart3], ['Dinheiro esperado', expectedCash, WalletCards]].map(([label, value, Icon]) => {
          const CardIcon = Icon as typeof TrendingUp
          return <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><CardIcon className="mb-3 h-5 w-5 text-teal-600" /><p className="text-xs font-semibold text-slate-500">{String(label)}</p><p className="mt-1 text-xl font-extrabold text-slate-900">{formatCurrency(Number(value))}</p></div>
        })}
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Resumo do turno</p><h2 className="mt-1 text-lg font-extrabold text-slate-900">Operação de hoje</h2></div><span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">{today.length} pedidos</span></div><div className="space-y-3 text-sm"><div className="flex justify-between border-b border-slate-100 pb-3"><span className="text-slate-500">Ticket médio</span><strong>{formatCurrency(today.length ? gross / today.length : 0)}</strong></div><div className="flex justify-between border-b border-slate-100 pb-3"><span className="text-slate-500">Abertura</span><strong>{currentRegister ? formatDate(currentRegister.opened_at) : 'Caixa fechado'}</strong></div><div className="flex justify-between"><span className="text-slate-500">Saldo inicial</span><strong>{formatCurrency(Number(currentRegister?.initial_amount || 0))}</strong></div></div></section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><HistoryIcon className="h-5 w-5 text-slate-500" /><h2 className="text-lg font-extrabold text-slate-900">Últimos fechamentos</h2></div>{history.length ? <div className="space-y-2">{history.map((register) => <div key={register.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3"><span className="text-xs text-slate-500">{register.closed_at ? formatDate(register.closed_at) : '-'}</span><strong className="text-sm">{formatCurrency(Number(register.final_amount || 0))}</strong></div>)}</div> : <p className="py-6 text-sm text-slate-400">Nenhum fechamento registrado.</p>}</section>
      </div>

      <Modal isOpen={openModal} onClose={() => setOpenModal(false)} title="Abrir Caixa"><div className="space-y-5"><input type="number" min="0" step="0.01" value={initialAmount} onChange={(event) => setInitialAmount(event.target.value)} placeholder="Saldo inicial" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-lg font-bold" /><button onClick={handleOpen} disabled={saving} className="w-full rounded-xl bg-teal-600 py-4 font-bold text-white disabled:opacity-50">{saving ? 'Abrindo...' : 'Confirmar abertura'}</button></div></Modal>
      <Modal isOpen={closeModal} onClose={() => setCloseModal(false)} title="Fechar Caixa"><div className="space-y-5"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Valor esperado em dinheiro</p><strong className="text-2xl">{formatCurrency(expectedCash)}</strong></div><button onClick={handleClose} disabled={saving} className="w-full rounded-xl bg-rose-500 py-4 font-bold text-white disabled:opacity-50">{saving ? 'Fechando...' : 'Confirmar fechamento'}</button></div></Modal>
    </Layout>
  )
}
