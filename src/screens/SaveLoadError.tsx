// Shown instead of the game when the player's save could not be read.
//
// The point of this screen is that it is *not* the customize screen: a player
// who already has a character must never be asked to make another one just
// because the network blinked, and must never be dropped into a fresh dungeon
// that would then be saved over the real one. So the only ways out are trying
// again or signing out.
export function SaveLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="screen-overlay">
      <div className="customize-panel">
        <h1>โหลดเซฟไม่สำเร็จ</h1>
        <p className="customize-name-status customize-name-error">
          ไม่สามารถอ่านข้อมูลตัวละครของคุณได้ ระบบจึงยังไม่เริ่มเกม เพื่อไม่ให้ความคืบหน้าเดิมถูกเขียนทับ
        </p>
        <p className="customize-name-status">ตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองอีกครั้ง</p>
        <button type="button" className="customize-confirm" onClick={onRetry}>
          ลองใหม่อีกครั้ง
        </button>
      </div>
    </div>
  )
}
