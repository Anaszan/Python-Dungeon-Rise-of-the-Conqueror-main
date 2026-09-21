import { useEffect, useState } from 'react'
import {
  getMusicVolume,
  getSfxVolume,
  setMusicVolume,
  setSfxVolume,
  onVolumeChange,
  isMuted,
  onMuteChange,
  toggleMuted,
} from './soundEngine'
import { getVoiceVolume, isVoiceSupported, onVoiceChange, setVoiceVolume, speakMentorLine } from './mentorVoice'

const VOICE_SAMPLE = 'ข้าคืออาจารย์เมอร์ลิน เสียงของข้าดังพอหรือยัง ศิษย์เอ๋ย'

export function VolumeSettings() {
  const [musicVolume, setMusicVolumeState] = useState(getMusicVolume)
  const [sfxVolume, setSfxVolumeState] = useState(getSfxVolume)
  const [voiceVolume, setVoiceVolumeState] = useState(getVoiceVolume)
  // Re-checked whenever the browser's voice list arrives, which is often a
  // moment after first paint — see mentorVoice.ts.
  const [voiceSupported, setVoiceSupported] = useState(isVoiceSupported)
  const [muted, setMutedState] = useState(isMuted)

  useEffect(
    () =>
      onVoiceChange(() => {
        setVoiceVolumeState(getVoiceVolume())
        setVoiceSupported(isVoiceSupported())
      }),
    [],
  )

  useEffect(
    () =>
      onVolumeChange(() => {
        setMusicVolumeState(getMusicVolume())
        setSfxVolumeState(getSfxVolume())
      }),
    [],
  )
  useEffect(() => onMuteChange(setMutedState), [])

  return (
    <div className="volume-settings">
      <label className="volume-row">
        <span>เพลงพื้นหลัง</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={musicVolume}
          onChange={(e) => setMusicVolume(Number(e.target.value))}
        />
      </label>
      <label className="volume-row">
        <span>เสียงเอฟเฟกต์</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={sfxVolume}
          onChange={(e) => setSfxVolume(Number(e.target.value))}
        />
      </label>
      <label className="volume-row">
        <span>เสียงพากย์อาจารย์</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={voiceVolume}
          disabled={!voiceSupported}
          onChange={(e) => setVoiceVolume(Number(e.target.value))}
        />
      </label>
      {voiceSupported ? (
        <button
          type="button"
          className="volume-mute-btn"
          onClick={() => speakMentorLine(VOICE_SAMPLE)}
          disabled={muted || voiceVolume <= 0}
        >
          🧙 ทดสอบเสียงอาจารย์
        </button>
      ) : (
        <p className="volume-note">
          เบราว์เซอร์/เครื่องนี้ไม่มีเสียงอ่านภาษาไทย อาจารย์จึงพูดไม่ได้ — ลองเปิดเกมด้วย Microsoft Edge หรือติดตั้ง "เสียงพูดภาษาไทย" ใน
          Windows (การตั้งค่า → เวลาและภาษา → คำพูด)
        </p>
      )}
      <button type="button" className="volume-mute-btn" onClick={toggleMuted}>
        {muted ? '🔇 เปิดเสียงทั้งหมด' : '🔊 ปิดเสียงทั้งหมด'}
      </button>
    </div>
  )
}
