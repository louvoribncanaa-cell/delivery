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
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useState } from 'react'

const navItems: Record<string, { to: string; icon: ReactNode; label: string }[]> = {
  admin: [
    { to: '/admin', icon: <Settings className="w-5 h-5" />, label: 'Painel Admin' },
    { to: '/orders', icon: <ClipboardList className="w-5 h-5" />, label: 'Pedidos' },
    { to: '/my-orders', icon: <Receipt className="w-5 h-5" />, label: 'Meus Pedidos' },
    { to: '/kitchen', icon: <ChefHat className="w-5 h-5" />, label: 'Cozinha' },
    { to: '/cashier', icon: <CreditCard className="w-5 h-5" />, label: 'Caixa' },
    { to: '/history', icon: <History className="w-5 h-5" />, label: 'Histórico' },
  ],
  atendente: [
    { to: '/orders', icon: <ClipboardList className="w-5 h-5" />, label: 'Pedidos' },
    { to: '/my-orders', icon: <Receipt className="w-5 h-5" />, label: 'Meus Pedidos' },
  ],
  cozinha: [
    { to: '/kitchen', icon: <ChefHat className="w-5 h-5" />, label: 'Cozinha' },
    { to: '/history', icon: <History className="w-5 h-5" />, label: 'Histórico' },
  ],
  caixa: [
    { to: '/cashier', icon: <CreditCard className="w-5 h-5" />, label: 'Caixa' },
    { to: '/history', icon: <History className="w-5 h-5" />, label: 'Histórico' },
  ],
}

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  atendente: 'Atendente',
  cozinha: 'Cozinha',
  caixa: 'Caixa',
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

  // Une os menus de todas as funções do usuário, sem repetir destinos
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
    ? roles.map((r) => roleLabels[r] || r).join(' • ')
    : ''

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-slate-900 text-white">
        <div className="p-6 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
              <Utensils className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Delivery</h1>
              <p className="text-xs text-slate-400">{roleDescription}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                location.pathname === item.to
                  ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {item.icon}
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700/50">
          <div className="flex items-center gap-3 px-4 py-2 mb-2">
            <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-sm font-bold">
              {profile?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile?.name}</p>
              <p className="text-xs text-slate-400 truncate">{roleDescription}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-crimson-400 hover:bg-slate-800 transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sair</span>
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-slate-800 rounded-xl transition-colors">
            <MenuIcon className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Utensils className="w-5 h-5 text-amber-500" />
            <span className="font-bold">{title || 'Delivery'}</span>
          </div>
        </div>
        <button onClick={handleSignOut} className="p-2 hover:bg-slate-800 rounded-xl transition-colors">
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-black/50 z-50"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 w-72 bg-slate-900 text-white z-50 flex flex-col"
            >
              <div className="p-6 flex items-center justify-between border-b border-slate-700/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
                    <Utensils className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-bold text-lg">Delivery</span>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="p-2 hover:bg-slate-800 rounded-xl">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 p-4 space-y-1">
                {items.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      location.pathname === item.to
                        ? 'bg-amber-500 text-white shadow-lg'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {item.icon}
                    <span className="font-medium">{item.label}</span>
                  </Link>
                ))}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="min-w-0 flex-1 bg-slate-50 lg:bg-[#f6f8fb]">
        <div className="lg:hidden h-14" />
        <div className="hidden lg:flex h-20 items-center border-b border-slate-200/80 bg-white/80 px-8 backdrop-blur">
          <div className="w-full max-w-[1440px] mx-auto">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600">Delivery System</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title || 'Visão geral'}</h1>
          </div>
        </div>
        <div className="w-full min-w-0 px-3 py-4 sm:px-5 lg:px-8 lg:py-7">
          <div className="mx-auto w-full max-w-[1440px] min-w-0">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
