import { isMuted, onMuteChange } from './soundEngine'

// อาจารย์เมอร์ลิน's spoken voice — every line the Mentor bubble types out is
// also read aloud.
//
// This is the browser's own speech synthesis (Web Speech API), not recorded
// audio, for one reason: many of the lines are built at runtime ("เจ้าพบ
// Goblin Raider!", the player's character name, the current chapter), so
// there is no fixed script that could be recorded ahead of time.
//
// The price is that the voice is whatever the player's OS/browser ships. A
// Thai voice is usually there on Windows (Edge's "Niwat"/"Premwadee", the
// system "Pattara"), Android and iOS, but not always in desktop Chrome — and
// an English voice reading Thai is gibberish, so without a Thai voice this
// stays silent rather than guessing (see pickThaiVoice).

const VOICE_VOLUME_KEY = 'pd-voice-volume'

// A little slower and a little lower than the default: an old wizard, not a
// GPS. Applied to whichever voice is found, so a female-only system still gets
// something closer to the character.
const RATE = 0.95
const PITCH = 0.8

// Chrome silently drops a single utterance after roughly 15 seconds with some
// voices, and a long teaching line can run past that. Thai uses spaces between
// phrases rather than words, so splitting on them and queueing the pieces
// costs nothing audible — the voice pauses at those spaces anyway.
const MAX_CHUNK_CHARS = 140

function readStoredVolume(): number {
  try {
    const raw = localStorage.getItem(VOICE_VOLUME_KEY)
    if (raw === null) return 1
    const n = Number(raw)
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 1
  } catch {
    return 1
  }
}

let voiceVolume = typeof localStorage !== 'undefined' ? readStoredVolume() : 1
const listeners = new Set<() => void>()

function synth(): SpeechSynthesis | null {
  return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null
}

function notify() {
  listeners.forEach((fn) => fn())
}

// Voices arrive asynchronously in most browsers — getVoices() is often empty
// on the first call and fills in after 'voiceschanged'. Settings UI listens so
// its "no Thai voice" note does not flash up and then turn out to be wrong.
synth()?.addEventListener?.('voiceschanged', notify)

// Muting everything has to silence a sentence already in progress, not just
// the next one.
onMuteChange((muted) => {
  if (muted) synth()?.cancel()
})

// Prefers a male Thai voice (the character is an old man), then a
// network/neural one (noticeably more natural than the offline voices), then
// any Thai voice at all. null = no Thai voice on this device.
function pickThaiVoice(): SpeechSynthesisVoice | null {
  const s = synth()
  if (!s) return null
  const thai = s.getVoices().filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith('th'))
  if (thai.length === 0) return null
  const score = (v: SpeechSynthesisVoice) =>
    (/niwat|pattara|male|ชาย/i.test(v.name) ? 2 : 0) + (/natural|online|neural/i.test(v.name) ? 1 : 0)
  return [...thai].sort((a, b) => score(b) - score(a))[0]
}

// The bubble shows code and decoration that reads badly out loud: "___" is
// the fill-in blank, snake_case names get their underscore spoken as a word,
// and emoji are read by name ("กระดาษม้วน") in some voices.
export function textForSpeech(text: string): string {
  return text
    .replace(/_{2,}/g, ' ช่องว่าง ')
    .replace(/(\w)_(\w)/g, '$1 $2')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[▸▍•]/g, '')
    .replace(/\s*—\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function chunkForSpeech(text: string, max = MAX_CHUNK_CHARS): string[] {
  const chunks: string[] = []
  let current = ''
  for (const word of text.split(' ')) {
    if (!word) continue
    if (current && current.length + 1 + word.length > max) {
      chunks.push(current)
      current = word
    } else {
      current = current ? `${current} ${word}` : word
    }
  }
  if (current) chunks.push(current)
  return chunks
}

export function isVoiceSupported(): boolean {
  return pickThaiVoice() !== null
}

export function getVoiceVolume(): number {
  return voiceVolume
}

export function setVoiceVolume(next: number) {
  voiceVolume = Math.min(1, Math.max(0, next))
  try {
    localStorage.setItem(VOICE_VOLUME_KEY, String(voiceVolume))
  } catch {
    // Private mode / blocked storage: the slider still works for this session.
  }
  if (voiceVolume === 0) synth()?.cancel()
  notify()
}

export function onVoiceChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// Reads one Mentor line aloud, cutting off whatever was being said before —
// advancing the dialogue should never leave two sentences talking over each
// other. Returns false when nothing will be spoken (muted, volume 0, no Thai
// voice, no speech support) so the caller does not wait for an onEnd that
// will never come.
export function speakMentorLine(text: string, handlers: { onStart?: () => void; onEnd?: () => void } = {}): boolean {
  const s = synth()
  if (!s) return false
  s.cancel()
  if (isMuted() || voiceVolume <= 0) return false

  const voice = pickThaiVoice()
  if (!voice) return false

  const chunks = chunkForSpeech(textForSpeech(text))
  if (chunks.length === 0) return false

  // onEnd fires once, from whichever comes first: the last chunk finishing, or
  // any chunk erroring. Being cut off by the next line ('interrupted' /
  // 'canceled') is an error too, and browsers disagree on which of the queued
  // chunks report it — hence every chunk listens, and the flag keeps it single.
  let ended = false
  const end = () => {
    if (ended) return
    ended = true
    handlers.onEnd?.()
  }

  chunks.forEach((chunk, i) => {
    const utterance = new SpeechSynthesisUtterance(chunk)
    utterance.voice = voice
    utterance.lang = voice.lang
    utterance.rate = RATE
    utterance.pitch = PITCH
    utterance.volume = voiceVolume
    if (i === 0) utterance.onstart = () => handlers.onStart?.()
    if (i === chunks.length - 1) utterance.onend = end
    utterance.onerror = end
    s.speak(utterance)
  })
  return true
}

export function stopMentorVoice() {
  synth()?.cancel()
}
