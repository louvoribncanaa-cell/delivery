import { useEffect, useState, useMemo } from 'react'
import QRCodeLib from 'qrcode'
import { Check, Copy, Clock, Loader2, QrCode as QrCodeIcon, ShieldCheck } from 'lucide-react'
import { formatCurrency, cn } from '../lib/utils'
import { usePixPaymentStatus } from '../lib/pix'
import type { PaymentStatus } from '../lib/pix'

interface PixQRCodeProps {
  /** Payload Pix (BR Code / Copia e Cola) */
  payload: string
  /** Valor exato do pedido, usado só para exibição */
  amount: number
  /** ID do pedido: quando presente, o status é atualizado em tempo real */
  orderId?: string | null
  /** Status inicial do pagamento */
  paymentStatus?: PaymentStatus
  /** Layout compacto para telas pequenas (cardápio do cliente) */
  compact?: boolean
  /** Exibe o passo a passo para o cliente */
  showInstructions?: boolean
  className?: string
}

export default function PixQRCode({
  payload,
  amount,
  orderId,
  paymentStatus = 'pendente',
  compact = false,
  showInstructions = true,
  className,
}: PixQRCodeProps) {
  const [qrState, setQrState] = useState<{ payload: string; status: 'ok' | 'error'; url?: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const liveStatus = usePixPaymentStatus(orderId, paymentStatus)
  const isPaid = liveStatus === 'pago'

  useEffect(() => {
    let cancelled = false
    QRCodeLib.toDataURL(payload, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: compact ? 220 : 280,
      color: { dark: '#1e293b', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setQrState({ payload, status: 'ok', url })
      })
      .catch(() => {
        if (!cancelled) setQrState({ payload, status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [payload, compact])

  const showQr = qrState?.payload === payload && qrState.status === 'ok'
  const qrFailed = qrState?.payload === payload && qrState.status === 'error'

  async function copyPayload() {
    try {
      await navigator.clipboard.writeText(payload)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = payload
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const statusBadge = useMemo(() => {
    if (isPaid) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
          <ShieldCheck className="h-4 w-4" /> Pagamento confirmado
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
        <Clock className="h-4 w-4 animate-pulse" /> Aguardando pagamento
      </span>
    )
  }, [isPaid])

  return (
    <div className={cn('w-full', className)}>
      <div className={cn('rounded-2xl border border-slate-200 bg-white shadow-sm', compact ? 'p-4' : 'p-5')}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <QrCodeIcon className={cn('text-amber-500', compact ? 'h-4 w-4' : 'h-5 w-5')} />
            <span className={cn('font-bold text-slate-900', compact ? 'text-sm' : 'text-base')}>
              Pagamento via Pix
            </span>
          </div>
          {statusBadge}
        </div>

        <div className="mt-3 text-center">
          <p className="text-xs text-slate-500">Valor a pagar</p>
          <p className={cn('font-bold text-amber-600', compact ? 'text-2xl' : 'text-3xl')}>
            {formatCurrency(amount)}
          </p>
        </div>

        <div className={cn('mt-4 flex items-center justify-center', compact ? 'h-48' : 'h-64')}>
          {showQr && qrState?.url ? (
            <img
              src={qrState.url}
              alt="QR Code Pix"
              className={cn(
                'h-full object-contain',
                isPaid ? 'opacity-40 grayscale pointer-events-none' : ''
              )}
            />
          ) : qrFailed ? (
            <div className="text-center text-slate-400">
              <QrCodeIcon className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Não foi possível gerar o QR Code</p>
            </div>
          ) : (
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          )}
        </div>

        {!isPaid && (
          <button
            onClick={copyPayload}
            className={cn(
              'mt-4 flex w-full items-center justify-center gap-2 rounded-xl font-semibold transition-all',
              compact ? 'py-3 text-sm' : 'py-3.5 text-base',
              copied
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                : 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/30'
            )}
          >
            {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
            {copied ? 'Código copiado!' : 'Copiar código Pix (Copia e Cola)'}
          </button>
        )}

        <div className={cn('mt-3 overflow-x-auto rounded-lg bg-slate-50 p-2', compact ? 'text-[10px]' : 'text-xs')}>
          <p className="whitespace-pre-wrap break-all text-center font-mono text-slate-500">{payload}</p>
        </div>
      </div>

      {showInstructions && !isPaid && (
        <p className={cn('mt-3 text-center text-slate-500', compact ? 'text-xs' : 'text-sm')}>
          Abra o app do seu banco, escolha <strong>Pix</strong> &gt; <strong>Ler QR Code</strong> ou{' '}
          <strong>Pix Copia e Cola</strong>.
        </p>
      )}
    </div>
  )
}