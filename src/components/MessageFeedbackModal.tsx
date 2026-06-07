import { useEffect, useId, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type Props = {
  open: boolean
  submitting: boolean
  initialFeedback?: string
  onClose: () => void
  onSubmit: (feedback: string) => void
}

export function MessageFeedbackModal({ open, submitting, initialFeedback, onClose, onSubmit }: Props) {
  const labelId = useId()
  const [text, setText] = useState('')

  useEffect(() => {
    if (open) {
      setText(initialFeedback ?? '')
    } else {
      setText('')
    }
  }, [open, initialFeedback])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t || submitting) return
    onSubmit(t)
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close feedback dialog"
            className="fixed inset-0 z-[80] bg-slate-900/25 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !submitting && onClose()}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelId}
            className="no-drag fixed bottom-0 left-0 right-0 z-[90] mx-auto max-h-[min(70vh,28rem)] w-full max-w-lg rounded-t-2xl border-2 border-widget-strong bg-white p-5 shadow-widget sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[min(80vh,22rem)] sm:rounded-2xl sm:-translate-x-1/2 sm:-translate-y-1/2"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          >
            <h2 id={labelId} className="text-sm font-semibold text-slate-900">
              {initialFeedback ? 'Edit your feedback' : 'What went wrong?'}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {initialFeedback
                ? 'Update your feedback below, then submit.'
                : 'Your feedback is sent with this message. Required for a thumbs down.'}
            </p>
            <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={submitting}
                rows={4}
                required
                placeholder="Describe the issue…"
                className="w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-[border-color,box-shadow] placeholder:text-slate-400 focus:border-gochat focus:bg-white focus:ring-2 focus:ring-gochat/20 disabled:opacity-50"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={onClose}
                  className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !text.trim()}
                  className="rounded-xl border border-gochat-dark bg-[#0057A8] px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-gochat-light disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-400"
                >
                  {submitting ? 'Sending…' : 'Submit'}
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
