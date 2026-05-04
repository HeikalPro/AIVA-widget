import type { Schema } from 'hast-util-sanitize'
import { defaultSchema } from 'rehype-sanitize'

const OC = '\u201C'
const CC = '\u201D'

/** Escape text placed inside HTML span body (not attributes). */
function escapeHtmlText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const CODE_FENCE = /```[\s\S]*?```/g

/**
 * Wraps typographic and straight-quoted names (e.g. product titles in Arabic) so
 * they render with clear punctuation and bidi isolation. Code fences are left
 * untouched. Injected markup uses single-quoted attributes so ASCII `"` in the
 * pattern does not collide with `class="…"`.
 */
function wrapQuotedPhrases(prose: string): string {
  let s = prose
  // Curly pair “…” (U+201C / U+201D)
  s = s.replace(/\u201C([^\u201D\n]{1,200})\u201D/g, (full, inner: string) => {
    if (/<\/?[a-z]/i.test(inner)) return full
    return `<span class='quoted-phrase'>${OC}${escapeHtmlText(inner)}${CC}</span>`
  })
  // ASCII "…" when the phrase includes Arabic script (common model output)
  s = s.replace(
    /"([^"\n]{0,120}[\u0600-\u06FF][^"\n]{0,120})"/g,
    (full, inner: string) => {
      if (/<\/?[a-z]/i.test(inner)) return full
      return `<span class='quoted-phrase'>${OC}${escapeHtmlText(inner)}${CC}</span>`
    },
  )
  return s
}

export function enhanceAssistantMarkdown(md: string): string {
  const fences: string[] = []
  const stripped = md.replace(CODE_FENCE, (block) => {
    fences.push(block)
    return `\n\n@@FENCE_${fences.length - 1}@@\n\n`
  })
  const wrapped = wrapQuotedPhrases(stripped)
  return wrapped.replace(/@@FENCE_(\d+)@@/g, (_, i) => fences[Number(i)] ?? '')
}

/** Allow only our quoted-name span class; all other HTML stays GitHub-safe. */
export const assistantMarkdownSanitizeSchema: Schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    span: [...(defaultSchema.attributes?.span ?? []), ['className', 'quoted-phrase']],
  },
}
