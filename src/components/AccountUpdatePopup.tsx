import { useEffect, useId, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { AccountUpdate } from '@/services/accountUpdatesClient'

type Props = {
  open: boolean
  updates: AccountUpdate[]
  onDismiss: () => void
}

export function AccountUpdatePopup({ open, updates, onDismiss }: Props) {
  const labelId = useId()
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (open) setIndex(0)
  }, [open, updates])

  const current = updates[index]
  const hasMultiple = updates.length > 1

  function handleNext() {
    if (index < updates.length - 1) {
      setIndex((i) => i + 1)
    } else {
      onDismiss()
    }
  }

  return (
    <AnimatePresence>
      {open && current && (
        <>
          <motion.button
            type="button"
            aria-label="Close updates"
            className="fixed inset-0 z-[70] bg-slate-900/30 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onDismiss}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelId}
            className="no-drag fixed bottom-0 left-0 right-0 z-[75] mx-auto w-full max-w-md rounded-t-2xl border-2 border-widget-strong bg-white p-5 shadow-widget sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:rounded-2xl sm:-translate-x-1/2 sm:-translate-y-1/2"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          >
            <div className="mb-3 flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-amber-300 bg-amber-50 text-lg">
                🔔
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                  New update
                  {current.account_name ? ` · ${current.account_name}` : ''}
                </p>
                <h2 id={labelId} className="mt-0.5 text-base font-semibold text-slate-900">
                  {current.title}
                </h2>
              </div>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{current.body}</p>
            {hasMultiple && (
              <p className="mt-3 text-xs text-slate-500">
                {index + 1} of {updates.length} updates
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={onDismiss}
                className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="rounded-xl border border-gochat-dark bg-[#0057A8] px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-gochat-light"
              >
                {index < updates.length - 1 ? 'Next' : 'Got it'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}