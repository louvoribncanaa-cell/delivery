import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Database } from './supabase'

export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria'
export type PixConfigRow = Database['public']['Tables']['pix_config']['Row']
export type PaymentStatus = 'pendente' | 'pago'

export const PIX_KEY_TYPE_OPTIONS: { value: PixKeyType; label: string }[] = [
  { value: 'cpf', label: 'CPF' },
  { value: 'cnpj', label: 'CNPJ' },
  { value: 'email', label: 'E-mail' },
  { value: 'telefone', label: 'Telefone' },
  { value: 'aleatoria', label: 'Chave Aleatória' },
]

export function getPixKeyTypeLabel(keyType: string | null | undefined): string {
  return PIX_KEY_TYPE_OPTIONS.find((o) => o.value === keyType)?.label ?? 'Pix'
}

/** Remove acentos e deixa apenas letras/números (para campos do EMV). */
function sanitizeEmv(value: string): string {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^A-Za-z0-9 ]+/g, '')
    .trim()
  return normalized.toUpperCase()
}

/** Normaliza a chave conforme o tipo escolhido. */
export function normalizePixKey(keyType: PixKeyType, key: string): string {
  switch (keyType) {
    case 'cpf':
    case 'cnpj':
    case 'telefone':
      return key.replace(/\D/g, '')
    case 'email':
      return key.trim().toLowerCase()
    case 'aleatoria':
    default:
      return key.trim()
  }
}

/** Validação estrutural da chave Pix. */
export function validatePixKey(keyType: PixKeyType, rawKey: string): { valid: boolean; message?: string } {
  const key = normalizePixKey(keyType, rawKey)
  if (!key) return { valid: false, message: 'Informe a chave Pix' }

  switch (keyType) {
    case 'cpf': {
      if (!/^\d{11}$/.test(key)) return { valid: false, message: 'CPF deve conter 11 dígitos' }
      return { valid: true }
    }
    case 'cnpj': {
      if (!/^\d{14}$/.test(key)) return { valid: false, message: 'CNPJ deve conter 14 dígitos' }
      return { valid: true }
    }
    case 'email': {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(key)) return { valid: false, message: 'E-mail inválido' }
      return { valid: true }
    }
    case 'telefone': {
      if (!/^\d{10,13}$/.test(key)) return { valid: false, message: 'Telefone deve conter DDD + número (10 a 13 dígitos)' }
      return { valid: true }
    }
    case 'aleatoria':
    default: {
      if (key.length < 6 || !/^[A-Za-z0-9-]+$/.test(key)) {
        return { valid: false, message: 'Chave aleatória deve conter ao menos 6 caracteres alfanuméricos' }
      }
      return { valid: true }
    }
  }
}

/** Formata valor no padrão decimal aceito pelo Pix: "0.00" (máximo 2 casas). */
export function formatPixAmount(amount: number | string): { value: string; valid: boolean; message?: string } {
  const number = typeof amount === 'string' ? parseFloat(amount.replace(',', '.')) : Number(amount)
  if (!Number.isFinite(number) || number <= 0) {
    return { value: '', valid: false, message: 'Informe um valor maior que zero (ex.: 0.00)' }
  }
  const raw = Number(number.toFixed(2)).toString()
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    return { value: '', valid: false, message: 'Valor deve ter no máximo 2 casas decimais' }
  }
  return { value: Number(number).toFixed(2), valid: true }
}

/** CRC16-CCITT (check 0xFFFF) conforme requisito do EMV QR Code / BR Code. */
export function crc16ccitt(payload: string): string {
  let crc = 0xffff
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/** Monta um campo EMV/TLV: id de 2 dígitos + tamanho + valor. */
function emv(id: string, value: string): string {
  const size = String(value.length).padStart(2, '0')
  return `${id}${size}${value}`
}

export interface BuildPixPayloadInput {
  keyType: PixKeyType
  pixKey: string
  merchantName: string
  merchantCity: string
  amount: number | string
  txid?: string
}

export interface BuildPixPayloadResult {
  payload: string | null
  error?: string
}

/**
 * Gera o payload Pix (BR Code / EMV QR Code) no formato oficial do BACEN.
 * É o "copia e cola" usado para gerar o QR Code via biblioteca `qrcode`.
 */
export function buildPixPayload(input: BuildPixPayloadInput): BuildPixPayloadResult {
  const { keyType, pixKey, merchantName, merchantCity, amount, txid } = input

  const keyCheck = validatePixKey(keyType, pixKey)
  if (!keyCheck.valid) return { payload: null, error: keyCheck.message }
  const key = normalizePixKey(keyType, pixKey)

  const amountCheck = formatPixAmount(amount)
  if (!amountCheck.valid) return { payload: null, error: amountCheck.message }

  if (!merchantName.trim()) return { payload: null, error: 'Informe o nome do beneficiário' }
  if (!merchantCity.trim()) return { payload: null, error: 'Informe a cidade do beneficiário' }

  const name = sanitizeEmv(merchantName).slice(0, 25) || 'MERCHANT'
  const city = sanitizeEmv(merchantCity).slice(0, 15) || 'BRASIL'
  const safeTxid = (txid || '***').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 25) || '***'

  const merchantAccount = emv('00', 'BR.GOV.BCB.PIX') + emv('01', key)
  const additionalData = emv('05', safeTxid)

  let payload = ''
  payload += emv('00', '01') // Payload Format Indicator
  payload += emv('26', merchantAccount)
  payload += emv('52', '0000') // Merchant Category Code
  payload += emv('53', '986') // BRL
  payload += emv('54', amountCheck.value) // Transaction Amount
  payload += emv('58', 'BR') // Country
  payload += emv('59', name) // Merchant Name
  payload += emv('60', city) // Merchant City
  payload += emv('62', additionalData) // Additional Data Field (txid)
  payload += '6304' // CRC marker
  payload += crc16ccitt(payload)

  return { payload }
}

/** Gera um txid determinístico para um pedido (até 25 caracteres alfanuméricos). */
export function defaultTxid(seed: string): string {
  return seed.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 25) || '***'
}

/** Busca a configuração Pix ativa do estabelecimento. */
export function usePixConfig() {
  const [config, setConfig] = useState<PixConfigRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    supabase
      .from('pix_config')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return
        if (!error && data) setConfig(data as PixConfigRow)
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  return { config, loading }
}

/**
 * Acompanha em tempo real o status de pagamento de um pedido Pix.
 * (com o pedido já enviado, o fluxo nunca fica bloqueado esperando a confirmação)
 */
export function usePixPaymentStatus(orderId?: string | null, initial: PaymentStatus = 'pendente') {
  const [status, setStatus] = useState<PaymentStatus>(initial)

  useEffect(() => {
    if (!orderId) return
    setStatus(initial)
    const channel = supabase
      .channel(`pix-status-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        (payload) => {
          const paymentStatus = (payload.new as { payment_status?: string })?.payment_status
          if (paymentStatus === 'pago' || paymentStatus === 'pendente') setStatus(paymentStatus)
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  return status
}