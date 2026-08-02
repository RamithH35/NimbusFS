# Frontend Phase C - TODO

## Plan Confirmations
- [x] Explore codebase, understand backend API shapes and frontend patterns
- [x] Confirm comprehensive plan with user

## Build Steps
- [x] `client/src/components/ui/EmptyState.jsx` — create reusable Notion-style empty-state-card (canvas-soft, rounded-xl, centered icon+message)
- [x] `client/src/components/files/ShareModal.jsx` — create Create/Manage share states, expiry radios, password toggle, max downloads, copy link, revoke, toast, Escape/backdrop close
- [x] `client/src/pages/FilesPage.jsx` — wire Share button to ShareModal (pass file object), refresh list on close/revoke
- [x] `client/src/pages/SharedPage.jsx` — create protected shared-files page (filter visibility==='shared'), table with Download/Manage/Revoke, ShareModal integration, EmptyState
- [x] `client/src/pages/SharePage.jsx` — rewrite as public standalone page (no auth header, plain fetch), password form, error states, download trigger, NimbusFS wordmark
- [x] `client/src/pages/AdminPage.jsx` — create protected admin panel: provider health cards (30s auto-refresh), failure log table with filters+pagination, queue stat cards
- [x] `client/src/App.jsx` — add protected `/shared` and `/admin` routes
- [x] `client/src/pages/DashboardPage.jsx` — Share quick action on recent files → ShareModal; storage usage sums file sizes
- [x] `client/src/components/files/UploadModal.jsx` — Escape key + backdrop click close (guarded by busy state)
- [x] `client/src/components/ui/ConfirmDialog.jsx` — Escape key + backdrop click close

## UI Polish
- [x] Empty states use EmptyState component with subtle icon
- [x] Loading states use Spinner component
- [x] Errors via useToast hook
- [x] Modals have bg-black/40 backdrop and close on backdrop click
- [x] Escape key closes open modals
- [x] All colors use CSS custom properties (no hardcoded hex)

## Verification & Git
- [x] Client build passes (vite build)
- [x] E2E: Share → password prompt → wrong password → correct password → download → /shared → revoke → /admin
- [x] Dark mode toggle works across all Phase C pages
- [x] Mobile responsive check
- [x] No console errors
- [x] Commit: `Frontend Phase C: Share modal, public share page, shared files, admin panel`
- [x] Push to `origin main`

---

# Dark Mode Audit - Archived (Completed)

## Steps to Complete

- [x] Audit all frontend files for hardcoded colors
- [x] Confirm plan with user

### Color Fixes
- [x] `context/ToastContext.jsx` — replace `bg-white` with `bg-surface`
- [x] `components/ui/Button.jsx` — replace `bg-white` with `bg-surface` in secondary & utility variants
- [x] `pages/FilesPage.jsx` — replace `bg-canvas` with `bg-surface` on search & table cards; add `text-ink` to file name cell
- [x] `pages/DashboardPage.jsx` — replace `bg-canvas` with `bg-surface` on all 3 cards; add `text-ink` to file name cell
- [x] `pages/RegisterPage.jsx` — replace hardcoded hex colors with `var(--color-*)`
- [x] `components/files/UploadModal.jsx` — replace `bg-canvas` with `bg-surface` on modal card

### Sidebar Updates
- [x] `components/layout/AppShell.jsx` — remove "Toggle Theme" text label (icon only)
- [x] `components/layout/AppShell.jsx` — add "Shared" nav item
- [x] `components/layout/AppShell.jsx` — add "Admin" nav item

### Verification & Git
- [x] Final search for remaining hardcoded colors
- [x] Commit: `Fix: complete dark mode audit — all surfaces use CSS custom properties`
- [x] Push to `origin main`
