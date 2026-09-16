import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, ShoppingCart, Plus, Minus, Trash2, Send, X, XCircle, QrCode
} from 'lucide-react'
import toast from 'react-hot-toast'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import CashierClosed from '../components/CashierClosed'
import PixQRCode from '../components/PixQRCode'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useCashRegister } from '../contexts/CashRegisterContext'
import { formatCurrency, cn } from '../lib/utils'
import { usePixConfig, buildPixPayload, defaultTxid } from '../lib/pix'
import type { Database } from '../lib/supabase'

type Product = Database['public']['Tables']['products']['Row']
type Category = Database['public']['Tables']['categories']['Row']
type Order = Database['public']['Tables']['orders']['Row']

interface CartItem {
  product: Product
  quantity: number
  notes: string
}

interface PixPayment {
  orderId: string
  orderNumber: number
  amount: number
  payload: string
  qrCodeBase64?: string
}

function createOrderId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.random() * 16 | 0
    const value = character === 'x' ? random : (random & 0x3 | 0x8)
    return value.toString(16)
  })
}

export default function Orders() {
  const { profile, user } = useAuth()
  const { isOpen: isCashRegisterOpen, loading: registerLoading } = useCashRegister()
  const { config: pixConfig, loading: pixConfigLoading } = usePixConfig()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [tableOrAddress, setTableOrAddress] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<Database['public']['Tables']['orders']['Insert']['payment_method']>('pix')
  const [submitting, setSubmitting] = useState(false)
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [pixPayment, setPixPayment] = useState<PixPayment | null>(null)

  useEffect(() => {
    fetchCategories()
    fetchProducts()
    fetchRecentOrders()

    const channel = supabase
      .channel('attendant-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchRecentOrders()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function fetchCategories() {
    const { data } = await supabase.from('categories').select('*').eq('active', true).order('name')
    if (data) setCategories(data)
  }

  async function fetchProducts() {
    const { data } = await supabase.from('products').select('*').eq('available', true).order('name')
    if (data) setProducts(data)
  }

  async function fetchRecentOrders() {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .in('status', ['pendente', 'em_preparo'])
      .eq('archived', false)
      .order('created_at', { ascending: false })
      .limit(5)
    if (data) setRecentOrders(data)
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
      fetchRecentOrders()
      toast.success('Pedido cancelado')
    } catch (error) {
      toast.error('Não foi possível cancelar o pedido')
      console.error(error)
    }
  }

  const filteredProducts = products.filter((p) => {
    const matchesCategory = !selectedCategory || p.category_id === selectedCategory
    const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase())
    return matchesCategory && matchesSearch
  })

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id)
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      }
      return [...prev, { product, quantity: 1, notes: '' }]
    })
    toast.success(`${product.name} adicionado!`)
  }

  function updateQuantity(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((item) =>
          item.product.id === productId ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item
        )
        .filter((item) => item.quantity > 0)
    )
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((item) => item.product.id !== productId))
  }

  function updateItemNotes(productId: string, notes: string) {
    setCart((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, notes } : item))
    )
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  const pixPreviewPayload = useMemo(() => {
    if (paymentMethod !== 'pix' || cartTotal <= 0 || !pixConfig) return null
    const result = buildPixPayload({
      keyType: pixConfig.key_type,
      pixKey: pixConfig.pix_key,
      merchantName: pixConfig.merchant_name,
      merchantCity: pixConfig.merchant_city,
      amount: cartTotal,
      txid: '***',
    })
    return result.payload
  }, [paymentMethod, cartTotal, pixConfig])

  async function submitOrder() {
    if (!customerName.trim()) {
      toast.error('Informe o nome do cliente')
      return
    }
    if (cart.length === 0) {
      toast.error('Adicione itens ao pedido')
      return
    }

    setSubmitting(true)
    try {
      const total = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
      const authorId = user?.id ?? profile?.id ?? null
      const orderId = createOrderId()

      let pixPayload: string | null = null
      if (paymentMethod === 'pix') {
        if (!pixConfig || !pixConfig.active) {
          toast('Pix não configurado — pedido será enviado sem QR Code', { icon: '⚠️' })
        } else {
          const result = buildPixPayload({
            keyType: pixConfig.key_type,
            pixKey: pixConfig.pix_key,
            merchantName: pixConfig.merchant_name,
            merchantCity: pixConfig.merchant_city,
            amount: total,
            txid: defaultTxid(orderId),
          })
          if (!result.payload) {
            toast('Não foi possível gerar QR Code Pix — pedido enviado sem ele', { icon: '⚠️' })
          } else {
            pixPayload = result.payload
          }
        }
      }

      const baseData = {
        id: orderId,
        customer_name: customerName,
        customer_phone: customerPhone,
        table_or_address: tableOrAddress,
        total,
        payment_method: paymentMethod,
        payment_status: 'pendente' as const,
        status: 'pendente' as const,
      }
      const pixData = pixPayload
        ? {
            pix_copy_paste: pixPayload,
            pix_txid: defaultTxid(orderId),
            pix_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            created_by: authorId,
          }
        : { created_by: authorId }

      let order: { id: string; order_number: number } | null = null
      const firstAttempt = await supabase
        .from('orders')
        .insert({ ...baseData, ...pixData })
        .select()
        .single()

      if (firstAttempt.error) {
        const message = String(firstAttempt.error.message || '').toLowerCase()
        const missingColumn = message.includes('created_by') || message.includes('pix_copy_paste')
        if (!missingColumn) throw firstAttempt.error
        const retry = await supabase
          .from('orders')
          .insert(baseData)
          .select()
          .single()
        if (retry.error) throw retry.error
        order = retry.data
      } else {
        order = firstAttempt.data
      }

      if (!order) throw new Error('Pedido não retornado')

      const orderItems = cart.map((item) => ({
        order_id: order.id,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.price,
        notes: item.notes,
      }))

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems)
      if (itemsError) throw itemsError

      toast.success('Pedido enviado com sucesso!', { icon: '🔥' })

      if (paymentMethod === 'pix' && pixPayload) {
        let qrCodeBase64: string | undefined
        try {
          const { data: gwData, error: gwError } = await supabase.functions.invoke(
            'create-pix-payment',
            { body: { order_id: order.id } }
          )
          if (!gwError && gwData?.qr_code_base64) {
            qrCodeBase64 = gwData.qr_code_base64
          }
        } catch {
          // Gateway não configurado ou erro
        }

        setPixPayment({
          orderId: order.id,
          orderNumber: order.order_number,
          amount: total,
          payload: pixPayload,
          qrCodeBase64,
        })
      }

      setCart([])
      setCustomerName('')
      setCustomerPhone('')
      setTableOrAddress('')
      setIsCartOpen(false)
      fetchRecentOrders()
    } catch (error) {
      toast.error('Erro ao enviar pedido')
      console.error(error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Layout title="Novo Pedido">
      {!registerLoading && !isCashRegisterOpen && (
        <CashierClosed pageName="Pedidos" />
      )}

      {registerLoading && (
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber-500 border-t-transparent" />
        </div>
      )}

      {!registerLoading && isCashRegisterOpen && (
        <>
          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar produtos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all shadow-sm"
              />
            </div>
          </div>

          {/* Categories horizontal scroll */}
          <div className="mb-5 -mx-3 overflow-x-auto px-3 pb-3 sm:-mx-4 sm:px-4">
            <div className="flex min-w-max gap-1.5">
              <button
                onClick={() => setSelectedCategory('')}
                className={cn(
                  'min-h-8 min-w-[76px] px-2.5 py-1 rounded-md text-xs font-semibold transition-all whitespace-nowrap text-center',
                  !selectedCategory
                    ? 'bg-amber-500 text-white shadow-md'
                    : 'bg-blue-600 text-white border border-blue-700 shadow-sm hover:bg-blue-700'
                )}
              >
                Todos
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    'min-h-8 min-w-[76px] px-2.5 py-1 rounded-md text-xs font-semibold transition-all whitespace-nowrap text-center',
                    selectedCategory === cat.id
                      ? 'bg-amber-500 text-white shadow-md'
                      : 'bg-blue-600 text-white border border-blue-700 shadow-sm hover:bg-blue-700'
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Products List */}
          <div className="space-y-3">
            {filteredProducts.map((product) => {
              const cartItem = cart.find((c) => c.product.id === product.id)
              return (
                <motion.div
                  key={product.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex gap-4"
                >
                  <div className="w-20 h-20 bg-slate-100 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl">🍔</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900">{product.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{product.description}</p>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-amber-600 font-bold">{formatCurrency(product.price)}</p>
                    {cartItem ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(product.id, -1)}
                          className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="font-bold text-sm w-6 text-center">{cartItem.quantity}</span>
                        <button
                          onClick={() => updateQuantity(product.id, 1)}
                          className="w-8 h-8 rounded-lg bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => addToCart(product)}
                        className="py-1.5 px-3 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 bg-amber-500 text-white hover:bg-amber-600"
                      >
                        <Plus className="w-4 h-4" /> Adicionar
                      </button>
                    )}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <p className="text-lg">Nenhum produto encontrado</p>
            </div>
          )}

          {/* Pedidos Recentes */}
          {recentOrders.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700">Pedidos Recentes</h3>
                <button onClick={fetchRecentOrders} className="text-xs text-amber-600 hover:text-amber-700 font-medium">
                  Atualizar
                </button>
              </div>
              <div className="space-y-2">
                {recentOrders.map((order) => (
                  <div key={order.id} className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-900">#{order.order_number}</span>
                      <span className="text-sm text-slate-600">{order.customer_name}</span>
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-xs font-medium',
                        order.status === 'pendente' && 'bg-amber-100 text-amber-700',
                        order.status === 'em_preparo' && 'bg-blue-100 text-blue-700'
                      )}>
                        {order.status === 'pendente' ? 'Pendente' : 'Em Preparo'}
                      </span>
                    </div>
                    {order.status === 'pendente' && (
                      <button
                        onClick={() => cancelOrder(order.id)}
                        className="p-2 text-crimson-500 hover:bg-crimson-50 rounded-lg transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                    {order.status === 'em_preparo' && (
                      <span className="text-xs text-blue-500 font-medium px-2">Em preparo</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Floating Cart Button */}
          {cartItemCount > 0 && (
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              onClick={() => setIsCartOpen(true)}
               className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-40 flex items-center gap-3 rounded-2xl bg-amber-500 px-5 py-3.5 text-white shadow-2xl shadow-amber-500/40 transition-colors hover:bg-amber-600 sm:bottom-6 sm:right-6 sm:px-6 sm:py-4"
            >
              <ShoppingCart className="w-6 h-6" />
              <div className="text-left">
                <p className="text-xs opacity-80">{cartItemCount} {cartItemCount === 1 ? 'item' : 'itens'}</p>
                <p className="font-bold">{formatCurrency(cartTotal)}</p>
              </div>
            </motion.button>
          )}

          {/* Cart Drawer */}
          <AnimatePresence>
            {isCartOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                  onClick={() => setIsCartOpen(false)}
                />
                <motion.div
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                   className="safe-screen-padding fixed inset-y-0 left-0 right-0 z-50 flex h-[100dvh] min-w-0 flex-col overflow-x-hidden bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl sm:left-auto sm:h-auto sm:max-h-screen sm:overflow-hidden sm:w-[420px] sm:rounded-l-2xl"
                >
                   <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6 sm:py-5">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="w-5 h-5 text-amber-500" />
                      <h2 className="text-lg font-bold text-slate-900">Meu Pedido</h2>
                    </div>
                    <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                   <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4 sm:p-5">
                    {cart.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>Carrinho vazio</p>
                      </div>
                    ) : (
                      cart.map((item) => (
                        <motion.div
                          key={item.product.id}
                          layout
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 sm:p-3"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-12 h-12 bg-slate-200 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center">
                              {item.product.image_url ? (
                                <img src={item.product.image_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-xl">🍔</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-sm text-slate-900 truncate">{item.product.name}</h4>
                              <p className="text-amber-600 font-bold text-sm">{formatCurrency(item.product.price)}</p>
                            </div>
                            <button
                              onClick={() => removeFromCart(item.product.id)}
                              className="p-1.5 hover:bg-crimson-100 rounded-lg text-crimson-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updateQuantity(item.product.id, -1)}
                                className="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="font-bold text-sm w-6 text-center">{item.quantity}</span>
                              <button
                                onClick={() => updateQuantity(item.product.id, 1)}
                                className="w-8 h-8 rounded-lg bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                            <p className="font-bold text-sm">{formatCurrency(item.product.price * item.quantity)}</p>
                          </div>

                          <input
                            type="text"
                            placeholder="Observação..."
                            value={item.notes}
                            onChange={(e) => updateItemNotes(item.product.id, e.target.value)}
                            className="mt-3 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                          />
                        </motion.div>
                      ))
                    )}
                  </div>

                  {cart.length > 0 && (
                     <div className="shrink-0 space-y-3 border-t border-slate-200 bg-white px-5 py-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:p-5">
                      <input
                        type="text"
                        placeholder="Nome do cliente *"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:outline-none focus:border-amber-500"
                      />
                      <input
                        type="text"
                        placeholder="Telefone (opcional)"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:outline-none focus:border-amber-500"
                      />
                      <input
                        type="text"
                        placeholder="Mesa ou endereço"
                        value={tableOrAddress}
                        onChange={(e) => setTableOrAddress(e.target.value)}
                        className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:outline-none focus:border-amber-500"
                      />

                      <div>
                        <p className="mb-2 text-sm font-semibold text-slate-700">Forma de pagamento</p>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { value: 'pix', label: 'Pix', icon: '⚡' },
                            { value: 'cartao_credito', label: 'Cartão Crédito', icon: '💳' },
                            { value: 'cartao_debito', label: 'Cartão Débito', icon: '💳' },
                            { value: 'dinheiro', label: 'Dinheiro', icon: '💵' },
                          ].map((method) => (
                            <button
                              key={method.value}
                              onClick={() => setPaymentMethod(method.value as typeof paymentMethod)}
                              className={cn(
                                'flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-sm font-medium transition-all',
                                paymentMethod === method.value
                                  ? 'bg-amber-500 text-white border-amber-500'
                                  : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'
                              )}
                            >
                              <span className="text-sm leading-none" aria-hidden="true">{method.icon}</span>
                              <span className="truncate">{method.label}</span>
                            </button>
                          ))}
                        </div>

                        {pixConfigLoading ? (
                          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                            <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-amber-500 border-t-transparent" />
                            Carregando configuração Pix...
                          </div>
                        ) : paymentMethod === 'pix' && pixPreviewPayload ? (
                          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                              <QrCode className="h-4 w-4 text-amber-500" />
                              Prévia do QR Code Pix (atualizada com o valor do pedido)
                            </div>
                            <PixQRCode payload={pixPreviewPayload} amount={cartTotal} compact showInstructions={false} />
                          </div>
                        ) : paymentMethod === 'pix' ? (
                          <p className="mt-3 text-xs text-crimson-500">
                            Chave Pix não configurada. Peça ao administrador para cadastrá-la.
                          </p>
                        ) : null}
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-100 pt-1 text-xl font-bold">
                        <span>Total</span>
                        <span className="text-amber-600">{formatCurrency(cartTotal)}</span>
                      </div>

                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={submitOrder}
                        disabled={submitting || !customerName.trim()}
                        className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {submitting ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                        ) : (
                          <>
                            <Send className="w-5 h-5" />
                            Enviar para Cozinha
                          </>
                        )}
                      </motion.button>
                    </div>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Pix Payment Modal */}
          <Modal
            isOpen={!!pixPayment}
            onClose={() => setPixPayment(null)}
            title={pixPayment ? `Pagamento Pix - Pedido #${pixPayment.orderNumber}` : ''}
          >
            {pixPayment && (
              <PixQRCode
                payload={pixPayment.payload}
                qrCodeBase64={pixPayment.qrCodeBase64}
                amount={pixPayment.amount}
                orderId={pixPayment.orderId}
                paymentStatus="pendente"
              />
            )}
          </Modal>
        </>
      )}
    </Layout>
  )
}
