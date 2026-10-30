import { clsx } from 'clsx'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Variant = 'primary' | 'secondary' | 'ghost' | 'dark' | 'lime'
type Size = 'sm' | 'md' | 'lg'

const base =
  'relative inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold tracking-[-0.01em] transition-[transform,background,box-shadow,color] duration-200 ease-out active:translate-y-px disabled:pointer-events-none disabled:opacity-50'

const variants: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white shadow-[0_10px_24px_-10px_rgba(9,107,65,0.65),inset_0_1px_0_rgba(255,255,255,0.16)] hover:bg-brand-700 hover:shadow-[0_14px_30px_-12px_rgba(9,107,65,0.7)]',
  secondary:
    'bg-white text-ink border border-line shadow-[0_1px_2px_rgba(10,29,46,0.05)] hover:border-line-strong hover:bg-paper-2',
  ghost: 'text-ink-600 hover:bg-ink/5 hover:text-ink',
  dark: 'bg-ink text-white shadow-[0_10px_24px_-12px_rgba(6,19,31,0.8)] hover:bg-ink-800',
  lime: 'bg-lime text-ink shadow-[0_10px_24px_-12px_rgba(201,242,105,0.7)] hover:brightness-[0.97]',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-[13px]',
  md: 'h-11 px-5 text-sm',
  lg: 'h-13 px-7 text-[15px]',
}

export const buttonClass = (variant: Variant = 'primary', size: Size = 'md', extra?: string) =>
  clsx(base, variants[variant], sizes[size], extra)

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  children: ReactNode
}

export function Button({ variant = 'primary', size = 'md', className, children, ...props }: ButtonProps) {
  return (
    <button className={buttonClass(variant, size, className)} {...props}>
      {children}
    </button>
  )
}

type ButtonLinkProps = {
  to: string
  variant?: Variant
  size?: Size
  className?: string
  children: ReactNode
  onClick?: () => void
}

export function ButtonLink({ to, variant = 'primary', size = 'md', className, children, onClick }: ButtonLinkProps) {
  return (
    <Link to={to} onClick={onClick} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  )
}
