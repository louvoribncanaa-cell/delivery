import { Lock } from 'lucide-react'

interface CashierClosedProps {
  pageName: string
}

export default function CashierClosed({ pageName }: CashierClosedProps) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="flex items-center justify-center mx-auto mb-6">
          <div className="relative">
            <div className="w-24 h-24 bg-crimson-100 rounded-full flex items-center justify-center animate-pulse">
              <Lock className="w-12 h-12 text-crimson-500" />
            </div>
            <div className="absolute inset-0 w-24 h-24 rounded-full border-2 border-crimson-300 animate-ping opacity-30" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Caixa Fechado</h2>
        <p className="text-slate-500 mb-1">
          O caixa está fechado no momento.
        </p>
        <p className="text-sm text-slate-400">
          A página de <strong>{pageName}</strong> será liberada assim que o caixa for aberto.
        </p>
        <div className="mt-6 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-sm text-amber-700">
            Solicite ao responsável pelo caixa para abri-lo.
          </p>
        </div>
      </div>
    </div>
  )
}
