import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function getElapsedTime(date: string): string {
  const now = new Date()
  const created = new Date(date)
  const diff = Math.floor((now.getTime() - created.getTime()) / 1000)

  const minutes = Math.floor(diff / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}min`
  }
  return `${minutes}min`
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'pendente': return 'bg-amber-100 text-amber-800 border-amber-300'
    case 'em_preparo': return 'bg-blue-100 text-blue-800 border-blue-300'
    case 'pronto': return 'bg-emerald-100 text-emerald-800 border-emerald-300'
    case 'entregue': return 'bg-slate-100 text-slate-800 border-slate-300'
    case 'cancelado': return 'bg-crimson-100 text-crimson-800 border-crimson-300'
    default: return 'bg-slate-100 text-slate-800 border-slate-300'
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'pendente': return 'Pendente'
    case 'em_preparo': return 'Em Preparo'
    case 'pronto': return 'Pronto'
    case 'entregue': return 'Entregue'
    case 'cancelado': return 'Cancelado'
    default: return status
  }
}

export function getPaymentMethodLabel(method: string): string {
  switch (method) {
    case 'pix': return 'Pix'
    case 'cartao_credito': return 'Cartão de Crédito'
    case 'cartao_debito': return 'Cartão de Débito'
    case 'dinheiro': return 'Dinheiro'
    default: return method
  }
}
