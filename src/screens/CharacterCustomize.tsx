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
import { claimCharacterName, isCharacterNameTaken } from '../game/persistence'
import {
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  isSameCharacterName,
  isValidCharacterName,
  normalizeCharacterName,
} from '../game/characterName'

// 'checking' is the lookup while the player types; 'claiming' is the one that
// decides, on the way into the game. Only 'available' and 'claiming' come from
// a name the database has actually been asked about — every other state leaves
// the adventure button disabled, including the two failure states, because a
// name that could not be checked is not a name that is known to be free.
type NameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'error' | 'claiming' | 'claimFailed'

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
    const name = normalizeCharacterName(characterName)

    // Already this account's own name — the database excludes the caller's own
    // save from the check, so asking would only ever come back free.
    if (storeName !== null && isSameCharacterName(name, storeName)) {
      setNameStatus('idle')
      return
    }

    if (name.length === 0) {
      setNameStatus('idle')
      return
    }

    if (!isValidCharacterName(name)) {
      setNameStatus('invalid')
      return
    }

    setNameStatus('checking')
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const taken = await isCharacterNameTaken(name)
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

  const trimmedName = normalizeCharacterName(characterName)
  const nameUnchanged =
    storeName !== null && trimmedName.length > 0 && isSameCharacterName(trimmedName, storeName)
  const canConfirm =
    isValidCharacterName(trimmedName) &&
    (nameUnchanged || nameStatus === 'available') &&
    nameStatus !== 'claiming'
  const outfitColor = CHARACTER_ASSETS[gender][characterClass].defaultShirtColor

  // The button does not start the game — this does, and only once Postgres has
  // handed this player the name. A duplicate that slipped past the check while
  // they were picking colors is caught right here, and leaves them on this
  // screen with the name marked taken instead of walking into a dungeon under
  // a name whose save can never be written.
  const startAdventure = async () => {
    if (!canConfirm) return
    setNameStatus('claiming')
    try {
      if (!(await claimCharacterName(trimmedName))) {
        setNameStatus('taken')
        return
      }
    } catch {
      setNameStatus('claimFailed')
      return
    }
    confirmCharacter(characterClass, gender, skinColor, shirtColor, trimmedName)
  }

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
          {nameStatus === 'claiming' && <p className="customize-name-status">กำลังจองชื่อ...</p>}
          {nameStatus === 'taken' && <p className="customize-name-status customize-name-error">ชื่อนี้ถูกใช้ไปแล้ว กรุณาเลือกชื่ออื่น</p>}
          {nameStatus === 'invalid' && (
            <p className="customize-name-status customize-name-error">
              ชื่อต้องมีความยาว {NAME_MIN_LENGTH}-{NAME_MAX_LENGTH} ตัวอักษร
            </p>
          )}
          {nameStatus === 'error' && (
            <p className="customize-name-status customize-name-error">ตรวจสอบชื่อไม่สำเร็จ กรุณาลองใหม่</p>
          )}
          {nameStatus === 'claimFailed' && (
            <p className="customize-name-status customize-name-error">จองชื่อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง</p>
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

        <button type="button" className="customize-confirm" disabled={!canConfirm} onClick={startAdventure}>
          {nameStatus === 'claiming' ? 'กำลังจองชื่อ...' : 'เริ่มการผจญภัย'}
        </button>
      </div>
    </div>
  )
}
