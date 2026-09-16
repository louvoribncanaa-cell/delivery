import { useState, useEffect } from 'react'
import { Eye, EyeOff, Save, RefreshCw, ExternalLink, CheckCircle, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/utils'

interface GatewayConfig {
  id: string
  provider: string
  access_token: string
  webhook_secret: string | null
  environment: 'sandbox' | 'production'
  active: boolean
}

export default function AdminPixGateway() {
  const [config, setConfig] = useState<GatewayConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const [form, setForm] = useState({
    access_token: '',
    webhook_secret: '',
    environment: 'sandbox' as 'sandbox' | 'production',
  })

  useEffect(() => {
    fetchConfig()
  }, [])

  async function fetchConfig() {
    try {
      const { data, error } = await supabase
        .from('pix_gateway_config')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (error) throw error
      if (data) {
        setConfig(data as GatewayConfig)
        setForm({
          access_token: data.access_token,
          webhook_secret: data.webhook_secret || '',
          environment: data.environment,
        })
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  async function saveConfig() {
    if (!form.access_token.trim()) {
      toast.error('Informe o Access Token do Mercado Pago')
      return
    }

    setSaving(true)
    try {
      const data = {
        provider: 'mercadopago',
        access_token: form.access_token.trim(),
        webhook_secret: form.webhook_secret.trim() || null,
        environment: form.environment,
        active: true,
      }

      if (config) {
        const { error } = await supabase
          .from('pix_gateway_config')
          .update(data)
          .eq('id', config.id)
        if (error) throw error
        toast.success('Configuração do gateway atualizada!')
      } else {
        const { error } = await supabase
          .from('pix_gateway_config')
          .insert(data)
        if (error) throw error
        toast.success('Gateway PIX configurado!')
      }

      fetchConfig()
    } catch (error) {
      toast.error('Erro ao salvar configuração do gateway')
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  async function testConnection() {
    if (!form.access_token.trim()) {
      toast.error('Salve o Access Token antes de testar')
      return
    }

    setTesting(true)
    try {
      const response = await fetch('https://api.mercadopago.com/v1/payment_methods', {
        headers: {
          Authorization: `Bearer ${form.access_token.trim()}`,
        },
      })

      if (response.ok) {
        toast.success('Conexão com Mercado Pago OK!')
      } else {
        const data = await response.json()
        toast.error(`Erro: ${data.message || response.statusText}`)
      }
    } catch {
      toast.error('Falha ao conectar com Mercado Pago')
    } finally {
      setTesting(false)
    }
  }

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/handle-pix-webhook`

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Status */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900">Gateway PIX (Mercado Pago)</h3>
        <span className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold',
          config?.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
        )}>
          {config?.active ? (
            <><CheckCircle className="h-3.5 w-3.5" /> Configurado</>
          ) : (
            <><XCircle className="h-3.5 w-3.5" /> Não configurado</>
          )}
        </span>
      </div>

      <p className="text-sm text-slate-500">
        Configure as credenciais do Mercado Pago para gerar QR Codes dinâmicos com baixa automática via webhook.
        O Access Token nunca é exposto ao frontend.
      </p>

      {/* Form */}
      <div className="space-y-4">
        {/* Environment */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Ambiente</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'sandbox', label: 'Sandbox (Testes)' },
              { value: 'production', label: 'Produção' },
            ].map((env) => (
              <button
                key={env.value}
                type="button"
                onClick={() => setForm({ ...form, environment: env.value as 'sandbox' | 'production' })}
                className={cn(
                  'px-4 py-2.5 rounded-xl text-sm font-medium border transition-all',
                  form.environment === env.value
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'
                )}
              >
                {env.label}
              </button>
            ))}
          </div>
        </div>

        {/* Access Token */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Access Token *</label>
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={form.access_token}
              onChange={(e) => setForm({ ...form, access_token: e.target.value })}
              className="w-full px-4 py-2.5 pr-20 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-amber-500"
              placeholder="APP_USR-..."
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
            >
              {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Obtido em:{' '}
            <a
              href="https://www.mercadopago.com.br/developers/pt/docs/your-integrations/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-600 hover:underline inline-flex items-center gap-1"
            >
              Suas integrações <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </div>

        {/* Webhook Secret */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Webhook Secret (opcional)</label>
          <div className="relative">
            <input
              type={showSecret ? 'text' : 'password'}
              value={form.webhook_secret}
              onChange={(e) => setForm({ ...form, webhook_secret: e.target.value })}
              className="w-full px-4 py-2.5 pr-20 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-amber-500"
              placeholder="Chave secreta do webhook"
            />
            <button
              type="button"
              onClick={() => setShowSecret(!showSecret)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
            >
              {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Gerada ao configurar o webhook no Mercado Pago. Valida a autenticidade das notificações.
          </p>
        </div>

        {/* Webhook URL */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800 mb-1">URL do Webhook</p>
          <p className="text-xs text-amber-700 font-mono break-all bg-white rounded-lg p-2 border border-amber-200">
            {webhookUrl || 'Configure VITE_SUPABASE_URL'}
          </p>
          <p className="mt-2 text-xs text-amber-600">
            Configure esta URL no painel do Mercado Pago em{' '}
            <strong>Suas integrações &gt; Webhooks &gt; Pagamentos</strong>.
            Selecione o evento <strong>Pagamentos</strong>.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={saveConfig}
            disabled={saving}
            className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : config ? 'Salvar Alterações' : 'Configurar Gateway'}
          </button>
          <button
            onClick={testConnection}
            disabled={testing}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <RefreshCw className={cn('w-4 h-4', testing && 'animate-spin')} />
            {testing ? 'Testando...' : 'Testar'}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 space-y-2">
        <p className="font-semibold text-slate-700">Como funciona:</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>O QR Code é gerado via API do Mercado Pago (Checkout Transparente)</li>
          <li>O Mercado Pago envia uma notificação (webhook) quando o pagamento é confirmado</li>
          <li>O pedido é marcado automaticamente como "Pago" em tempo real</li>
          <li>Nenhum IOF é cobrado — apenas a taxa do gateway (~0,99% por transação PIX)</li>
        </ul>
      </div>
    </div>
  )
}
