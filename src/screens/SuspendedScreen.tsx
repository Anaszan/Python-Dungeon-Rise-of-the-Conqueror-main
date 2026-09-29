import { useAuthStore } from '../auth/authStore'

// What a suspended player sees instead of the dungeon.
//
// This screen is a courtesy, not a lock: the lock is in the database, where
// RLS refuses every write from a suspended account (migrations_014). Without
// the screen a suspended player would walk around a dungeon whose progress
// silently never saved, which is a worse experience than being told.
export function SuspendedScreen({ reason }: { reason: string | null }) {
  const signOut = useAuthStore((s) => s.signOut)

  return (
    <div className="screen-overlay">
      <div className="customize-panel suspended-panel">
        <h1>บัญชีนี้ถูกระงับ</h1>
        <p className="suspended-text">
          ผู้ดูแลระบบได้ระงับบัญชีนี้ไว้ ความคืบหน้าในเกมทั้งหมดถูกเก็บไว้ตามเดิม แต่จะเล่นต่อไม่ได้จนกว่าจะถูกปลดระงับ
        </p>
        {reason && (
          <p className="suspended-reason">
            <strong>เหตุผล:</strong> {reason}
          </p>
        )}
        <p className="suspended-text">หากคิดว่าเป็นความเข้าใจผิด กรุณาติดต่อผู้ดูแลระบบ</p>
        <button type="button" className="customize-confirm" onClick={() => signOut()}>
          ออกจากระบบ
        </button>
      </div>
    </div>
  )
}
