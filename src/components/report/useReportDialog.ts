import { useEffect, useRef, type RefObject } from 'react'

/** Keep keyboard focus and scrolling inside the current report dialog, without moving the page. */
export function useReportDialog(ref: RefObject<HTMLElement>, onClose: () => void, blocked = false) {
  const close = useRef(onClose)
  close.current = onClose
  const busy = useRef(blocked)
  busy.current = blocked
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const root = ref.current
    root?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (!busy.current) close.current()
      }
      if (event.key !== 'Tab' || !root) return
      const controls = [...root.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]')]
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (!first) { event.preventDefault(); return }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === root)) {
        event.preventDefault(); last.focus({ preventScroll: true })
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === root)) {
        event.preventDefault(); first.focus({ preventScroll: true })
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [ref])
}
