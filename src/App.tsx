import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { CashRegisterProvider } from './contexts/CashRegisterContext'
import Login from './pages/Login'
import Orders from './pages/Orders'
import Menu from './pages/Menu'
import Kitchen from './pages/Kitchen'
import Cashier from './pages/Cashier'
import CashManagement from './pages/CashManagement'
import Admin from './pages/Admin'
import History from './pages/History'
import MyOrders from './pages/MyOrders'
import type { ReactNode } from 'react'

function ProtectedRoute({ children, allowedRoles }: { children: ReactNode; allowedRoles?: string[] }) {
  const { profile, loading, hasRole } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  if (!profile) return <Navigate to="/login" replace />
  if (allowedRoles && !hasRole(...allowedRoles)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function AppRoutes() {
  const { profile, loading, roles } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  function getHomeRoute() {
    if (!profile) return '/login'
    if (roles.includes('admin')) return '/admin'
    if (roles.includes('atendente')) return '/orders'
    if (roles.includes('cozinha')) return '/kitchen'
    if (roles.includes('caixa')) return '/cashier'
    return '/menu'
  }

  return (
    <Routes>
      <Route path="/login" element={profile ? <Navigate to={getHomeRoute()} replace /> : <Login />} />
      <Route path="/menu" element={<Menu />} />

      <Route path="/orders" element={
        <ProtectedRoute allowedRoles={['atendente', 'admin']}>
          <Orders />
        </ProtectedRoute>
      } />

      <Route path="/kitchen" element={
        <ProtectedRoute allowedRoles={['cozinha', 'admin']}>
          <Kitchen />
        </ProtectedRoute>
      } />

      <Route path="/cashier" element={
        <ProtectedRoute allowedRoles={['caixa', 'admin']}>
          <Cashier dailyOnly />
        </ProtectedRoute>
      } />

      <Route path="/cash-management" element={
        <ProtectedRoute allowedRoles={['caixa', 'admin']}>
          <CashManagement />
        </ProtectedRoute>
      } />

      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <Admin />
        </ProtectedRoute>
      } />
      <Route path="/history" element={<ProtectedRoute allowedRoles={['admin', 'cozinha', 'caixa']}><History /></ProtectedRoute>} />
      <Route path="/my-orders" element={
        <ProtectedRoute allowedRoles={['atendente', 'admin']}>
          <MyOrders />
        </ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to={getHomeRoute()} replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CashRegisterProvider>
          <AppRoutes />
          <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#1e293b',
              color: '#f8fafc',
              borderRadius: '12px',
            },
            success: {
              iconTheme: { primary: '#10b981', secondary: '#f8fafc' },
            },
            error: {
              iconTheme: { primary: '#f43f5e', secondary: '#f8fafc' },
            },
          }}
        />
        </CashRegisterProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
