import { useAdminStore } from './adminStore'

// The floating way into the admin console, rendered only for an account the
// server confirmed is on the allow-list (see adminStore.checkAdmin). The pause
// menu has a second button that opens the same panel.
export function AdminButton() {
  const isAdmin = useAdminStore((s) => s.isAdmin)
  const panelOpen = useAdminStore((s) => s.panelOpen)
  const setPanelOpen = useAdminStore((s) => s.setPanelOpen)

  if (!isAdmin || panelOpen) return null

  return (
    <button type="button" className="admin-fab" onClick={() => setPanelOpen(true)} title="แผงควบคุมแอดมิน">
      🛡 แอดมิน
    </button>
  )
}
