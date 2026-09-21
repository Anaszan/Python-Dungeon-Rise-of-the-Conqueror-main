import { describe, expect, it, vi } from 'vitest'

// soundEngine touches Web Audio at import time in a browser; only its mute
// state matters here.
vi.mock('./soundEngine', () => ({ isMuted: () => false, onMuteChange: () => () => {} }))

const { chunkForSpeech, textForSpeech, speakMentorLine } = await import('./mentorVoice')

describe('mentor voice', () => {
  it('reads code-ish lesson text the way a person would say it', () => {
    // The fill-in blank, snake_case battle globals and emoji all appear in
    // real Mentor lines (lessons.ts, CombatOverlay), and each reads badly
    // verbatim.
    expect(textForSpeech('damage = ___  # เติมตัวแปร')).toBe('damage = ช่องว่าง # เติมตัวแปร')
    expect(textForSpeech('ตรวจ monster_hp ก่อนร่าย')).toBe('ตรวจ monster hp ก่อนร่าย')
    expect(textForSpeech('📜 โจทย์ — อ่านให้ครบ ▸')).toBe('โจทย์ อ่านให้ครบ')
  })

  it('splits long lines on the spaces Thai already pauses at', () => {
    const line = Array.from({ length: 30 }, (_, i) => `วลีที่${i}`).join(' ')
    const chunks = chunkForSpeech(line, 40)

    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(40)
    // Nothing lost or reordered along the way.
    expect(chunks.join(' ')).toBe(line)
  })

  it('keeps a single over-long word whole rather than cutting it', () => {
    const word = 'ก'.repeat(60)
    expect(chunkForSpeech(word, 40)).toEqual([word])
  })

  it('stays silent where the browser has no speech synthesis at all', () => {
    // vitest runs in node: no window.speechSynthesis. The Mentor must be told
    // nothing will play, so it does not wait on an onEnd that never comes.
    expect(speakMentorLine('สวัสดี')).toBe(false)
  })
})
