/**
 * A very small PDF writer.
 *
 * The product needs two documents — a month report and a run scorecard — and
 * nothing else. Pulling a PDF library in for that would add a dependency (and a
 * bundle) for about a hundred lines of arithmetic, so the documents are written
 * directly: one content stream per page, Helvetica for text, a real xref table
 * so every reader accepts the file.
 *
 * Constraints, deliberately: text only (no images, no embedded fonts), ASCII
 * only (the ₦ symbol is not in WinAnsi — amounts print as "NGN"), and page
 * coordinates measured from the bottom-left, like the format itself.
 */

export type Rgb = readonly [number, number, number]

export interface PdfText {
  kind: 'text'
  x: number
  y: number
  text: string
  size: number
  bold?: boolean
  color?: Rgb
}

export interface PdfRule {
  kind: 'rule'
  x: number
  y: number
  width: number
  thickness?: number
  color?: Rgb
}

export interface PdfRect {
  kind: 'rect'
  x: number
  y: number
  width: number
  height: number
  fill: Rgb
}

export type PdfItem = PdfText | PdfRule | PdfRect

export interface PdfPage {
  width: number
  height: number
  items: PdfItem[]
}

export interface PdfMeta {
  title: string
  author?: string
  subject?: string
}

export const A4 = { width: 595.28, height: 841.89 } as const

export const INK: Rgb = [0.063, 0.094, 0.153]
export const MUTED: Rgb = [0.35, 0.4, 0.5]
export const BRAND: Rgb = [0.09, 0.42, 1]
export const SUCCESS: Rgb = [0.09, 0.62, 0.47]
export const GOLD: Rgb = [0.96, 0.65, 0.14]
export const CORAL: Rgb = [0.79, 0.19, 0.17]
export const RULE: Rgb = [0.85, 0.88, 0.93]
export const PAPER: Rgb = [0.96, 0.97, 0.99]

/**
 * PDF strings are Latin-1 and parenthesised. Anything outside the safe set is
 * transliterated rather than dropped: a document that silently loses the naira
 * sign looks like a bug, one that says "NGN" does not.
 */
export function pdfSafe(value: string): string {
  return String(value ?? '')
    .replace(/₦/g, 'NGN ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\u00b7\u2022]/g, '-')
    .replace(/\u00d7/g, 'x')
    .replace(/\u2192/g, '->')
    .replace(/\u00a0/g, ' ')
    .replace(/[^\x20-\x7E]/g, '?')
}

const escape = (value: string) => pdfSafe(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

const colour = (value: Rgb) => `${value[0].toFixed(3)} ${value[1].toFixed(3)} ${value[2].toFixed(3)}`

function renderItem(item: PdfItem): string {
  if (item.kind === 'text') {
    const rgb = colour(item.color ?? INK)
    return [
      'BT',
      `/${item.bold ? 'F2' : 'F1'} ${item.size.toFixed(2)} Tf`,
      `${rgb} rg`,
      `1 0 0 1 ${item.x.toFixed(2)} ${item.y.toFixed(2)} Tm`,
      `(${escape(item.text)}) Tj`,
      'ET',
    ].join('\n')
  }
  if (item.kind === 'rule') {
    const rgb = colour(item.color ?? RULE)
    const thickness = item.thickness ?? 0.7
    return `${rgb} RG\n${thickness.toFixed(2)} w\n${item.x.toFixed(2)} ${item.y.toFixed(2)} m\n${(item.x + item.width).toFixed(2)} ${item.y.toFixed(2)} l\nS`
  }
  const rgb = colour(item.fill)
  return `${rgb} rg\n${item.x.toFixed(2)} ${item.y.toFixed(2)} ${item.width.toFixed(2)} ${item.height.toFixed(2)} re\nf`
}

/** Latin-1 bytes, so string offsets and file offsets are the same number. */
function bytes(value: string): Uint8Array {
  const out = new Uint8Array(value.length)
  for (let index = 0; index < value.length; index += 1) out[index] = value.charCodeAt(index) & 0xff
  return out
}

/**
 * Assemble the file. Object numbering: 1 catalog, 2 pages, 3/4 fonts, then a
 * page/content pair per page from 5 up, with the info dictionary last.
 */
export function buildPdf(pages: PdfPage[], meta: PdfMeta): Uint8Array {
  if (pages.length === 0) throw new Error('a PDF needs at least one page')

  const chunks: Array<{ number: number; body: string }> = []
  const pageNumbers: number[] = []
  let next = 5

  for (const page of pages) {
    const pageNumber = next
    const contentNumber = next + 1
    next += 2
    pageNumbers.push(pageNumber)
    const stream = page.items.map(renderItem).join('\n')
    chunks.push({
      number: pageNumber,
      body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width.toFixed(2)} ${page.height.toFixed(2)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentNumber} 0 R >>`,
    })
    chunks.push({
      number: contentNumber,
      body: `<< /Length ${bytes(stream).length} >>\nstream\n${stream}\nendstream`,
    })
  }

  const infoNumber = next
  chunks.unshift(
    { number: 1, body: '<< /Type /Catalog /Pages 2 0 R >>' },
    { number: 2, body: `<< /Type /Pages /Kids [${pageNumbers.map((number) => `${number} 0 R`).join(' ')}] /Count ${pages.length} >>` },
    { number: 3, body: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>' },
    { number: 4, body: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>' },
  )
  chunks.push({
    number: infoNumber,
    body: `<< /Title (${escape(meta.title)}) /Author (${escape(meta.author ?? 'BusinessLife')}) /Subject (${escape(meta.subject ?? 'Business simulation report')}) /Producer (BusinessLife) >>`,
  })
  chunks.sort((a, b) => a.number - b.number)

  let file = '%PDF-1.4\n'
  const offsets: number[] = []
  for (const chunk of chunks) {
    offsets[chunk.number] = bytes(file).length
    file += `${chunk.number} 0 obj\n${chunk.body}\nendobj\n`
  }

  const xrefOffset = bytes(file).length
  let xref = `xref\n0 ${infoNumber + 1}\n0000000000 65535 f \n`
  for (let number = 1; number <= infoNumber; number += 1) {
    xref += `${String(offsets[number] ?? 0).padStart(10, '0')} 00000 n \n`
  }
  file += `${xref}trailer\n<< /Size ${infoNumber + 1} /Root 1 0 R /Info ${infoNumber} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`

  return bytes(file)
}

/**
 * A cursor for laying out a page from the top down, so the report code reads
 * like the document does.
 */
export class PageBuilder {
  readonly page: PdfPage
  private y: number

  constructor(margin = 56, page: { width: number; height: number } = A4) {
    this.page = { width: page.width, height: page.height, items: [] }
    this.y = page.height - margin
  }

  get cursor(): number {
    return this.y
  }

  move(delta: number): this {
    this.y -= delta
    return this
  }

  text(value: string, options: { x?: number; size?: number; bold?: boolean; color?: Rgb } = {}): this {
    this.page.items.push({
      kind: 'text',
      x: options.x ?? 56,
      y: this.y,
      text: pdfSafe(value),
      size: options.size ?? 10,
      bold: options.bold ?? false,
      color: options.color ?? INK,
    })
    return this
  }

  line(value: string, options: { size?: number; bold?: boolean; color?: Rgb; gap?: number } = {}): this {
    this.text(value, options)
    this.y -= options.gap ?? (options.size ?? 10) + 5
    return this
  }

  pair(label: string, value: string, options: { size?: number; labelWidth?: number; color?: Rgb } = {}): this {
    this.text(label, { size: options.size ?? 9.5, color: options.color ?? MUTED })
    this.page.items.push({
      kind: 'text',
      x: 56 + (options.labelWidth ?? 190),
      y: this.y,
      text: pdfSafe(value),
      size: options.size ?? 9.5,
      bold: true,
      color: INK,
    })
    this.y -= (options.size ?? 9.5) + 4
    return this
  }

  rule(options: { width?: number; thickness?: number; color?: Rgb; gap?: number } = {}): this {
    this.page.items.push({
      kind: 'rule',
      x: 56,
      y: this.y,
      width: options.width ?? this.page.width - 112,
      thickness: options.thickness ?? 0.8,
      color: options.color ?? RULE,
    })
    this.y -= options.gap ?? 12
    return this
  }

  tile(x: number, width: number, label: string, value: string, tone: Rgb = INK): this {
    const height = 46
    this.page.items.push({ kind: 'rect', x, y: this.y - height + 12, width, height, fill: PAPER })
    this.page.items.push({ kind: 'text', x: x + 10, y: this.y - 4, text: pdfSafe(label), size: 7.5, color: MUTED })
    this.page.items.push({ kind: 'text', x: x + 10, y: this.y - 24, text: pdfSafe(value), size: 13, bold: true, color: tone })
    return this
  }

  newPage(): PageBuilder {
    return new PageBuilder(56, { width: this.page.width, height: this.page.height })
  }
}
