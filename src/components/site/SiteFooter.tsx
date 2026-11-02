import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { Logo } from '../ui/Logo'
import { buttonClass } from '../ui/Button'

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'The simulation', href: '/play' },
      { label: 'How it works', href: '/#how' },
      { label: 'For programmes', href: '/#programmes' },
      { label: 'FAQ', href: '/#faq' },
    ],
  },
  {
    title: 'Learners',
    links: [
      { label: 'Students & MBA', href: '/play' },
      { label: 'Founders', href: '/play' },
      { label: 'Career switchers', href: '/play' },
      { label: 'Faculty guide', href: '/#programmes' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/#world' },
      { label: 'Stories', href: '/#stories' },
      { label: 'Contact', href: 'mailto:hello@businesslife.app' },
      { label: 'Help & FAQ', href: '/#faq' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden bg-ink-950 pb-10 pt-16 text-white sm:pt-20">
      <div className="pointer-events-none absolute -left-24 top-0 size-80 rounded-full bg-brand-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 size-96 rounded-full bg-lime/10 blur-3xl" />

      <div className="container-page relative">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_2fr]">
          <div>
            <Logo dark />
            <p className="mt-5 max-w-xs text-[15px] leading-relaxed text-white/55">
              The business simulator where every decision has a receipt. Build a company, live with the consequences,
              and learn what you would actually do.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link to="/play" className={buttonClass('lime', 'md')}>
                Start your company
              </Link>
              <a
                href="mailto:programmes@businesslife.app"
                className="inline-flex h-11 items-center gap-2 rounded-full border border-white/15 px-5 text-sm font-semibold text-white/80 transition hover:border-white/30 hover:text-white"
              >
                For programmes
                <ArrowUpRight className="size-4" />
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {COLUMNS.map((column) => (
              <div key={column.title}>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/35">{column.title}</p>
                <ul className="mt-4 space-y-2.5">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      {link.href.startsWith('mailto:') ? (
                        <a
                          href={link.href}
                          className="text-[13.5px] font-medium text-white/60 transition hover:text-white"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link to={link.href} className="text-[13.5px] font-medium text-white/60 transition hover:text-white">
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-white/10 pt-6 text-[12px] text-white/35 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 BUSINESSLIFE. Meridian City is a fictional place. Simulated outcomes are for learning, not advice.</p>
          <div className="flex items-center gap-4">
            <span>Built for the people who will run things.</span>
            <span className="hidden h-1 w-1 rounded-full bg-white/25 sm:block" />
            <a href="mailto:hello@businesslife.app" className="transition hover:text-white/70">
              hello@businesslife.app
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
