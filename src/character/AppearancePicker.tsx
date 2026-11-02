import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import {
  CHARACTER_CLASS_OPTIONS,
  GENDER_OPTIONS,
  SKIN_COLOR_OPTIONS,
  SHIRT_COLOR_OPTIONS,
  type AppearanceChoice,
} from './characterOptions'
import { CHARACTER_ASSETS } from './characterAssets'
import { CharacterModel } from './CharacterModel'

// The look-at-me half of a character — class, gender, skin, shirt — with a
// live model of whatever is currently picked.
//
// Shared by the two screens that need it: the one that creates a character
// before the first game (CharacterCustomize, which adds the name field and the
// claim) and the one that edits an existing character afterwards
// (PlayerProfile). Keeping it in one place is what stops the two from drifting
// into offering different options.
export function AppearancePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: AppearanceChoice
  onChange: (next: AppearanceChoice) => void
  disabled?: boolean
}) {
  const set = (patch: Partial<AppearanceChoice>) => onChange({ ...value, ...patch })
  const { characterClass, gender, skinColor, shirtColor } = value
  const outfitColor = CHARACTER_ASSETS[gender][characterClass].defaultShirtColor

  return (
    // Two columns once there is room for them (see .appearance-layout): the
    // options on the left, the character standing on the right at a size
    // worth looking at. It used to be a 220px-tall strip across the top of
    // the screen with the model about half filling it — which on a desktop
    // browser is a postage stamp of the thing the whole screen is for.
    //
    // Both screens that use this get the same split, because both now give
    // it the same room: the create screen and the profile's edit section
    // are one component and should not read as two different features.
    <div className="appearance-layout">
      <div className="appearance-preview">
        <div className="customize-preview">
          {/* Framed on the model itself: it stands 1.3 units tall centred
              on the origin (CharacterModel), so the camera looks straight
              at its middle from just far enough back to leave a little air
              over the head. The old framing aimed a wide lens at the
              origin with the model pushed 0.3 below it, which spent most
              of the picture on empty floor. */}
          <Canvas camera={{ position: [0, 0.2, 2.1], fov: 40 }}>
            <ambientLight intensity={0.8} />
            <directionalLight position={[2, 3, 2]} intensity={1} />
            <CharacterModel appearance={value} />
            <OrbitControls enablePan={false} enableZoom={false} />
          </Canvas>
        </div>
        <p className="appearance-preview-hint">ลากเพื่อหมุนดูรอบตัว</p>
      </div>

      <div className="appearance-controls">
        <div className="customize-section">
          <p>อาชีพ</p>
          <div className="accessory-row">
            {CHARACTER_CLASS_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`accessory-btn ${characterClass === opt.id ? 'accessory-active' : ''}`}
                disabled={disabled}
                onClick={() => set({ characterClass: opt.id })}
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
                disabled={disabled}
                onClick={() => set({ gender: opt.id })}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Both genders have a bare face mesh that follows this colour (see
            CharacterModel), so the picker applies either way. */}
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
                disabled={disabled}
                onClick={() => set({ skinColor: color })}
              />
            ))}
          </div>
        </div>

        {/* Separate from the skin row above: this one only touches the
            outfit (the robe/cloak on the women's models, the painted
            garment on the men's — see shirtMaterial / shirtTarget). */}
        <div className="customize-section">
          <p>สีเสื้อ</p>
          <div className="swatch-row">
            <button
              type="button"
              className={`swatch swatch-default ${shirtColor === null ? 'swatch-active' : ''}`}
              style={{ background: outfitColor }}
              aria-label="สีชุดเดิมของอาชีพ"
              title="สีชุดเดิมของอาชีพ"
              disabled={disabled}
              onClick={() => set({ shirtColor: null })}
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
                disabled={disabled}
                onClick={() => set({ shirtColor: color })}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
