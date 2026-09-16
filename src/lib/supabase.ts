import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

/** false quando as envs não foram configuradas (ex.: deploy sem variáveis) */
export const supabaseConfigOk = Boolean(supabaseUrl && supabaseAnonKey)

if (!supabaseConfigOk) {
  console.error(
    'Supabase não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nas variáveis de ambiente.'
  )
}

// Cliente reserva só para não quebrar a importação; o App exibe aviso quando !supabaseConfigOk
export const supabase = supabaseConfigOk
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient('https://missing-config.invalid', 'missing-key')

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          name: string
          role: 'admin' | 'caixa' | 'cozinha' | 'atendente' | 'entregador' | 'cliente'
          roles: string[]
          allowed_screens: string[]
          created_at: string
        }
        Insert: {
          id: string
          name: string
          role: 'admin' | 'caixa' | 'cozinha' | 'atendente' | 'entregador' | 'cliente'
          roles?: string[]
          allowed_screens?: string[]
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          role?: 'admin' | 'caixa' | 'cozinha' | 'atendente' | 'entregador' | 'cliente'
          roles?: string[]
          allowed_screens?: string[]
          created_at?: string
        }
      }
      categories: {
        Row: {
          id: string
          name: string
          icon_svg: string
          active: boolean
        }
        Insert: {
          id?: string
          name: string
          icon_svg?: string
          active?: boolean
        }
        Update: {
          id?: string
          name?: string
          icon_svg?: string
          active?: boolean
        }
      }
      products: {
        Row: {
          id: string
          category_id: string
          name: string
          description: string
          price: number
          image_url: string
          available: boolean
        }
        Insert: {
          id?: string
          category_id: string
          name: string
          description?: string
          price: number
          image_url?: string
          available?: boolean
        }
        Update: {
          id?: string
          category_id?: string
          name?: string
          description?: string
          price?: number
          image_url?: string
          available?: boolean
        }
      }
      orders: {
        Row: {
          id: string
          order_number: number
          customer_name: string
          customer_phone: string
          table_or_address: string
          status: 'pendente' | 'em_preparo' | 'pronto' | 'entregue' | 'cancelado'
          payment_status: 'pendente' | 'pago'
          payment_method: 'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro'
          total: number
          archived: boolean
          created_by: string | null
          pix_copy_paste: string | null
          pix_txid: string | null
          pix_expires_at: string | null
          pix_payment_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          order_number?: number
          customer_name: string
          customer_phone?: string
          table_or_address?: string
          status?: 'pendente' | 'em_preparo' | 'pronto' | 'entregue' | 'cancelado'
          payment_status?: 'pendente' | 'pago'
          payment_method?: 'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro'
          total: number
          archived?: boolean
          created_by?: string | null
          pix_copy_paste?: string | null
          pix_txid?: string | null
          pix_expires_at?: string | null
          pix_payment_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          order_number?: number
          customer_name?: string
          customer_phone?: string
          table_or_address?: string
          status?: 'pendente' | 'em_preparo' | 'pronto' | 'entregue' | 'cancelado'
          payment_status?: 'pendente' | 'pago'
          payment_method?: 'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro'
          total?: number
          archived?: boolean
          created_by?: string | null
          pix_copy_paste?: string | null
          pix_txid?: string | null
          pix_expires_at?: string | null
          pix_payment_id?: string | null
          created_at?: string
        }
      }
      pix_config: {
        Row: {
          id: string
          key_type: 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria'
          pix_key: string
          merchant_name: string
          merchant_city: string
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          key_type: 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria'
          pix_key: string
          merchant_name: string
          merchant_city: string
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          key_type?: 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria'
          pix_key?: string
          merchant_name?: string
          merchant_city?: string
          active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      pix_gateway_config: {
        Row: {
          id: string
          provider: string
          access_token: string
          webhook_secret: string | null
          environment: 'sandbox' | 'production'
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          provider?: string
          access_token: string
          webhook_secret?: string | null
          environment?: 'sandbox' | 'production'
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          provider?: string
          access_token?: string
          webhook_secret?: string | null
          environment?: 'sandbox' | 'production'
          active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
          notes: string
        }
        Insert: {
          id?: string
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
          notes?: string
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string
          quantity?: number
          unit_price?: number
          notes?: string
        }
      }
      cash_register: {
        Row: {
          id: string
          opened_by: string
          opened_at: string
          closed_at: string | null
          status: 'open' | 'closed'
          initial_amount: number
          final_amount: number | null
        }
        Insert: {
          id?: string
          opened_by: string
          opened_at?: string
          closed_at?: string | null
          status?: 'open' | 'closed'
          initial_amount?: number
          final_amount?: number | null
        }
        Update: {
          id?: string
          opened_by?: string
          opened_at?: string
          closed_at?: string | null
          status?: 'open' | 'closed'
          initial_amount?: number
          final_amount?: number | null
        }
      }
    }
  }
}
