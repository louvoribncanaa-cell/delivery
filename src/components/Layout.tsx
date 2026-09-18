import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ClipboardList,
  ChefHat,
  CreditCard,
  History,
  Receipt,
  Settings,
  LogOut,
  Menu as MenuIcon,
  X,
  Utensils,
  Search,
  Bell,
  HelpCircle,
  Plus,
  BarChart3,
  Bike,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useState } from 'react'

const navItems: Record<string, { to: string; icon: ReactNode; label: string }[]> = {
  admin: [
    { to: '/admin', icon: <Settings className="w-[22px] h-[22px]" />, label: 'Painel Admin' },
    { to: '/orders', icon: <ClipboardList className="w-[22px] h-[22px]" />, label: 'Pedidos' },
    { to: '/my-orders', icon: <Receipt className="w-[22px] h-[22px]" />, label: 'Meus Pedidos' },
    { to: '/driver', icon: <Bike className="w-[22px] h-[22px]" />, label: 'Entregas' },
    { to: '/kitchen', icon: <ChefHat className="w-[22px] h-[22px]" />, label: 'Cozinha' },
    { to: '/cashier', icon: <CreditCard className="w-[22px] h-[22px]" />, label: 'Caixa' },
    { to: '/cash-management', icon: <CreditCard className="w-[22px] h-[22px]" />, label: 'Gestão de Caixa' },
    { to: '/history', icon: <History className="w-[22px] h-[22px]" />, label: 'Relatórios' },
  ],
  atendente: [
    { to: '/orders', icon: <ClipboardList className="w-[22px] h-[22px]" />, label: 'Pedidos' },
    { to: '/my-orders', icon: <Receipt className="w-[22px] h-[22px]" />, label: 'Meus Pedidos' },
  ],
  cozinha: [
    { to: '/kitchen', icon: <ChefHat className="w-[22px] h-[22px]" />, label: 'Cozinha' },
    { to: '/history', icon: <History className="w-[22px] h-[22px]" />, label: 'Relatórios' },
  ],
  caixa: [
    { to: '/cashier', icon: <CreditCard className="w-[22px] h-[22px]" />, label: 'Caixa' },
    { to: '/cash-management', icon: <CreditCard className="w-[22px] h-[22px]" />, label: 'Gestão de Caixa' },
    { to: '/history', icon: <History className="w-[22px] h-[22px]" />, label: 'Relatórios' },
  ],
  entregador: [
    { to: '/driver', icon: <Bike className="w-[22px] h-[22px]" />, label: 'Minhas Entregas' },
  ],
}

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  atendente: 'Atendente',
  cozinha: 'Cozinha',
  caixa: 'Caixa',
  entregador: 'Entregador',
  cliente: 'Cliente',
}

const roleOrder = ['admin', 'atendente', 'cozinha', 'caixa']

interface LayoutProps {
  children: ReactNode
  title?: string
}

export default function Layout({ children, title }: LayoutProps) {
  const { profile, roles, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const items = (() => {
    const seen = new Set<string>()
    const merged: { to: string; icon: ReactNode; label: string }[] = []
    const orderedRoles = [...roleOrder.filter((r) => roles.includes(r)), ...roles.filter((r) => !roleOrder.includes(r))]
    for (const role of orderedRoles) {
      for (const item of navItems[role] || []) {
        if (!seen.has(item.to)) {
          seen.add(item.to)
          merged.push(item)
        }
      }
    }
    return merged
  })()

  const roleDescription = roles.length > 0
    ? roles.map((r) => roleLabels[r] || r).join(' / ')
    : ''

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const sidebar = (
    <aside className="hidden lg:flex flex-col w-[280px] bg-[#0c1524] text-white">
      <div className="px-7 pt-7 pb-6 border-b border-white/[0.06]">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-[14px] flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #14917a, #0d7c67)' }}>
            <Utensils className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-[17px] tracking-tight text-white">Delivery Fast</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">{roleDescription}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-5 py-6 space-y-1.5">
        {items.map((item) => {
          const active = location.pathname === item.to
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`group flex items-center gap-3.5 px-4 py-3 rounded-xl text-[14px] font-medium transition-all duration-200 ${
                active
                  ? 'text-white shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
              }`}
              style={active ? { background: 'linear-gradient(135deg, #14917a, #0d7c67)', boxShadow: '0 8px 24px rgba(20, 145, 130, 0.3)' } : undefined}
            >
              <span className={`flex items-center justify-center ${active ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="px-5 pb-6 space-y-3">
        <Link
          to="/admin"
          className="flex items-center gap-3.5 px-4 py-3 rounded-xl text-[14px] font-medium text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all"
        >
          <span className="flex items-center justify-center text-slate-500">
            <BarChart3 className="w-[22px] h-[22px]" />
          </span>
          <span>Configurações</span>
        </Link>

        <div className="border-t border-white/[0.06] pt-4">
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/[0.04]">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, #14917a, #0d7c67)' }}>
              {profile?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-white truncate">{profile?.name}</p>
              <p className="text-[11px] text-slate-400 truncate">{roleDescription}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3.5 px-4 py-3 mt-2 rounded-xl text-slate-400 hover:text-crimson-400 hover:bg-white/[0.06] transition-all text-[14px] font-medium"
          >
            <LogOut className="w-[20px] h-[20px]" />
            <span>Sair</span>
          </button>
        </div>
      </div>
    </aside>
  )

  return (
    <div className="min-h-screen flex" style={{ background: '#f0f4f8' }}>
      {sidebar}

      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-[#0c1524] text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-white/[0.06] rounded-xl transition-colors">
            <MenuIcon className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Utensils className="w-5 h-5" style={{ color: '#14917a' }} />
            <span className="font-bold">{title || 'Delivery Fast'}</span>
          </div>
        </div>
        <button onClick={handleSignOut} className="p-2 hover:bg-white/[0.06] rounded-xl transition-colors">
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 w-[280px] bg-[#0c1524] text-white z-50 flex flex-col"
            >
              <div className="px-7 pt-7 pb-6 flex items-center justify-between border-b border-white/[0.06]">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-[14px] flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #14917a, #0d7c67)' }}>
                    <Utensils className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-bold text-[17px]">Delivery Fast</span>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="p-2 hover:bg-white/[0.06] rounded-xl">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 px-5 py-6 space-y-1.5">
                {items.map((item) => {
                  const active = location.pathname === item.to
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setSidebarOpen(false)}
                      className={`group flex items-center gap-3.5 px-4 py-3 rounded-xl text-[14px] font-medium transition-all duration-200 ${
                        active
                          ? 'text-white shadow-lg'
                          : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                      }`}
                      style={active ? { background: 'linear-gradient(135deg, #14917a, #0d7c67)', boxShadow: '0 8px 24px rgba(20, 145, 130, 0.3)' } : undefined}
                    >
                      <span className={`flex items-center justify-center ${active ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`}>
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className="min-w-0 flex-1" style={{ background: '#f0f4f8' }}>
        <div className="lg:hidden h-14" />

        <div className="hidden lg:flex h-[84px] items-center border-b border-slate-200/60 px-8" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)' }}>
          <div className="w-full max-w-[1600px] mx-auto flex items-center gap-6">
            <div className="flex-1 max-w-xl">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-slate-400" />
                <input
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/80 pl-13 pr-4 text-[14px] text-slate-700 placeholder:text-slate-400 outline-none transition-all focus:border-[#14917a] focus:bg-white focus:shadow-[0_0_0_3px_rgba(20,145,130,0.1)]"
                  placeholder="Buscar produtos ou pedidos..."
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button className="relative p-3 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors">
                <Bell className="w-[20px] h-[20px]" />
                <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-crimson-500 ring-2 ring-white" />
              </button>
              <button className="p-3 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors">
                <HelpCircle className="w-[20px] h-[20px]" />
              </button>
              <button
                className="ml-2 flex items-center gap-2 h-11 px-5 rounded-xl text-white font-semibold text-[13px] shadow-lg transition-all hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #14917a, #0d7c67)', boxShadow: '0 4px 16px rgba(20, 145, 130, 0.35)' }}
              >
                <Plus className="w-[18px] h-[18px]" />
                Novo Pedido
              </button>
            </div>

            <div className="flex items-center gap-3 pl-5 border-l border-slate-200">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, #14917a, #0d7c67)' }}>
                {profile?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="hidden xl:block">
                <p className="text-[13px] font-bold text-slate-800 leading-tight">{profile?.name || 'Usuário'}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{roleDescription}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="safe-screen-padding w-full min-w-0 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1600px] min-w-0">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
