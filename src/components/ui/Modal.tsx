import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { clsx } from 'clsx'

export function Modal({
  open,
  onClose,
  children,
  title,
  description,
  size = 'md',
  dismissible = true,
  className,
  dark,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  title?: ReactNode
  description?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  dismissible?: boolean
  className?: string
  dark?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissible) onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const timer = window.setTimeout(() => ref.current?.focus(), 50)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previous
      window.clearTimeout(timer)
    }
  }, [open, dismissible, onClose])

  if (typeof document === 'undefined') return null

  const widths = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl',
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto p-3 sm:p-6">
          <motion.button
            type="button"
            aria-label="Close dialog"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 cursor-default bg-ink-950/55 backdrop-blur-[6px]"
            onClick={() => dismissible && onClose()}
            tabIndex={-1}
          />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            tabIndex={-1}
            initial={{ opacity: 0, y: 24, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.99 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className={clsx(
              'relative my-auto w-full overflow-hidden rounded-[26px] outline-none',
              dark ? 'text-white' : 'bg-paper-2 text-ink',
              'shadow-[0_40px_100px_-30px_rgba(6,19,31,0.6)] ring-1 ring-black/5',
              widths[size],
              className,
            )}
          >
            {(title || dismissible) && (
              <div className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-7 sm:pt-6">
                <div>
                  {title && (
                    <h3 id={titleId} className="font-display text-xl font-semibold tracking-[-0.03em] sm:text-2xl">
                      {title}
                    </h3>
                  )}
                  {description && (
                    <p className={clsx('mt-1 text-sm leading-relaxed', dark ? 'text-white/65' : 'text-ink-500')}>
                      {description}
                    </p>
                  )}
                </div>
                {dismissible && (
                  <button
                    onClick={onClose}
                    aria-label="Close"
                    className={clsx(
                      'grid size-9 shrink-0 place-items-center rounded-full transition',
                      dark ? 'bg-white/10 hover:bg-white/20' : 'bg-ink/5 text-ink-600 hover:bg-ink/10',
                    )}
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            )}
            <div className={clsx(title ? 'px-5 pb-5 pt-4 sm:px-7 sm:pb-7' : 'p-5 sm:p-7')}>{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
