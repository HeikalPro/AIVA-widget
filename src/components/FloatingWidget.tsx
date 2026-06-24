import { useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { BrandLogo } from '@/components/BrandLogo'
import { ASSISTANT_BUBBLE_PX } from '@/services/chatWindowSize'

type Props = {
  onOpen: () => void
  activeUpdateCount?: number
}
/** Pixels of movement before a drag starts (avoids moving the window on small click jitter). */
const DRAG_SLOP_PX = 6

type DragState = {
  startScreenX: number
  startScreenY: number
  startBounds: { x: number; y: number; width: number; height: number }
  dragging: boolean
}

/**
 * Moves the Electron window by IPC so the bubble can sit anywhere on screen.
 * Short press without much movement opens the assistant (click vs drag).
 *
 * Pointer capture + bounds IPC must not run after `await`: React reuses synthetic
 * events, so `e.currentTarget` is unsafe after async. We capture the element and
 * `setPointerCapture` synchronously, then attach window listeners so moves still
 * arrive when the window is repositioned under the cursor (Windows).
 */
export function FloatingWidget({ onOpen, activeUpdateCount = 0 }: Props) {
  const dragRef = useRef<DragState | null>(null)

  const applyCollapsedPosition = useCallback((screenX: number, screenY: number, d: DragState) => {
    const dx = screenX - d.startScreenX
    const dy = screenY - d.startScreenY
    void window.nexa.window.setAssistantCollapsed({
      x: d.startBounds.x + dx,
      y: d.startBounds.y + dy,
      width: ASSISTANT_BUBBLE_PX,
      height: ASSISTANT_BUBBLE_PX,
    })
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return

      const el = e.currentTarget
      const pointerId = e.pointerId
      const startScreenX = e.screenX
      const startScreenY = e.screenY

      try {
        el.setPointerCapture(pointerId)
      } catch {
        // ignore
      }

      let gestureActive = true

      const endGesture = () => {
        gestureActive = false
        window.removeEventListener('pointermove', onWinMove)
        window.removeEventListener('pointerup', onWinUp)
        window.removeEventListener('pointercancel', onWinUp)
        try {
          el.releasePointerCapture(pointerId)
        } catch {
          // ignore
        }
      }

      const onWinMove = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return
        const d = dragRef.current
        if (!d) return
        const dx = ev.screenX - d.startScreenX
        const dy = ev.screenY - d.startScreenY
        if (!d.dragging) {
          if (dx * dx + dy * dy < DRAG_SLOP_PX * DRAG_SLOP_PX) return
          d.dragging = true
        }
        applyCollapsedPosition(ev.screenX, ev.screenY, d)
      }

      const onWinUp = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return

        const d = dragRef.current
        dragRef.current = null

        const dx = ev.screenX - startScreenX
        const dy = ev.screenY - startScreenY
        const withinClickSlop = dx * dx + dy * dy < DRAG_SLOP_PX * DRAG_SLOP_PX

        endGesture()

        if (!d) {
          // Pointer released before getBounds() finished — treat as click if movement was tiny.
          if (withinClickSlop) onOpen()
          return
        }
        if (!d.dragging) {
          onOpen()
        }
      }

      window.addEventListener('pointermove', onWinMove)
      window.addEventListener('pointerup', onWinUp)
      window.addEventListener('pointercancel', onWinUp)

      void window.nexa.window.getBounds().then((bounds) => {
        if (!gestureActive) return
        if (!bounds) return
        dragRef.current = {
          startScreenX,
          startScreenY,
          startBounds: bounds,
          dragging: false,
        }
      })
    },
    [applyCollapsedPosition, onOpen]
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onOpen()
      }
    },
    [onOpen]
  )

  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-label="Open Aiva assistant. Drag to move."
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 520, damping: 32 }}
      className="no-drag relative h-full w-full cursor-grab rounded-full outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-gochat/35"
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      <div
        className="pointer-events-none relative flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-widget-strong bg-white p-1.5 shadow-gochat"
        aria-hidden
      >
        <BrandLogo className="h-full w-full rounded-full object-contain" />
        {activeUpdateCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
            {activeUpdateCount > 9 ? '9+' : activeUpdateCount}
          </span>
        )}
      </div>
    </motion.div>
  )
}
