import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Search, ShoppingCart, Plus, Minus, Trash2, Send, X, Utensils, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import PixQRCode from '../components/PixQRCode'
import { supabase } from '../lib/supabase'
import { useCashRegister } from '../contexts/CashRegisterContext'
import { formatCurrency, cn } from '../lib/utils'
import { usePixConfig, buildPixPayload, defaultTxid } from '../lib/pix'
import type { Database } from '../lib/supabase'

type Product = Database['public']['Tables']['products']['Row']
type Category = Database['public']['Tables']['categories']['Row']

interface CartItem {
  product: Product
  quantity: number
  notes: string
}

function createOrderId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.random() * 16 | 0
    const value = character === 'x' ? random : (random & 0x3 | 0x8)
    return value.toString(16)
  })
}

export default function Menu() {
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
  const [paymentMethod, setPaymentMethod] = useState<Database['public']['Tables']['orders']['Row']['payment_method']>('pix')
  const [submitting, setSubmitting] = useState(false)
  const clientOrderIdRef = useRef<string | null>(null)

  const [clientOrder, setClientOrder] = useState<{
    id: string
    orderNumber: number
    status: Database['public']['Tables']['orders']['Row']['status']
    total: number
    items: { product_name: string; quantity: number }[]
    paymentMethod: Database['public']['Tables']['orders']['Row']['payment_method']
    paymentStatus: Database['public']['Tables']['orders']['Row']['payment_status']
    pixPayload?: string
    pixQrCodeBase64?: string
  } | null>(null)

  useEffect(() => {
    fetchCategories()
    fetchProducts()
    const savedOrderId = localStorage.getItem('client-order-id')
    if (savedOrderId) loadClientOrder(savedOrderId)
    const channel = supabase
      .channel('client-order-status')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
        const record = payload.new as { id?: string } | undefined
        if (record?.id && record.id === clientOrderIdRef.current) loadClientOrder(record.id)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function loadClientOrder(orderId: string) {
    const { data } = await supabase
      .from('orders')
      .select('id, order_number, status, archived, total, payment_method, payment_status, pix_copy_paste, order_items(quantity, products(name))')
      .eq('id', orderId)
      .maybeSingle()
    if (!data || data.archived || data.status === 'cancelado') {
      clientOrderIdRef.current = null
      localStorage.removeItem('client-order-id')
      setClientOrder(null)
      return
    }
    clientOrderIdRef.current = data.id
    const items = (data.order_items as unknown as { quantity: number; products: { name: string } | null }[])
      .map((item) => ({ product_name: item.products?.name || 'Item', quantity: item.quantity }))
    setClientOrder({
      id: data.id,
      orderNumber: data.order_number,
      status: data.status,
      total: data.total,
      items,
      paymentMethod: data.payment_method,
      paymentStatus: data.payment_status,
      pixPayload: data.pix_copy_paste ?? undefined,
    })
  }

  async function cancelClientOrder() {
    if (!clientOrder || clientOrder.status !== 'pendente') return
    if (!confirm('Cancelar este pedido?')) return
    try {
      const { data, error } = await supabase.rpc('cancel_order', { p_order_id: clientOrder.id })
      if (error) throw error
      const result = data as { success: boolean; error?: string }
      if (!result.success) {
        toast.error(result.error || 'Não foi possível cancelar o pedido')
        return
      }
      localStorage.removeItem('client-order-id')
      setClientOrder(null)
      toast.success('Pedido cancelado')
    } catch (error) {
      toast.error('Não foi possível cancelar o pedido')
      console.error(error)
    }
  }

  async function fetchCategories() {
    const { data } = await supabase.from('categories').select('*').eq('active', true).order('name')
    if (data) setCategories(data)
  }

  async function fetchProducts() {
    const { data } = await supabase.from('products').select('*').eq('available', true).order('name')
    if (data) setProducts(data)
  }

  const filteredProducts = products.filter((p) => {
    const matchesCategory = !selectedCategory || p.category_id === selectedCategory
    const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase())
    return matchesCategory && matchesSearch
  })

  function addToCart(product: Product) {
    if (!isCashRegisterOpen) {
      toast.error('O caixa está fechado no momento')
      return
    }
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

  async function submitOrder() {
    if (!isCashRegisterOpen) {
      toast.error('Abra o caixa para finalizar o pedido')
      return
    }
    if (!customerName.trim()) {
      toast.error('Informe seu nome')
      return
    }
    if (cart.length === 0) {
      toast.error('Adicione itens ao pedido')
      return
    }

    setSubmitting(true)
    try {
      const total = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
      const orderId = createOrderId()

      // Gera o payload Pix (BR Code) com o valor exato do pedido
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

      const insertData: {
        id: string
        customer_name: string
        customer_phone: string
        total: number
        payment_method: typeof paymentMethod
        payment_status: 'pendente'
        status: 'pendente'
        pix_copy_paste?: string
        pix_txid?: string
        pix_expires_at?: string
      } = {
        id: orderId,
        customer_name: customerName,
        customer_phone: customerPhone,
        total,
        payment_method: paymentMethod,
        payment_status: 'pendente',
        status: 'pendente',
      }
      if (pixPayload) {
        insertData.pix_copy_paste = pixPayload
        insertData.pix_txid = defaultTxid(orderId)
        insertData.pix_expires_at = new Date(Date.now() + 30 * 60 * 1000).toISOString()
      }

      const { error: orderError } = await supabase.from('orders').insert(insertData)

      if (orderError) throw orderError

      const orderItems = cart.map((item) => ({
        order_id: orderId,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.price,
        notes: item.notes,
      }))

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems)
      if (itemsError) throw itemsError

      toast.success('Pedido enviado com sucesso!', { icon: '🎉' })
      localStorage.setItem('client-order-id', orderId)
      const items = cart.map((item) => ({ product_name: item.product.name, quantity: item.quantity }))
      clientOrderIdRef.current = orderId
      setClientOrder({
        id: orderId,
        orderNumber: 0,
        status: 'pendente',
        total,
        items,
        paymentMethod,
        paymentStatus: 'pendente',
        pixPayload: pixPayload ?? undefined,
      })
      // Busca o nº do pedido no servidor e confirma o payload gravado
      loadClientOrder(orderId)

      // Tenta criar pagamento via gateway (Mercado Pago) para QR Code dinâmico
      if (paymentMethod === 'pix' && pixPayload) {
        try {
          const { data: gwData, error: gwError } = await supabase.functions.invoke(
            'create-pix-payment',
            { body: { order_id: orderId } }
          )
          if (!gwError && gwData?.qr_code_base64) {
            setClientOrder((prev) =>
              prev ? { ...prev, pixQrCodeBase64: gwData.qr_code_base64 } : prev
            )
          }
        } catch {
          // Gateway não configurado — usa fallback BR Code local
        }
      }
      setCart([])
      setCustomerName('')
      setCustomerPhone('')
      setIsCartOpen(false)
    } catch (error) {
      const message = error && typeof error === 'object' && 'message' in error
        ? String((error as { message: unknown }).message)
        : 'Erro desconhecido'
      toast.error(`Não foi possível enviar o pedido: ${message}`)
      console.error('Erro ao enviar pedido pelo cardápio:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const cashierClosedNotice = !isCashRegisterOpen && (
    <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <strong>Cardápio em modo consulta.</strong> Os itens continuam visíveis, mas adicionar produtos e finalizar pedidos ficam disponíveis quando o caixa for aberto.
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
                <Utensils className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Cardápio Digital</h1>
                <p className="text-xs text-slate-500">Faça seu pedido pelo celular</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {clientOrder && (
        <div className="fixed bottom-0 left-0 right-0 z-40 mx-auto max-w-4xl">
          <div className="mx-4 mb-4 rounded-2xl border border-amber-200 bg-white shadow-xl shadow-amber-500/10 overflow-hidden">
            <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={cn(
                  'w-2.5 h-2.5 rounded-full',
                  clientOrder.status === 'pendente' && 'bg-amber-400 animate-pulse',
                  clientOrder.status === 'em_preparo' && 'bg-blue-500',
                  clientOrder.status === 'pronto' && 'bg-emerald-500',
                )} />
                <span className="text-sm font-bold text-slate-900">
                  Pedido #{clientOrder.orderNumber || '...'}
                </span>
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-xs font-semibold',
                  clientOrder.status === 'pendente' && 'bg-amber-100 text-amber-700',
                  clientOrder.status === 'em_preparo' && 'bg-blue-100 text-blue-700',
                  clientOrder.status === 'pronto' && 'bg-emerald-100 text-emerald-700',
                )}>
                  {clientOrder.status === 'pendente' && 'Pendente'}
                  {clientOrder.status === 'em_preparo' && 'Em Preparo'}
                  {clientOrder.status === 'pronto' && 'Pronto'}
                </span>
              </div>
              {clientOrder.status === 'pendente' && (
                <button onClick={cancelClientOrder} className="text-xs font-semibold text-crimson-500 hover:text-crimson-600 px-2 py-1 rounded-lg hover:bg-crimson-50 transition-colors">
                  Cancelar
                </button>
              )}
            </div>
            <div className={cn(
              'px-4 py-3 overflow-y-auto',
              clientOrder.paymentMethod === 'pix' && clientOrder.paymentStatus !== 'pago' ? 'max-h-[75vh]' : 'max-h-40'
            )}>
              <div className="space-y-1.5">
                {clientOrder.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">
                      <span className="font-bold text-amber-600">{item.quantity}x</span> {item.product_name}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
                <span className="text-sm font-bold text-slate-900">Total</span>
                <span className="text-base font-bold text-amber-600">{formatCurrency(clientOrder.total)}</span>
              </div>

              {clientOrder.paymentMethod === 'pix' && (
                <div className="mt-3">
                  {clientOrder.paymentStatus === 'pago' ? (
                    <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 py-3 text-sm font-bold text-emerald-700">
                      <ShieldCheck className="h-5 w-5" /> Pagamento Pix confirmado
                    </div>
                  ) : clientOrder.pixPayload ? (
                    <PixQRCode
                      payload={clientOrder.pixPayload}
                      qrCodeBase64={clientOrder.pixQrCodeBase64}
                      amount={clientOrder.total}
                      orderId={clientOrder.id}
                      paymentStatus="pendente"
                      compact
                    />
                  ) : (
                    <p className="text-center text-xs text-slate-500">Aguardando código de pagamento...</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-4 pb-24">
        {cashierClosedNotice}
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar no cardápio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 shadow-sm"
          />
        </div>

        {/* Categories */}
        <div className="mb-5 -mx-4 overflow-x-auto px-4 pb-3">
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

        {/* Products */}
        <div className="space-y-3">
          {filteredProducts.map((product) => {
            const cartItem = cart.find((c) => c.product.id === product.id)
  if (registerLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
                <Utensils className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Cardápio Digital</h1>
                <p className="text-xs text-slate-500">Carregando...</p>
              </div>
            </div>
          </div>
        </header>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber-500 border-t-transparent" />
        </div>
      </div>
    )
  }

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
                    {isCashRegisterOpen && cartItem ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(product.id, -1)}
                          className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="font-bold text-sm w-6 text-center">{cartItem.quantity}</span>
                        <button
                          onClick={() => updateQuantity(product.id, 1)}
                          className="w-8 h-8 rounded-lg bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => addToCart(product)}
                        disabled={!isCashRegisterOpen}
                        className={cn(
                          'py-1.5 px-3 rounded-lg text-sm font-medium transition-colors flex items-center gap-1',
                          isCashRegisterOpen ? 'bg-amber-500 text-white hover:bg-amber-600' : 'cursor-not-allowed bg-slate-200 text-slate-500'
                        )}
                      >
                        <Plus className="w-4 h-4" /> {isCashRegisterOpen ? 'Adicionar' : 'Caixa fechado'}
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
            <p>Nenhum item encontrado</p>
          </div>
        )}
      </div>

      {isCashRegisterOpen && cartItemCount > 0 && (
        <motion.button
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          onClick={() => setIsCartOpen(true)}
          className="fixed bottom-4 left-4 right-4 z-40 mx-auto flex max-w-4xl items-center justify-between rounded-2xl bg-amber-500 px-5 py-3.5 text-white shadow-xl shadow-amber-500/30 transition-colors hover:bg-amber-600"
        >
          <span className="flex items-center gap-3">
            <span className="relative"><ShoppingCart className="h-6 w-6" /><span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-crimson-500 text-xs font-bold">{cartItemCount}</span></span>
            <span className="text-left"><span className="block text-xs opacity-90">Seu carrinho</span><span className="block font-bold">Ver pedido</span></span>
          </span>
          <span className="font-bold">{formatCurrency(cartTotal)}</span>
        </motion.button>
      )}

      {/* Cart Drawer */}
      {isCartOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={() => setIsCartOpen(false)}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 h-[92vh] bg-white z-50 rounded-t-3xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-amber-500" />
                <h2 className="text-lg font-bold text-slate-900">Seu Pedido</h2>
              </div>
              <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {cart.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Seu carrinho está vazio</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.product.id} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm text-slate-900">{item.product.name}</h4>
                        <p className="text-amber-600 font-bold text-sm mt-0.5">{formatCurrency(item.product.price)}</p>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="p-2 hover:bg-crimson-50 rounded-lg text-crimson-500 ml-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => updateQuantity(item.product.id, -1)}
                          className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center active:bg-slate-100"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="font-bold text-base w-8 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product.id, 1)}
                          className="w-9 h-9 rounded-lg bg-amber-500 text-white flex items-center justify-center active:bg-amber-600"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="font-bold text-base text-slate-900">{formatCurrency(item.product.price * item.quantity)}</p>
                    </div>
                    <input
                      type="text"
                      placeholder="Observação..."
                      value={item.notes}
                      onChange={(e) => updateItemNotes(item.product.id, e.target.value)}
                      className="w-full mt-3 px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 placeholder-slate-400"
                    />
                  </div>
                ))
              )}
            </div>

            {/* Bottom Form */}
            {cart.length > 0 && (
              <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 space-y-3 safe-area-inset-bottom">
                <input
                  type="text"
                  placeholder="Seu nome *"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-amber-500 placeholder-slate-400"
                />
                <input
                  type="text"
                  placeholder="Telefone (opcional)"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-amber-500 placeholder-slate-400"
                />

                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Forma de pagamento</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'pix', label: 'Pix' },
                      { value: 'cartao_credito', label: 'Cartão Crédito' },
                      { value: 'cartao_debito', label: 'Cartão Débito' },
                      { value: 'dinheiro', label: 'Dinheiro' },
                    ].map((method) => (
                      <button
                        key={method.value}
                        onClick={() => setPaymentMethod(method.value as typeof paymentMethod)}
                        className={cn(
                          'py-3 rounded-xl text-sm font-semibold transition-all border',
                          paymentMethod === method.value
                            ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200 active:bg-slate-50'
                        )}
                      >
                        {method.label}
                      </button>
                    ))}
                  </div>
                  {pixConfigLoading && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
                      <span className="animate-spin rounded-full h-3 w-3 border-2 border-amber-500 border-t-transparent" />
                      Carregando configuração de pagamento...
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-base font-bold text-slate-900">Total</span>
                  <span className="text-xl font-bold text-amber-600">{formatCurrency(cartTotal)}</span>
                </div>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={submitOrder}
                  disabled={submitting || !customerName.trim()}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base"
                >
                  {submitting ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Finalizar Pedido
                    </>
                  )}
                </motion.button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </div>
  )
}
