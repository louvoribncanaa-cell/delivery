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
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto px-4 py-5 sm:p-10">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className={`w-full ${maxWidth} max-h-[calc(100dvh-2.5rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col sm:max-h-[85vh]`}
            >
              {title && (
                  <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-5 py-5 sm:px-8 sm:py-6">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900">{title}</h2>
                  <button
                    onClick={onClose}
                    className="mr-0.5 rounded-xl p-2.5 hover:bg-slate-100 transition-colors shrink-0"
                  >
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>
              )}
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-7">
                {children}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
