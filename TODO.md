# Dark Mode Audit - TODO

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
- [x] Final search for remaining hardcoded colors — only intentionally kept: `index.css` theme token definitions, `bg-black/40` overlay backdrops, `text-white` on accent buttons
- [ ] Commit with message `Fix: complete dark mode audit — all surfaces use CSS custom properties`
- [ ] Push to `origin main`
