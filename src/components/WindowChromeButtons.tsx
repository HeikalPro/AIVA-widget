type Props = {
  /** First button (−): e.g. minimize window (login) or collapse chat to bubble (chat). */
  onMinimize: () => void
  onClose: () => void
  /** Accessibility label for the − button. */
  firstButtonAriaLabel?: string
}

/** Frameless window controls: − (minimize or collapse) and × (quit). */
export function WindowChromeButtons({ onMinimize, onClose, firstButtonAriaLabel = 'Minimize' }: Props) {
  return (
    <div
      className="no-drag flex items-center gap-0.5"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onMinimize()
        }}
        aria-label={firstButtonAriaLabel}
        className="flex h-8 w-9 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
      >
        <svg className="h-[3px] w-3" viewBox="0 0 12 2" aria-hidden>
          <rect width="12" height="2" rx="0.5" fill="currentColor" />
        </svg>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        aria-label="Close"
        className="flex h-8 w-9 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path
            d="M3 3l6 6M9 3l-6 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  )
}
