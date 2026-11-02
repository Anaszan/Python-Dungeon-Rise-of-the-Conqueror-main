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

// Where the music stops having any bass at all. The music bus runs through
// one high-pass here, set just under the lowest note any theme plays (level
// 2's 98 Hz G2), as the floor nothing may fall through — including a theme
// someone writes later.
//
// This is what is left of the sub-bass problem. The drone pads that used to
// sit between 49 Hz and 138 Hz under every melody are gone entirely now (see
// DUNGEON_THEMES), so there is nothing down here to filter; the filter stays
// as the guarantee that nothing comes back.
//
// Combat hits deliberately do not go through it — a thud is short enough to
// read as impact rather than as a drone.
export const MUSIC_RUMBLE_CUT_HZ = 90

let ctx: AudioContext | null = null
let masterGain: GainNode | null = null
let musicBus: GainNode | null = null
let sfxBus: GainNode | null = null
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
  // Everything musical goes through it, so nothing can route around it by
  // accident later.
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

  // There used to be a feedback delay here, feeding a "stone hallway" echo
  // back into itself behind the music. It is gone with the pads: a note into
  // a 0.32s delay at 0.32 feedback comes back three or four more times over
  // the second that follows, so every note trailed off into a smear — the
  // drawn-out tail after each pluck. A note now plays once and stops.
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

// One distinct theme per level (1-6, wraps if ever called with more), so the
// dungeon doesn't loop the exact same track from level 1 through level 6.
// Levels get progressively more intense: slow/eerie early, energetic
// mid-game, dissonant and pulsing by the final trap-filled level.
//
// A theme is now only its plucked motif — notes that are struck and decay.
// Each one used to sit on a sustained two-oscillator drone pad underneath,
// which is the held "ooooo" that ran behind the whole game and never stopped
// for as long as a screen was open. It is gone: no voice in the music is
// held any more, so between notes the background is actually quiet.
type DungeonTheme = {
  scale: number[]
  motif: number[]
  stepSeconds: number
  pluckType: OscillatorType
  pluckPeak: number
  // How long a note takes to fall silent. Kept well under `stepSeconds` on
  // purpose, and soundEngine.test.ts enforces it: a decay longer than the
  // gap between notes means every note is still sounding when the next one
  // is struck, which is what made each pluck trail off into a drawn-out
  // tone instead of ending. Short enough and the music reads as notes; long
  // enough and it is a drone again by another name.
  pluckDecay: number
  pulseSteps?: number
}

// soundEngine.test.ts holds the line: no note of any motif may be written
// under MUSIC_RUMBLE_CUT_HZ, and no sustained voice may come back.
export const DUNGEON_THEMES: DungeonTheme[] = [
  // Level 1 — ทางเดินมืด: slow minor-pentatonic corridor crawl.
  {
    scale: [110.0, 130.81, 146.83, 164.81, 196.0, 220.0],
    motif: [0, 3, 0, 2, 0, 3, 4, 3, 0, 2, 0, 3, 5, 4, 3, 2],
    stepSeconds: 0.42,
    pluckType: 'triangle',
    pluckPeak: 0.26,
    pluckDecay: 0.24,
  },
  // Level 2 — ห้องใต้ดินที่ลึกกว่าเดิม: lower, grittier, heavier.
  {
    scale: [98.0, 116.54, 130.81, 146.83, 174.61, 196.0],
    motif: [0, 2, 0, 3, 0, 2, 4, 3, 0, 2, 0, 3, 5, 4, 2, 0],
    stepSeconds: 0.5,
    pluckType: 'triangle',
    pluckPeak: 0.24,
    pluckDecay: 0.28,
  },
  // Level 3 — สนามประลองคอมโบ: faster, brighter, punchier.
  {
    scale: [164.81, 184.997, 195.998, 220.0, 246.94, 277.18],
    motif: [0, 2, 4, 2, 5, 4, 2, 3, 0, 2, 4, 3, 5, 4, 2, 0],
    stepSeconds: 0.26,
    pluckType: 'square',
    pluckPeak: 0.18,
    pluckDecay: 0.15,
  },
  // Level 4 — หอคาถาต้องมนตร์: arcane, shimmering, wide sparkling register.
  {
    scale: [277.18, 311.13, 349.23, 392.0, 440.0, 493.88],
    motif: [0, 2, 4, 5, 3, 1, 0, 4, 2, 5, 3, 0, 4, 1, 2, 5],
    stepSeconds: 0.32,
    pluckType: 'sine',
    pluckPeak: 0.28,
    pluckDecay: 0.19,
  },
  // Level 5 — หอสมุดลับ: calm, mysterious dorian mode, slow.
  {
    scale: [146.83, 164.81, 174.61, 196.0, 220.0, 246.94],
    motif: [0, 1, 3, 1, 4, 3, 1, 2, 0, 1, 3, 2, 5, 4, 3, 1],
    stepSeconds: 0.48,
    pluckType: 'triangle',
    pluckPeak: 0.22,
    pluckDecay: 0.27,
  },
  // Level 6 — ดันเจี้ยนกับดักมรณะ: dissonant, fast, with a dread pulse
  // under the motif.
  {
    scale: [185.0, 196.0, 220.0, 233.08, 277.18, 311.13],
    motif: [0, 1, 0, 2, 0, 1, 3, 2, 0, 1, 0, 2, 4, 3, 2, 1],
    stepSeconds: 0.22,
    pluckType: 'sawtooth',
    pluckPeak: 0.22,
    pluckDecay: 0.13,
    pulseSteps: 4,
  },
]

let musicRunToken = 0

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
  osc.start(t0)
  osc.stop(t0 + theme.pluckDecay + 0.05)
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
  const token = ++musicRunToken
  scheduleMusicStep(token, 0, theme)
}

// Stopping is just "schedule no more notes". There is no sustained voice and
// no echo left to fade out: the last note falls silent inside a third of a
// second on its own.
export function stopDungeonMusic() {
  musicRunToken = 0
}

// ---------- background menu music (landing / login / pre-game screens) ----------

// A bright C-major pentatonic arpeggio — used on the landing page,
// login/register, and every screen between login and the dungeon (story
// intro, character pick, chapter briefing). Deliberately cheerier, brighter
// and faster than the dungeon themes.
//
// It had a held C4+E4 pad under it, and notes that rang for 0.5s against a
// 0.26s step so each one was still sounding through the next two. Both are
// gone. These are the screens a player sits and reads on — the character
// picker and the chapter briefing are places you stay for a minute — so
// they are the worst place in the game for a sound that never lets go.
const MENU_SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5]
const MENU_MOTIF = [0, 2, 4, 2, 5, 4, 2, 3, 0, 2, 4, 3, 2, 4, 5, 3]
const MENU_STEP_SECONDS = 0.26
// Same rule as the dungeon's pluckDecay: comfortably shorter than the step,
// so one note is done before the next begins.
const MENU_PLUCK_DECAY = 0.16

let menuRunToken = 0

function menuPluck(c: AudioContext, freq: number) {
  if (!musicBus) return
  const t0 = c.currentTime
  const osc = c.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = freq

  const gain = c.createGain()
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(0.28, t0 + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + MENU_PLUCK_DECAY)

  osc.connect(gain)
  gain.connect(musicBus)
  osc.start(t0)
  osc.stop(t0 + MENU_PLUCK_DECAY + 0.05)
}

function scheduleMenuStep(token: number, step: number) {
  if (token !== menuRunToken) return
  const c = ensureContext()
  menuPluck(c, MENU_SCALE[MENU_MOTIF[step % MENU_MOTIF.length]])
  window.setTimeout(() => scheduleMenuStep(token, step + 1), MENU_STEP_SECONDS * 1000)
}

export function startMenuMusic() {
  if (menuRunToken !== 0) return
  const token = ++menuRunToken
  scheduleMenuStep(token, 0)
}

export function stopMenuMusic() {
  menuRunToken = 0
}
