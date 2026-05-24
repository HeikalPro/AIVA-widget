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
            className="fixed inset-0 z-[80] bg-black/55 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !submitting && onClose()}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelId}
            className="no-drag fixed bottom-0 left-0 right-0 z-[90] mx-auto max-h-[min(70vh,28rem)] w-full max-w-lg rounded-t-2xl border border-white/[0.12] bg-zinc-900/95 p-4 shadow-2xl backdrop-blur-xl sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[min(80vh,22rem)] sm:rounded-2xl sm:-translate-x-1/2 sm:-translate-y-1/2"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          >
            <h2 id={labelId} className="text-sm font-semibold text-zinc-100">
              {initialFeedback ? 'Edit your feedback' : 'What went wrong?'}
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
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
                className="w-full resize-none rounded-xl border border-white/[0.12] bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 outline-none ring-violet-500/30 placeholder:text-zinc-600 focus:border-violet-500/40 focus:ring-2 disabled:opacity-50"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={onClose}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !text.trim()}
                  className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
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
