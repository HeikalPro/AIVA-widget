import { AnimatePresence, motion } from 'framer-motion'

type Props = {
  message: string | null
  variant?: 'error' | 'info' | 'success'
}

export function Toast({ message, variant = 'error' }: Props) {
  const styles =
    variant === 'error'
      ? 'border-red-500/35 bg-red-950/90 text-red-100'
      : variant === 'success'
        ? 'border-emerald-500/35 bg-emerald-950/90 text-emerald-100'
        : 'border-white/[0.12] bg-zinc-900/95 text-zinc-200'
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className={`no-drag pointer-events-none fixed bottom-20 left-1/2 z-[100] max-w-[min(92vw,20rem)] -translate-x-1/2 rounded-xl border px-3 py-2 text-center text-xs shadow-lg backdrop-blur-md ${styles}`}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
