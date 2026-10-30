import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Menu, X } from 'lucide-react'
import { Logo } from '../ui/Logo'
import { buttonClass } from '../ui/Button'
import { clsx } from 'clsx'

const LINKS = [
  { label: 'The world', href: '#world' },
  { label: 'How it works', href: '#how' },
  { label: 'For programmes', href: '#programmes' },
  { label: 'FAQ', href: '#faq' },
]

export function SiteNav({ overlay = false }: { overlay?: boolean }) {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()
  const onLanding = location.pathname === '/'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  const solid = !overlay || scrolled

  return (
    <>
      <header
        className={clsx(
          'fixed inset-x-0 top-0 z-50 transition-[padding] duration-300',
          scrolled ? 'py-2.5' : 'py-4',
        )}
      >
        <div className="container-page">
          <div
            className={clsx(
              'flex items-center justify-between gap-3 rounded-full px-3 py-2.5 transition duration-300 sm:px-4',
              solid ? 'glass-strong shadow-soft' : 'border border-white/50 bg-white/55 backdrop-blur-md',
            )}
          >
            <Link to="/" aria-label="BUSINESSLIFE home" className="shrink-0 pl-1">
              <Logo />
            </Link>

            <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
              {LINKS.map((link) => (
                <a
                  key={link.href}
                  href={onLanding ? link.href : `/${link.href}`}
                  className="rounded-full px-3.5 py-2 text-[13px] font-semibold text-ink-600 transition hover:bg-ink/5 hover:text-ink"
                >
                  {link.label}
                </a>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              <Link
                to="/play"
                className="hidden rounded-full px-3.5 py-2 text-[13px] font-semibold text-ink-600 transition hover:bg-ink/5 hover:text-ink sm:block"
              >
                Log in
              </Link>
              <Link to="/play" className={buttonClass('primary', 'sm', 'pr-3.5')}>
                Start free
                <ArrowRight className="size-3.5" />
              </Link>
              <button
                type="button"
                aria-label={open ? 'Close menu' : 'Open menu'}
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
                className="grid size-9 place-items-center rounded-full bg-ink/5 text-ink transition hover:bg-ink/10 lg:hidden"
              >
                {open ? <X className="size-4" /> : <Menu className="size-4" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-ink-950/40 backdrop-blur-sm lg:hidden"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ y: -16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -12, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="glass-strong mx-4 mt-24 rounded-3xl p-3"
              onClick={(event) => event.stopPropagation()}
            >
              {LINKS.map((link) => (
                <a
                  key={link.href}
                  href={onLanding ? link.href : `/${link.href}`}
                  className="flex items-center justify-between rounded-2xl px-4 py-3.5 text-[15px] font-semibold text-ink transition hover:bg-ink/5"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                  <ArrowRight className="size-4 text-ink-400" />
                </a>
              ))}
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-line/80 pt-3">
                <Link to="/play" className={buttonClass('secondary', 'md')} onClick={() => setOpen(false)}>
                  Log in
                </Link>
                <Link to="/play" className={buttonClass('primary', 'md')} onClick={() => setOpen(false)}>
                  Start free
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
