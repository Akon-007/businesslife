/**
 * Deterministic randomness.
 *
 * Academic use requires a scenario to be reproducible: the same seed and the
 * same decisions must produce the same company. Every draw in the engine is
 * therefore derived from `(seed, label, month)` rather than from Math.random,
 * which gives each month an independent but repeatable stream.
 */

/** FNV-1a over the parts, so labels and months hash into a stable 32-bit seed. */
export function hashSeed(...parts: Array<string | number>): number {
  let hash = 0x811c9dc5
  for (const part of parts) {
    const text = String(part)
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index)
      hash = Math.imul(hash, 0x01000193)
    }
    hash ^= 0x9e3779b9
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** mulberry32 — small, fast, well-distributed 32-bit PRNG. */
export function makeRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

/** A stream scoped to one purpose in one month of one run. */
export function rngFor(seed: number, label: string, ...parts: Array<string | number>): () => number {
  return makeRng(hashSeed(seed, label, ...parts))
}

export const randWith = (rng: () => number, min: number, max: number) => min + rng() * (max - min)

export const intWith = (rng: () => number, min: number, max: number) => Math.floor(min + rng() * (max - min + 1))

export const pickWith = <T,>(rng: () => number, values: readonly T[]): T => values[Math.floor(rng() * values.length)]

/** Shuffle a copy without mutating the input. */
export function shuffledWith<T>(rng: () => number, values: readonly T[]): T[] {
  const copy = [...values]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1))
    ;[copy[index], copy[swap]] = [copy[swap], copy[index]]
  }
  return copy
}

export const newSeed = () => Math.floor(Math.random() * 0xffffffff)
