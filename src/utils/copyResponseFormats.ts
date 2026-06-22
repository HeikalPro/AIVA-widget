/** Plain-text transforms for one-click agent copy (email vs live chat). */

function stripMarkdown(raw: string): string {
  let text = raw.replace(/\r\n/g, '\n').trim()
  if (!text) return ''

  text = text.replace(/```[\s\S]*?```/g, (block) =>
    block.replace(/^```[^\n]*\n?/, '').replace(/```$/, '').trim(),
  )
  text = text.replace(/`([^`]+)`/g, '$1')
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  text = text.replace(/^#{1,6}\s+/gm, '')
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1')
  text = text.replace(/\*([^*]+)\*/g, '$1')
  text = text.replace(/__([^_]+)__/g, '$1')
  text = text.replace(/_([^_]+)_/g, '$1')
  text = text.replace(/^\s*[-*+]\s+/gm, '• ')
  text = text.replace(/^\s*(\d+)\.\s+/gm, '$1. ')
  text = text.replace(/\n{3,}/g, '\n\n')

  return text.trim()
}

function splitBlocks(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
}

function blockToNumberedSteps(block: string): string[] {
  const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
  const allBullets = lines.every((l) => /^[•\-*]\s/.test(l) || /^\d+\.\s/.test(l))
  if (!allBullets) return [block]

  return lines.map((line, i) => {
    const cleaned = line.replace(/^[•\-*]\s+/, '').replace(/^\d+\.\s+/, '')
    return `${i + 1}. ${cleaned}`
  })
}

/** Formal email body with greeting, structured steps, and sign-off. */
export function formatAsEmail(content: string): string {
  const plain = stripMarkdown(content)
  if (!plain) return ''

  const blocks = splitBlocks(plain)
  const bodyParts: string[] = []

  for (const block of blocks) {
    const steps = blockToNumberedSteps(block)
    if (steps.length > 1) {
      bodyParts.push(steps.join('\n'))
    } else {
      bodyParts.push(block)
    }
  }

  const body = bodyParts.join('\n\n')
  return ['Dear Customer,', '', body, '', 'Best regards,', 'GoChat247 Support'].join('\n')
}

function shortenForChat(sentence: string, maxLen = 140): string {
  const s = sentence.trim()
  if (s.length <= maxLen) return s
  const cut = s.slice(0, maxLen - 1).trimEnd()
  const lastSpace = cut.lastIndexOf(' ')
  if (lastSpace > maxLen * 0.6) return `${cut.slice(0, lastSpace)}…`
  return `${cut}…`
}

/** Short bullet-style text for live chat platforms. */
export function formatAsChat(content: string): string {
  const plain = stripMarkdown(content)
  if (!plain) return ''

  const lines: string[] = []
  for (const block of splitBlocks(plain)) {
    const rowLines = block.split('\n').map((l) => l.trim()).filter(Boolean)
    const isList = rowLines.every((l) => /^[•\-*]\s/.test(l) || /^\d+\.\s/.test(l))

    if (isList && rowLines.length > 0) {
      for (const line of rowLines) {
        const cleaned = line.replace(/^[•\-*]\s+/, '').replace(/^\d+\.\s+/, '')
        lines.push(`• ${shortenForChat(cleaned)}`)
      }
    } else {
      const sentences = block
        .split(/(?<=[.!?؟])\s+/)
        .map((s) => s.trim())
        .filter(Boolean)
      if (sentences.length > 1) {
        for (const s of sentences) lines.push(`• ${shortenForChat(s)}`)
      } else {
        lines.push(shortenForChat(block))
      }
    }
  }

  return ['Hi!', '', ...lines].join('\n')
}

export async function copyTextToClipboard(text: string): Promise<void> {
  if (!text.trim()) throw new Error('Nothing to copy')
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(ta)
  if (!ok) throw new Error('Could not copy to clipboard')
}
