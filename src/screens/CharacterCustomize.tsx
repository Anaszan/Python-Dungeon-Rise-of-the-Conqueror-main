import { useEffect, useState } from 'react'
import { useGameStore } from '../game/store'
import {
  DEFAULT_CHARACTER_CLASS,
  DEFAULT_GENDER,
  DEFAULT_SKIN_COLOR,
  type AppearanceChoice,
} from '../character/characterOptions'
import { AppearancePicker } from '../character/AppearancePicker'
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

  const [appearance, setAppearance] = useState<AppearanceChoice>({
    characterClass: storeClass ?? DEFAULT_CHARACTER_CLASS,
    gender: storeGender ?? DEFAULT_GENDER,
    skinColor: storeSkinColor ?? DEFAULT_SKIN_COLOR,
    // null until the player picks a shirt: the outfit then keeps whatever
    // color the chosen class's model ships in.
    shirtColor: storeShirtColor ?? null,
  })
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
    confirmCharacter(
      appearance.characterClass,
      appearance.gender,
      appearance.skinColor,
      appearance.shirtColor,
      trimmedName,
    )
  }

  return (
    <div className="screen-overlay">
      <div className="customize-panel">
        <h1>แต่งตัวตัวละคร</h1>

        <AppearancePicker value={appearance} onChange={setAppearance} disabled={nameStatus === 'claiming'} />

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

        <button type="button" className="customize-confirm" disabled={!canConfirm} onClick={startAdventure}>
          {nameStatus === 'claiming' ? 'กำลังจองชื่อ...' : 'เริ่มการผจญภัย'}
        </button>
      </div>
    </div>
  )
}
