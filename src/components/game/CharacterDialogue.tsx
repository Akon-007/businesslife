import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { MessageSquare, Send, ShieldCheck } from 'lucide-react'
import { fetchCharacters, talkToCharacter, type AiCharacter } from '../../lib/api'
import type { GameState } from '../../game/types'
import { PanelSection } from './bits'

interface Turn {
  who: 'you' | 'them'
  name: string
  text: string
  meta?: string
  blocked?: boolean
}

/**
 * Dialogue with an in-world character (investor, customer, employee, supplier…).
 *
 * The characters, their knowledge scope and the guardrails all come from the
 * server; this panel never builds a prompt and never changes game state — it
 * sends a message and renders what the gateway returns.
 */
export function CharacterDialogue({ game }: { game: GameState }) {
  const [characters, setCharacters] = useState<AiCharacter[]>([])
  const [selected, setSelected] = useState('investor')
  const [message, setMessage] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [provider, setProvider] = useState('')
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!game.backendCompanyId) return
    let cancelled = false
    fetchCharacters(game.backendCompanyId)
      .then((catalog) => {
        if (cancelled) return
        setCharacters(catalog.characters.filter((character) => character.id !== 'nova'))
        setProvider(catalog.provider)
        setSelected((current) =>
          catalog.characters.some((character) => character.id === current && character.id !== 'nova')
            ? current
            : catalog.characters.find((character) => character.id !== 'nova')?.id ?? 'investor',
        )
      })
      .catch(() => {
        if (!cancelled) setError('Characters are unavailable until the run is connected to the server.')
      })
    return () => {
      cancelled = true
    }
  }, [game.backendCompanyId])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns])

  const active = characters.find((character) => character.id === selected)

  const send = async (event: React.FormEvent) => {
    event.preventDefault()
    const text = message.trim()
    if (!text) return
    if (!game.backendCompanyId) {
      setError('Connect to the server before talking — characters only see server-verified figures.')
      return
    }
    setPending(true)
    setError('')
    setTurns((current) => [...current, { who: 'you', name: 'You', text }])
    setMessage('')
    try {
      const reply = await talkToCharacter(game.backendCompanyId, selected, text)
      setTurns((current) => [
        ...current,
        {
          who: 'them',
          name: active?.name ?? 'Character',
          text: reply.reply,
          meta: `${reply.provider} · ${reply.grounded.length} grounded figures · ${reply.rateRemaining} left this window`,
          blocked: reply.blocked,
        },
      ])
      if (reply.blocked) setError(`Guardrail: ${reply.reason ?? 'that message was blocked'}.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The character is unavailable right now.')
    } finally {
      setPending(false)
    }
  }

  return (
    <PanelSection
      title="Talk to a stakeholder"
      hint="Every character has a goal, a narrow slice of your numbers, and no ability to change them."
      action={
        provider ? (
          <span className="rounded-full bg-paper-3 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-ink-500">
            {provider === 'deterministic' ? 'offline replies' : 'live model'}
          </span>
        ) : undefined
      }
    >
      {characters.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Choose who to talk to">
          {characters.map((character) => (
            <button
              key={character.id}
              type="button"
              onClick={() => setSelected(character.id)}
              aria-pressed={selected === character.id}
              className={clsx(
                'rounded-full px-2.5 py-1 text-[10.5px] font-semibold transition',
                selected === character.id ? 'bg-ink text-white' : 'bg-paper-3/80 text-ink-500 hover:bg-paper-3 hover:text-ink',
              )}
            >
              {character.name}
            </button>
          ))}
        </div>
      )}

      {active && (
        <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-paper-3/60 px-3 py-2 text-[10.5px] leading-relaxed text-ink-500">
          <MessageSquare className="mt-0.5 size-3.5 shrink-0" />
          <span>
            <strong className="font-semibold text-ink-600">{active.role}.</strong> {active.personality} Knows: {active.knowledge.slice(0, 6).join(', ')}.
          </span>
        </p>
      )}

      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-label="Conversation"
        className={clsx('mt-2 space-y-2 overflow-y-auto', turns.length ? 'max-h-64 pr-1' : '')}
      >
        {turns.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-3 py-3 text-[11px] text-ink-400">
            Ask something they would actually be asked. They answer from your numbers, not from a script.
          </p>
        ) : (
          turns.map((turn, index) => (
            <div
              key={`${turn.who}-${index}`}
              className={clsx(
                'rounded-2xl px-3 py-2 text-[11.5px] leading-relaxed',
                turn.who === 'you' ? 'bg-brand-50 text-ink-700' : turn.blocked ? 'bg-gold-soft text-ink-700' : 'bg-white text-ink-700 ring-1 ring-line',
              )}
            >
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-ink-400">{turn.name}</p>
              <p className="mt-1">{turn.text}</p>
              {turn.meta && <p className="mt-1.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-ink-400">{turn.meta}</p>}
            </div>
          ))
        )}
      </div>

      <form onSubmit={send} className="mt-2 flex gap-2">
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={600}
          placeholder={active ? `Message ${active.name.split(' ')[0]}…` : 'Write a message…'}
          aria-label="Message the character"
          className="h-10 w-full rounded-xl border border-line bg-white px-3 text-[11.5px] text-ink outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
        <button
          type="submit"
          disabled={pending || !message.trim()}
          aria-label="Send message"
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink text-white transition hover:bg-ink-800 disabled:opacity-40"
        >
          <Send className="size-4" />
        </button>
      </form>

      {error ? <p className="mt-2 rounded-xl bg-coral-soft px-3 py-2 text-[10.5px] font-semibold text-coral">{error}</p> : null}

      <p className="mt-2 flex items-center gap-1.5 text-[10px] text-ink-400">
        <ShieldCheck className="size-3.5" /> No tools, no state changes, rate limited per company.
      </p>
    </PanelSection>
  )
}
