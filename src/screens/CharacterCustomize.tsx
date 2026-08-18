import { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useGameStore } from '../game/store'
import {
  CHARACTER_CLASS_OPTIONS,
  GENDER_OPTIONS,
  SKIN_COLOR_OPTIONS,
  SHIRT_COLOR_OPTIONS,
  DEFAULT_CHARACTER_CLASS,
  DEFAULT_GENDER,
  DEFAULT_SKIN_COLOR,
} from '../character/characterOptions'
import { CHARACTER_ASSETS } from '../character/characterAssets'
import { CharacterModel } from '../character/CharacterModel'
import { isCharacterNameTaken } from '../game/persistence'

const NAME_MIN_LENGTH = 2
const NAME_MAX_LENGTH = 20

type NameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'error'

export function CharacterCustomize() {
  const storeClass = useGameStore((s) => s.characterClass)
  const storeGender = useGameStore((s) => s.gender)
  const storeSkinColor = useGameStore((s) => s.skinColor)
  const storeShirtColor = useGameStore((s) => s.shirtColor)
  const storeName = useGameStore((s) => s.characterName)
  const confirmCharacter = useGameStore((s) => s.confirmCharacter)

  const [characterClass, setCharacterClass] = useState(storeClass ?? DEFAULT_CHARACTER_CLASS)
  const [gender, setGender] = useState(storeGender ?? DEFAULT_GENDER)
  const [skinColor, setSkinColor] = useState(storeSkinColor ?? DEFAULT_SKIN_COLOR)
  // null until the player picks a shirt: the outfit then keeps whatever color
  // the chosen class's model ships in, which is also what the first swatch
  // below shows and switches back to.
  const [shirtColor, setShirtColor] = useState<string | null>(storeShirtColor ?? null)
  const [characterName, setCharacterName] = useState(storeName ?? '')
  const [nameStatus, setNameStatus] = useState<NameStatus>('idle')

  useEffect(() => {
    const trimmed = characterName.trim()

    // Unchanged from the name already saved on this account — no need to
    // check it against itself (the unique constraint would only ever match
    // this same row anyway).
    if (trimmed === (storeName ?? '')) {
      setNameStatus('idle')
      return
    }

    if (trimmed.length === 0) {
      setNameStatus('idle')
      return
    }

    if (trimmed.length < NAME_MIN_LENGTH || trimmed.length > NAME_MAX_LENGTH) {
      setNameStatus('invalid')
      return
    }

    setNameStatus('checking')
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const taken = await isCharacterNameTaken(trimmed)
        if (!cancelled) setNameStatus(taken ? 'taken' : 'available')
      } catch {
        if (!cancelled) setNameStatus('error')
      }
    }, 400)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [characterName, storeName])

  const trimmedName = characterName.trim()
  const nameUnchanged = trimmedName === (storeName ?? '') && trimmedName.length > 0
  const canConfirm = nameUnchanged || nameStatus === 'available'
  const outfitColor = CHARACTER_ASSETS[gender][characterClass].defaultShirtColor

  return (
    <div className="screen-overlay">
      <div className="customize-panel">
        <h1>แต่งตัวตัวละคร</h1>

        <div className="customize-preview">
          <Canvas camera={{ position: [0, 1, 2.5], fov: 40 }}>
            <ambientLight intensity={0.8} />
            <directionalLight position={[2, 3, 2]} intensity={1} />
            <group position={[0, -0.3, 0]}>
              <CharacterModel appearance={{ characterClass, gender, skinColor, shirtColor }} />
            </group>
            <OrbitControls enablePan={false} enableZoom={false} />
          </Canvas>
        </div>

        <div className="customize-section">
          <p>ชื่อตัวละคร</p>
          <input
            type="text"
            className="customize-name-input"
            value={characterName}
            onChange={(e) => setCharacterName(e.target.value)}
            maxLength={NAME_MAX_LENGTH}
            placeholder="ตั้งชื่อตัวละครของคุณ"
          />
          {nameStatus === 'checking' && <p className="customize-name-status">กำลังตรวจสอบชื่อ...</p>}
          {nameStatus === 'taken' && <p className="customize-name-status customize-name-error">ชื่อนี้ถูกใช้ไปแล้ว กรุณาเลือกชื่ออื่น</p>}
          {nameStatus === 'invalid' && (
            <p className="customize-name-status customize-name-error">
              ชื่อต้องมีความยาว {NAME_MIN_LENGTH}-{NAME_MAX_LENGTH} ตัวอักษร
            </p>
          )}
          {nameStatus === 'error' && (
            <p className="customize-name-status customize-name-error">ตรวจสอบชื่อไม่สำเร็จ กรุณาลองใหม่</p>
          )}
          {nameStatus === 'available' && <p className="customize-name-status customize-name-ok">ชื่อนี้ใช้ได้</p>}
        </div>

        <div className="customize-section">
          <p>อาชีพ</p>
          <div className="accessory-row">
            {CHARACTER_CLASS_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`accessory-btn ${characterClass === opt.id ? 'accessory-active' : ''}`}
                onClick={() => setCharacterClass(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="customize-section">
          <p>เพศ</p>
          <div className="accessory-row">
            {GENDER_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`accessory-btn ${gender === opt.id ? 'accessory-active' : ''}`}
                onClick={() => setGender(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Both genders now have a bare face mesh that follows this colour
            (see CharacterModel), so the picker applies either way. */}
        <div className="customize-section">
          <p>สีผิว</p>
          <div className="swatch-row">
            {SKIN_COLOR_OPTIONS.map((color) => (
              <button
                key={color}
                type="button"
                className={`swatch ${skinColor === color ? 'swatch-active' : ''}`}
                style={{ background: color }}
                aria-label={color}
                onClick={() => setSkinColor(color)}
              />
            ))}
          </div>
        </div>

        {/* Separate from the skin row above: this one only touches the outfit
            (the robe/cloak on the women's models, the whole texture-painted
            outfit on the men's — see shirtMaterial / shirtMeshes). */}
        <div className="customize-section">
          <p>สีเสื้อ</p>
          <div className="swatch-row">
            <button
              type="button"
              className={`swatch swatch-default ${shirtColor === null ? 'swatch-active' : ''}`}
              style={{ background: outfitColor }}
              aria-label="สีชุดเดิมของอาชีพ"
              title="สีชุดเดิมของอาชีพ"
              onClick={() => setShirtColor(null)}
            >
              ↺
            </button>
            {SHIRT_COLOR_OPTIONS.map((color) => (
              <button
                key={color}
                type="button"
                className={`swatch ${shirtColor === color ? 'swatch-active' : ''}`}
                style={{ background: color }}
                aria-label={color}
                onClick={() => setShirtColor(color)}
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          className="customize-confirm"
          disabled={!canConfirm}
          onClick={() => confirmCharacter(characterClass, gender, skinColor, shirtColor, trimmedName)}
        >
          เริ่มการผจญภัย
        </button>
      </div>
    </div>
  )
}
