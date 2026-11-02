import type { CharacterClass } from '../character/characterOptions'

// Everything here is synthesized with the Web Audio API at runtime — the
// project ships no audio files, so background music and every sound effect
// (attack impact, per-class flavor, player hurt) are generated from raw
// oscillators/noise instead of decoded from assets.

const MUTE_KEY = 'pd-audio-muted'
const MUSIC_VOLUME_KEY = 'pd-music-volume'
const SFX_VOLUME_KEY = 'pd-sfx-volume'

// Base gain each bus was tuned at before per-user volume sliders existed —
// a slider value of 1 (max) reproduces that original mix exactly, and lower
// values scale down from there.
const MUSIC_BASE_GAIN = 0.32
const SFX_BASE_GAIN = 0.7

// Where the music stops having any bass at all.
//
// Every theme used to hang a drone pad somewhere between 49 Hz and 138 Hz
// under the melody, lowpassed to 220-900 Hz — which left the pad as almost
// nothing but sub-bass. On headphones that is constant pressure under the
// whole game, and on laptop speakers it is inaudible mud that only eats
// headroom from the parts you can actually hear.
//
// The fix is in two halves. Every pad moved up an octave, onto the same root
// its own melody already plays (see DUNGEON_THEMES), which is what takes the
// rumble out. Then the music bus and its echo return both run through one
// high-pass here, set just under the lowest note any theme plays (level 2's
// 98 Hz G2), as the floor nothing may fall through afterwards: not the
// sawtooth pads' filtered mush, not the feedback delay stacking repeat on
// repeat, not a theme someone writes later.
//
// Combat hits deliberately do not go through it — a thud is short enough to
// read as impact rather than as a drone.
export const MUSIC_RUMBLE_CUT_HZ = 90

let ctx: AudioContext | null = null
let masterGain: GainNode | null = null
let musicBus: GainNode | null = null
let sfxBus: GainNode | null = null
let delaySend: DelayNode | null = null
let noiseBuffer: AudioBuffer | null = null

let muted = typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1'
const muteListeners = new Set<(muted: boolean) => void>()

function readStoredVolume(key: string): number {
  if (typeof localStorage === 'undefined') return 1
  const raw = localStorage.getItem(key)
  if (raw === null) return 1
  const n = Number(raw)
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 1
}

let musicVolume = readStoredVolume(MUSIC_VOLUME_KEY)
let sfxVolume = readStoredVolume(SFX_VOLUME_KEY)
const volumeListeners = new Set<() => void>()

function ensureContext(): AudioContext {
  if (ctx) return ctx

  const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const c = new AudioContextCtor()
  ctx = c

  masterGain = c.createGain()
  masterGain.gain.value = muted ? 0 : 1
  masterGain.connect(c.destination)

  // The one place the music's low end is cut (see MUSIC_RUMBLE_CUT_HZ).
  // Everything musical goes through it — the pads, the plucks and the echo
  // return — so nothing can route around it by accident later.
  const rumbleCut = c.createBiquadFilter()
  rumbleCut.type = 'highpass'
  rumbleCut.frequency.value = MUSIC_RUMBLE_CUT_HZ
  // Flat: a resonant corner would put back a hump right where the rumble was.
  rumbleCut.Q.value = 0.707
  rumbleCut.connect(masterGain)

  musicBus = c.createGain()
  musicBus.gain.value = MUSIC_BASE_GAIN * musicVolume
  musicBus.connect(rumbleCut)

  sfxBus = c.createGain()
  sfxBus.gain.value = SFX_BASE_GAIN * sfxVolume
  sfxBus.connect(masterGain)

  // A short feedback delay on the music bus only, for a "stone hallway"
  // echo behind the walking motif — never applied to combat SFX.
  const delay = c.createDelay(1)
  delay.delayTime.value = 0.32
  const feedback = c.createGain()
  feedback.gain.value = 0.32
  const wet = c.createGain()
  wet.gain.value = 0.22
  delay.connect(feedback)
  feedback.connect(delay)
  delay.connect(wet)
  // Through the high-pass as well, not straight to master: a feedback delay
  // is exactly the thing that would otherwise stack repeat on repeat into a
  // low rumble of its own.
  wet.connect(rumbleCut)
  delaySend = delay

  return c
}

function getNoiseBuffer(c: AudioContext): AudioBuffer {
  if (noiseBuffer) return noiseBuffer
  const buf = c.createBuffer(1, c.sampleRate, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  noiseBuffer = buf
  return buf
}

// Browsers refuse to start an AudioContext before a user gesture — resume it
// on the first click/keypress anywhere, which every screen has (nav/login
// buttons) well before gameplay audio is ever needed.
let unlocked = false
function unlock() {
  if (unlocked) return
  unlocked = true
  const c = ensureContext()
  if (c.state === 'suspended') c.resume()
}
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlock, { once: true })
  window.addEventListener('keydown', unlock, { once: true })
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return
    if (document.hidden) ctx.suspend()
    else if (!muted) ctx.resume()
  })
}

export function isMuted(): boolean {
  return muted
}

export function setMuted(next: boolean) {
  muted = next
  if (typeof localStorage !== 'undefined') localStorage.setItem(MUTE_KEY, next ? '1' : '0')
  if (masterGain && ctx) {
    masterGain.gain.setTargetAtTime(next ? 0 : 1, ctx.currentTime, 0.05)
  }
  muteListeners.forEach((fn) => fn(muted))
}

export function toggleMuted() {
  setMuted(!muted)
}

export function onMuteChange(fn: (muted: boolean) => void): () => void {
  muteListeners.add(fn)
  return () => muteListeners.delete(fn)
}

export function getMusicVolume(): number {
  return musicVolume
}

export function getSfxVolume(): number {
  return sfxVolume
}

export function setMusicVolume(next: number) {
  musicVolume = Math.min(1, Math.max(0, next))
  if (typeof localStorage !== 'undefined') localStorage.setItem(MUSIC_VOLUME_KEY, String(musicVolume))
  if (musicBus && ctx) musicBus.gain.setTargetAtTime(MUSIC_BASE_GAIN * musicVolume, ctx.currentTime, 0.05)
  volumeListeners.forEach((fn) => fn())
}

export function setSfxVolume(next: number) {
  sfxVolume = Math.min(1, Math.max(0, next))
  if (typeof localStorage !== 'undefined') localStorage.setItem(SFX_VOLUME_KEY, String(sfxVolume))
  if (sfxBus && ctx) sfxBus.gain.setTargetAtTime(SFX_BASE_GAIN * sfxVolume, ctx.currentTime, 0.05)
  volumeListeners.forEach((fn) => fn())
}

export function onVolumeChange(fn: () => void): () => void {
  volumeListeners.add(fn)
  return () => volumeListeners.delete(fn)
}

// ---------- low-level synth helpers ----------

type ToneOptions = {
  freq: number
  type?: OscillatorType
  start?: number
  duration?: number
  peak?: number
  freqEnd?: number
}

function tone(c: AudioContext, bus: GainNode, { freq, type = 'sine', start = 0, duration = 0.2, peak = 0.5, freqEnd }: ToneOptions) {
  const t0 = c.currentTime + start
  const osc = c.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + duration)

  const gain = c.createGain()
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(peak, t0 + Math.min(0.015, duration / 4))
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration)

  osc.connect(gain)
  gain.connect(bus)
  osc.start(t0)
  osc.stop(t0 + duration + 0.05)
}

type NoiseOptions = {
  start?: number
  duration?: number
  peak?: number
  filterType?: BiquadFilterType
  filterFreq?: number
  filterQ?: number
}

function noiseBurst(
  c: AudioContext,
  bus: GainNode,
  { start = 0, duration = 0.2, peak = 0.5, filterType = 'bandpass', filterFreq = 1200, filterQ = 1 }: NoiseOptions,
) {
  const t0 = c.currentTime + start
  const src = c.createBufferSource()
  src.buffer = getNoiseBuffer(c)

  const filter = c.createBiquadFilter()
  filter.type = filterType
  filter.frequency.value = filterFreq
  filter.Q.value = filterQ

  const gain = c.createGain()
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(peak, t0 + 0.005)
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration)

  src.connect(filter)
  filter.connect(gain)
  gain.connect(bus)
  src.start(t0)
  src.stop(t0 + duration + 0.05)
}

// ---------- gameplay sfx ----------

// The sound your code makes when it lands damage — timbre depends on the
// selected class so warrior/rogue/wizard/cleric each feel distinct.
export function playAttackImpact(characterClass: CharacterClass | null) {
  if (muted) return
  const c = ensureContext()
  if (!sfxBus) return
  const bus = sfxBus

  switch (characterClass) {
    case 'warrior':
      // Sword-on-armor clang: metallic noise + a low square thud.
      noiseBurst(c, bus, { duration: 0.18, peak: 0.55, filterType: 'bandpass', filterFreq: 2600, filterQ: 4 })
      tone(c, bus, { freq: 180, type: 'square', duration: 0.22, peak: 0.4, freqEnd: 90 })
      break
    case 'rogue':
      // Quick dagger slash: bright high-pass swoosh + a falling blip.
      noiseBurst(c, bus, { duration: 0.12, peak: 0.4, filterType: 'highpass', filterFreq: 3500, filterQ: 0.7 })
      tone(c, bus, { freq: 900, type: 'triangle', duration: 0.14, peak: 0.35, freqEnd: 300 })
      break
    case 'wizard':
      // Arcane zap: rising sawtooth sweep with sparkling high partials.
      tone(c, bus, { freq: 320, type: 'sawtooth', duration: 0.28, peak: 0.32, freqEnd: 1100 })
      tone(c, bus, { freq: 1400, type: 'sine', duration: 0.18, peak: 0.2, start: 0.05 })
      tone(c, bus, { freq: 1800, type: 'sine', duration: 0.15, peak: 0.15, start: 0.1 })
      break
    case 'cleric':
      // Warm bell smite: two sine partials a fifth apart, longer decay.
      tone(c, bus, { freq: 523.25, type: 'sine', duration: 0.5, peak: 0.3 })
      tone(c, bus, { freq: 784.0, type: 'sine', duration: 0.5, peak: 0.22, start: 0.03 })
      break
    default:
      noiseBurst(c, bus, { duration: 0.15, peak: 0.4, filterType: 'bandpass', filterFreq: 1800, filterQ: 2 })
      tone(c, bus, { freq: 260, type: 'triangle', duration: 0.18, peak: 0.3, freqEnd: 140 })
  }
}

// A monster's attack landing on the player — deliberately generic (not
// class-flavored) since it represents the monster hitting you, not your own action.
export function playPlayerHurt() {
  if (muted) return
  const c = ensureContext()
  if (!sfxBus) return
  noiseBurst(c, sfxBus, { duration: 0.22, peak: 0.5, filterType: 'lowpass', filterFreq: 400, filterQ: 0.6 })
  tone(c, sfxBus, { freq: 100, type: 'sine', duration: 0.25, peak: 0.4, freqEnd: 55 })
}

// ---------- background dungeon music ----------

// One distinct theme per level (1-6, wraps if ever called with more) — each
// a drone pad plus a plucked motif, so the dungeon doesn't loop the exact
// same track from level 1 through level 6. Levels get progressively more
// intense: slow/eerie early, energetic mid-game, dissonant and pulsing by
// the final trap-filled level.
type DungeonTheme = {
  padRoot: number
  padType1: OscillatorType
  padType2: OscillatorType
  padRatio2: number
  padFilterFreq: number
  padFilterQ: number
  padLfoFreq: number
  padLfoDepth: number
  padPeak: number
  scale: number[]
  motif: number[]
  stepSeconds: number
  pluckType: OscillatorType
  pluckPeak: number
  pluckDecay: number
  useDelay: boolean
  pulseSteps?: number
}

// Every pad now sits an octave higher than it was first written, on the same
// root its own `scale` starts from — a pad used to drone an octave *under*
// the melody, which is where all the rumble lived. Each one's filter corner
// and LFO depth doubled with it, so the pitch class, the beating between the
// two oscillators and the shape of the filter's movement are all unchanged:
// this is the same piece of music with its sub-bass taken away, not a
// different one. The peaks came down to match, because the ear hears the
// same pad as louder once it is out of the sub range.
//
// soundEngine.test.ts holds the line: no pad, and no note of any motif, may
// be written back under MUSIC_RUMBLE_CUT_HZ.
export const DUNGEON_THEMES: DungeonTheme[] = [
  // Level 1 — ทางเดินมืด: slow minor-pentatonic corridor crawl.
  {
    padRoot: 110, // A2 (was 55 = A1)
    padType1: 'sine',
    padType2: 'sawtooth',
    padRatio2: 1.0073,
    padFilterFreq: 600,
    padFilterQ: 0.7,
    padLfoFreq: 0.07,
    padLfoDepth: 240,
    padPeak: 0.4,
    scale: [110.0, 130.81, 146.83, 164.81, 196.0, 220.0],
    motif: [0, 3, 0, 2, 0, 3, 4, 3, 0, 2, 0, 3, 5, 4, 3, 2],
    stepSeconds: 0.42,
    pluckType: 'triangle',
    pluckPeak: 0.26,
    pluckDecay: 0.9,
    useDelay: true,
  },
  // Level 2 — ห้องใต้ดินที่ลึกกว่าเดิม: lower, grittier, heavier.
  {
    padRoot: 98.0, // G2 (was 49 = G1) — the lowest note left in the game
    padType1: 'sine',
    padType2: 'square',
    padRatio2: 1.01,
    padFilterFreq: 440,
    padFilterQ: 0.8,
    padLfoFreq: 0.05,
    padLfoDepth: 180,
    padPeak: 0.44,
    scale: [98.0, 116.54, 130.81, 146.83, 174.61, 196.0],
    motif: [0, 2, 0, 3, 0, 2, 4, 3, 0, 2, 0, 3, 5, 4, 2, 0],
    stepSeconds: 0.5,
    pluckType: 'triangle',
    pluckPeak: 0.24,
    pluckDecay: 1.0,
    useDelay: true,
  },
  // Level 3 — สนามประลองคอมโบ: faster, brighter, no echo (punchier).
  {
    padRoot: 164.81, // E3 (was 82.41 = E2)
    padType1: 'sine',
    padType2: 'triangle',
    padRatio2: 1.5,
    padFilterFreq: 1100,
    padFilterQ: 0.6,
    padLfoFreq: 0.18,
    padLfoDepth: 320,
    padPeak: 0.36,
    scale: [164.81, 184.997, 195.998, 220.0, 246.94, 277.18],
    motif: [0, 2, 4, 2, 5, 4, 2, 3, 0, 2, 4, 3, 5, 4, 2, 0],
    stepSeconds: 0.26,
    pluckType: 'square',
    pluckPeak: 0.18,
    pluckDecay: 0.45,
    useDelay: false,
  },
  // Level 4 — หอคาถาต้องมนตร์: arcane, shimmering, wide sparkling register.
  {
    padRoot: 277.18, // C#4 (was 138.59 = C#3)
    padType1: 'sine',
    padType2: 'sine',
    padRatio2: 1.498,
    padFilterFreq: 1800,
    padFilterQ: 0.5,
    padLfoFreq: 0.3,
    padLfoDepth: 500,
    padPeak: 0.32,
    scale: [277.18, 311.13, 349.23, 392.0, 440.0, 493.88],
    motif: [0, 2, 4, 5, 3, 1, 0, 4, 2, 5, 3, 0, 4, 1, 2, 5],
    stepSeconds: 0.32,
    pluckType: 'sine',
    pluckPeak: 0.28,
    pluckDecay: 0.7,
    useDelay: true,
  },
  // Level 5 — หอสมุดลับ: calm, mysterious dorian mode, slow.
  {
    padRoot: 146.83, // D3 (was 73.42 = D2)
    padType1: 'sine',
    padType2: 'triangle',
    padRatio2: 1.1892,
    padFilterFreq: 520,
    padFilterQ: 0.6,
    padLfoFreq: 0.06,
    padLfoDepth: 200,
    padPeak: 0.38,
    scale: [146.83, 164.81, 174.61, 196.0, 220.0, 246.94],
    motif: [0, 1, 3, 1, 4, 3, 1, 2, 0, 1, 3, 2, 5, 4, 3, 1],
    stepSeconds: 0.48,
    pluckType: 'triangle',
    pluckPeak: 0.22,
    pluckDecay: 1.0,
    useDelay: true,
  },
  // Level 6 — ดันเจี้ยนกับดักมรณะ: dissonant tritone pad, fast, with a
  // dread pulse under the motif.
  {
    padRoot: 185.0, // F#3 (was 92.5 = F#2)
    padType1: 'sawtooth',
    padType2: 'square',
    padRatio2: 1.4142,
    padFilterFreq: 1400,
    padFilterQ: 1.2,
    padLfoFreq: 0.4,
    padLfoDepth: 600,
    padPeak: 0.36,
    scale: [185.0, 196.0, 220.0, 233.08, 277.18, 311.13],
    motif: [0, 1, 0, 2, 0, 1, 3, 2, 0, 1, 0, 2, 4, 3, 2, 1],
    stepSeconds: 0.22,
    pluckType: 'sawtooth',
    pluckPeak: 0.22,
    pluckDecay: 0.4,
    useDelay: false,
    pulseSteps: 4,
  },
]

let musicRunToken = 0
let padOsc1: OscillatorNode | null = null
let padOsc2: OscillatorNode | null = null
let padGain: GainNode | null = null
let padLfo: OscillatorNode | null = null

function pluck(c: AudioContext, freq: number, theme: DungeonTheme) {
  if (!musicBus) return
  const t0 = c.currentTime
  const osc = c.createOscillator()
  osc.type = theme.pluckType
  osc.frequency.value = freq

  const gain = c.createGain()
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(theme.pluckPeak, t0 + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + theme.pluckDecay)

  osc.connect(gain)
  gain.connect(musicBus)
  if (theme.useDelay && delaySend) gain.connect(delaySend)
  osc.start(t0)
  osc.stop(t0 + theme.pluckDecay + 0.1)
}

// Level 6's dread pulse. It used to sweep 70 → 38 Hz, entirely below
// MUSIC_RUMBLE_CUT_HZ — the high-pass would have swallowed it whole and left
// every fourth step of that level silent. Rewritten an octave up as a short
// dry thud, with a noise tick on the front so it still lands as a hit rather
// than a hum: same job, nothing in the sub range.
function dreadPulse(c: AudioContext) {
  if (!musicBus) return
  tone(c, musicBus, { freq: 150, type: 'triangle', duration: 0.3, peak: 0.3, freqEnd: 100 })
  noiseBurst(c, musicBus, { duration: 0.09, peak: 0.1, filterType: 'bandpass', filterFreq: 420, filterQ: 1.4 })
}

function scheduleMusicStep(token: number, step: number, theme: DungeonTheme) {
  if (token !== musicRunToken) return
  const c = ensureContext()
  pluck(c, theme.scale[theme.motif[step % theme.motif.length]], theme)
  if (theme.pulseSteps && step % theme.pulseSteps === 0) dreadPulse(c)
  window.setTimeout(() => scheduleMusicStep(token, step + 1, theme), theme.stepSeconds * 1000)
}

export function startDungeonMusic(level = 1) {
  if (musicRunToken !== 0) return
  const theme = DUNGEON_THEMES[(Math.max(1, level) - 1) % DUNGEON_THEMES.length]
  const c = ensureContext()
  const token = ++musicRunToken

  padOsc1 = c.createOscillator()
  padOsc1.type = theme.padType1
  padOsc1.frequency.value = theme.padRoot
  padOsc2 = c.createOscillator()
  padOsc2.type = theme.padType2
  padOsc2.frequency.value = theme.padRoot * theme.padRatio2

  const padFilter = c.createBiquadFilter()
  padFilter.type = 'lowpass'
  padFilter.frequency.value = theme.padFilterFreq
  padFilter.Q.value = theme.padFilterQ

  padLfo = c.createOscillator()
  padLfo.frequency.value = theme.padLfoFreq
  const lfoGain = c.createGain()
  lfoGain.gain.value = theme.padLfoDepth
  padLfo.connect(lfoGain)
  lfoGain.connect(padFilter.frequency)

  padGain = c.createGain()
  padGain.gain.setValueAtTime(0, c.currentTime)
  padGain.gain.linearRampToValueAtTime(theme.padPeak, c.currentTime + 2.5)

  padOsc1.connect(padFilter)
  padOsc2.connect(padFilter)
  padFilter.connect(padGain)
  padGain.connect(musicBus!)

  padOsc1.start()
  padOsc2.start()
  padLfo.start()

  scheduleMusicStep(token, 0, theme)
}

export function stopDungeonMusic() {
  if (musicRunToken === 0) return
  musicRunToken = 0
  const c = ctx
  if (c && padGain) {
    const t0 = c.currentTime
    padGain.gain.cancelScheduledValues(t0)
    padGain.gain.setValueAtTime(padGain.gain.value, t0)
    padGain.gain.linearRampToValueAtTime(0, t0 + 1)
  }
  if (c) {
    padOsc1?.stop(c.currentTime + 1.1)
    padOsc2?.stop(c.currentTime + 1.1)
    padLfo?.stop(c.currentTime + 1.1)
  }
  padOsc1 = null
  padOsc2 = null
  padLfo = null
  padGain = null
}

// ---------- background menu music (landing / login / pre-game screens) ----------

// A bright C-major pentatonic arpeggio over a soft major-third pad — used on
// the landing page, login/register, and every screen between login and the
// dungeon (story intro, character pick, chapter briefing). Deliberately
// cheerier, brighter, and faster than the dungeon's minor drone, and skips
// the dungeon's echo send so it stays crisp.
const MENU_SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5]
const MENU_MOTIF = [0, 2, 4, 2, 5, 4, 2, 3, 0, 2, 4, 3, 2, 4, 5, 3]
const MENU_STEP_SECONDS = 0.26

let menuRunToken = 0
let menuPadOsc1: OscillatorNode | null = null
let menuPadOsc2: OscillatorNode | null = null
let menuPadGain: GainNode | null = null
let menuPadLfo: OscillatorNode | null = null

function menuPluck(c: AudioContext, freq: number) {
  if (!musicBus) return
  const t0 = c.currentTime
  const osc = c.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = freq

  const gain = c.createGain()
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(0.28, t0 + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5)

  osc.connect(gain)
  gain.connect(musicBus)
  osc.start(t0)
  osc.stop(t0 + 0.55)
}

function scheduleMenuStep(token: number, step: number) {
  if (token !== menuRunToken) return
  const c = ensureContext()
  menuPluck(c, MENU_SCALE[MENU_MOTIF[step % MENU_MOTIF.length]])
  window.setTimeout(() => scheduleMenuStep(token, step + 1), MENU_STEP_SECONDS * 1000)
}

export function startMenuMusic() {
  if (menuRunToken !== 0) return
  const c = ensureContext()
  const token = ++menuRunToken

  menuPadOsc1 = c.createOscillator()
  menuPadOsc1.type = 'sine'
  menuPadOsc1.frequency.value = 261.63 // C4
  menuPadOsc2 = c.createOscillator()
  menuPadOsc2.type = 'sine'
  menuPadOsc2.frequency.value = 329.63 // E4 — major third above, keeps the pad bright

  const padFilter = c.createBiquadFilter()
  padFilter.type = 'lowpass'
  padFilter.frequency.value = 1400
  padFilter.Q.value = 0.5

  menuPadLfo = c.createOscillator()
  menuPadLfo.frequency.value = 0.15
  const lfoGain = c.createGain()
  lfoGain.gain.value = 200
  menuPadLfo.connect(lfoGain)
  lfoGain.connect(padFilter.frequency)

  menuPadGain = c.createGain()
  menuPadGain.gain.setValueAtTime(0, c.currentTime)
  menuPadGain.gain.linearRampToValueAtTime(0.22, c.currentTime + 1.5)

  menuPadOsc1.connect(padFilter)
  menuPadOsc2.connect(padFilter)
  padFilter.connect(menuPadGain)
  menuPadGain.connect(musicBus!)

  menuPadOsc1.start()
  menuPadOsc2.start()
  menuPadLfo.start()

  scheduleMenuStep(token, 0)
}

export function stopMenuMusic() {
  if (menuRunToken === 0) return
  menuRunToken = 0
  const c = ctx
  if (c && menuPadGain) {
    const t0 = c.currentTime
    menuPadGain.gain.cancelScheduledValues(t0)
    menuPadGain.gain.setValueAtTime(menuPadGain.gain.value, t0)
    menuPadGain.gain.linearRampToValueAtTime(0, t0 + 0.6)
  }
  if (c) {
    menuPadOsc1?.stop(c.currentTime + 0.7)
    menuPadOsc2?.stop(c.currentTime + 0.7)
    menuPadLfo?.stop(c.currentTime + 0.7)
  }
  menuPadOsc1 = null
  menuPadOsc2 = null
  menuPadLfo = null
  menuPadGain = null
}
