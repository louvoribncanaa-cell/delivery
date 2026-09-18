import type { ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  maxWidth?: string
}

export default function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-lg' }: ModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-3 sm:p-6 lg:p-10">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? 'modal-title' : undefined}
              className={`w-full ${maxWidth} max-h-[calc(100dvh-1.5rem)] overflow-hidden rounded-[1.75rem] border border-white/70 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)] flex flex-col sm:max-h-[86vh]`}
            >
              {title && (
                  <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4 sm:px-7 sm:py-5">
                  <h2 id="modal-title" className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">{title}</h2>
                  <button
                    onClick={onClose}
                    aria-label="Fechar janela"
                    className="mr-0.5 shrink-0 rounded-xl p-2.5 text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-800"
                  >
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>
              )}
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
                {children}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
