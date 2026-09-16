import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { Database } from '../lib/supabase'

type CashRegister = Database['public']['Tables']['cash_register']['Row']

interface CashRegisterContextType {
  isOpen: boolean
  currentRegister: CashRegister | null
  loading: boolean
  openRegister: (initialAmount?: number) => Promise<{ error?: string }>
  closeRegister: (finalAmount?: number, resetOrderNumbers?: boolean) => Promise<{ error?: string }>
  refresh: () => Promise<void>
}

const CashRegisterContext = createContext<CashRegisterContextType | undefined>(undefined)

export function CashRegisterProvider({ children }: { children: ReactNode }) {
  const [currentRegister, setCurrentRegister] = useState<CashRegister | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStatus = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('cash_register')
        .select('*')
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      setCurrentRegister(data)
    } catch (error) {
      console.error('Error fetching cash register:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()

    const channel = supabase
      .channel('cash-register-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cash_register' },
        () => fetchStatus()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchStatus])

  async function openRegister(initialAmount: number = 0) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { error: 'Usuário não autenticado' }

      const { error } = await supabase.from('cash_register').insert({
        opened_by: user.id,
        initial_amount: initialAmount,
        status: 'open',
      })

      if (error) throw error
      await fetchStatus()
      return {}
    } catch (error: any) {
      return { error: error.message || 'Erro ao abrir caixa' }
    }
  }

  async function closeRegister(finalAmount: number = 0, resetOrderNumbers = false) {
    if (!currentRegister) return { error: 'Nenhum caixa aberto' }

    try {
      const { error } = await supabase
        .from('cash_register')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          final_amount: finalAmount,
        })
        .eq('id', currentRegister.id)

      if (error) throw error
      if (resetOrderNumbers) {
        const { error: resetError } = await supabase.rpc('reset_order_number_sequence')
        if (resetError) throw resetError
      }
      await fetchStatus()
      return {}
    } catch (error: any) {
      return { error: error.message || 'Erro ao fechar caixa' }
    }
  }

  return (
    <CashRegisterContext.Provider
      value={{
        isOpen: currentRegister?.status === 'open',
        currentRegister,
        loading,
        openRegister,
        closeRegister,
        refresh: fetchStatus,
      }}
    >
      {children}
    </CashRegisterContext.Provider>
  )
}

export function useCashRegister() {
  const context = useContext(CashRegisterContext)
  if (!context) {
    return {
      isOpen: false,
      currentRegister: null,
      loading: false,
      openRegister: async () => ({ error: 'Contexto não disponível' }),
      closeRegister: async () => ({ error: 'Contexto não disponível' }),
      refresh: async () => {},
    }
  }
  return context
}
