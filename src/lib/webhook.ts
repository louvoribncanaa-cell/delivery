// Webhook disparado quando a cozinha marca um pedido como pronto.
// Usado pelo n8n para avisar o cliente (ex.: WhatsApp) se houver telefone no pedido.
export const ORDER_READY_WEBHOOK_URL =
  'https://n8n.jorgejfc.com.br/webhook/819e4cb3-6618-44a7-afd0-4ea67026eda6'

interface WebhookOrderItem {
  quantity: number
  unit_price: number
  notes: string | null
  products: { name: string } | null
}

interface WebhookOrder {
  id: string
  order_number: number
  customer_name: string
  customer_phone: string
  table_or_address: string
  status: string
  payment_status: string
  payment_method: string
  total: number
  created_at: string
  order_items: WebhookOrderItem[]
}

export function getPhoneDigits(phone: string | null | undefined): string {
  return (phone || '').replace(/\D/g, '')
}

export function formatBRL(value: number): string {
  return `R$ ${Number(value).toFixed(2).replace('.', ',')}`
}

export function formatQuantity(value: number): string {
  return `.${value}x`
}

export function formatPaymentMethod(method: string | null | undefined): string {
  switch (method) {
    case 'pix': return 'Pix'
    case 'cartao_debito': return 'Débito'
    case 'cartao_credito': return 'Crédito'
    case 'dinheiro': return 'Dinheiro'
    default: return method || ''
  }
}

function buildReadyMessage(order: WebhookOrder): string {
  return order.order_items
    .map((item) => {
      const unit = formatBRL(Number(item.unit_price))
      return `${item.quantity}x ${item.products?.name ?? 'Item'} ${unit}`
    })
    .join('\n')
}

/**
 * Envia o pedido completo para o webhook do n8n.
 * Só envia se houver telefone no pedido. Nunca lança erro
 * (falha no webhook não pode travar o fluxo da cozinha).
 */
export async function notifyOrderReady(order: WebhookOrder): Promise<boolean> {
  const phoneDigits = getPhoneDigits(order.customer_phone)
  if (!phoneDigits) return false

  const timestamp = new Date().toISOString()
  const message = buildReadyMessage(order)
  const paymentLabel = formatPaymentMethod(order.payment_method)

  // Webhook do n8n registrado para GET: cada campo vai separado na query string
  const params = new URLSearchParams({
    event: 'order_ready',
    timestamp,
    order_id: order.id,
    order_number: String(order.order_number),
    customer_name: order.customer_name,
    customer_phone: order.customer_phone,
    customer_phone_digits: phoneDigits,
    table_or_address: order.table_or_address || '',
    status: 'pronto',
    payment_status: order.payment_status,
    payment_method: paymentLabel,
    total: formatBRL(Number(order.total)),
    created_at: order.created_at,
    item_count: String(order.order_items.length),
    message,
    payload: JSON.stringify({
      event: 'order_ready',
      timestamp,
      order: {
        id: order.id,
        order_number: order.order_number,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        customer_phone_digits: phoneDigits,
        table_or_address: order.table_or_address || '',
        status: 'pronto',
        payment_status: order.payment_status,
        payment_method: paymentLabel,
        total: formatBRL(Number(order.total)),
        created_at: order.created_at,
      },
      items: order.order_items.map((item) => ({
        product_name: item.products?.name ?? 'Item',
        quantity: formatQuantity(item.quantity),
        unit_price: Number(item.unit_price),
        subtotal: formatBRL(Number(item.unit_price) * item.quantity),
        notes: item.notes || '',
      })),
      message,
    }),
  })
  order.order_items.forEach((item, index) => {
    const n = index + 1
    params.set(`item_${n}_product_name`, item.products?.name ?? 'Item')
    params.set(`item_${n}_quantity`, formatQuantity(item.quantity))
    params.set(`item_${n}_unit_price`, String(Number(item.unit_price)))
    params.set(`item_${n}_subtotal`, formatBRL(Number(item.unit_price) * item.quantity))
    params.set(`item_${n}_notes`, item.notes || '')
  })
  const url = `${ORDER_READY_WEBHOOK_URL}?${params.toString()}`

  // 1) Tenta GET normal (permite confirmar a entrega se o n8n liberar CORS)
  try {
    const response = await fetch(url, { method: 'GET' })
    if (response.ok) return true
    console.error('Webhook order_ready falhou:', response.status)
  } catch (error) {
    console.warn('Fetch do webhook bloqueado (CORS), tentando no-cors:', error)
  }

  // 2) Fallback fire-and-forget: o GET simples não usa preflight,
  // então o n8n recebe mesmo sem header CORS (só não dá pra ler a resposta)
  try {
    await fetch(url, { method: 'GET', mode: 'no-cors' })
    return true
  } catch (error) {
    console.error('Erro ao enviar webhook order_ready:', error)
    return false
  }
}
