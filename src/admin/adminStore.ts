import { create } from 'zustand'
import { fetchIsAdmin } from './adminApi'

type AdminState = {
  // Whether the signed-in account is on the allow-list. Purely a UI switch:
  // the data itself is guarded inside the RPC (migrations_012_admin.sql), so a
  // player who flips this in devtools gets an admin panel whose dashboard
  // answers 403 and whose warp buttons only move their *own* save.
  isAdmin: boolean
  // False until the answer for the current session has come back, so nothing
  // flashes an admin button at a normal player mid-check.
  checked: boolean
  panelOpen: boolean

  checkAdmin: () => Promise<void>
  // Called when the session goes away (sign out / account switch) so the next
  // account starts from "unknown", not from the previous one's answer.
  reset: () => void
  setPanelOpen: (open: boolean) => void
}

export const useAdminStore = create<AdminState>((set) => ({
  isAdmin: false,
  checked: false,
  panelOpen: false,

  checkAdmin: async () => {
    const isAdmin = await fetchIsAdmin()
    set({ isAdmin, checked: true })
  },

  reset: () => set({ isAdmin: false, checked: false, panelOpen: false }),

  setPanelOpen: (panelOpen) => set({ panelOpen }),
}))
