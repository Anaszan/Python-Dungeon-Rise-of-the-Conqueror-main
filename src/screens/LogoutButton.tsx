import { useAuthStore } from '../auth/authStore'

export function LogoutButton() {
  const signOut = useAuthStore((s) => s.signOut)

  return (
    // The word is in a span of its own so a phone can drop it and keep the
    // icon — the dungeon's top row has no room for three labelled buttons
    // next to the HP card. title/aria-label carry the meaning once it does.
    <button className="logout-btn" onClick={() => signOut()} title="ออกจากระบบ" aria-label="ออกจากระบบ">
      🚪<span className="hud-btn-label"> ออกจากระบบ</span>
    </button>
  )
}
