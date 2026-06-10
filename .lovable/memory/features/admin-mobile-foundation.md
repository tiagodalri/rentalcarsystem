---
name: Admin Mobile Foundation
description: Mobile-first admin shell — bottom tab bar, contextual header, FAB context, mobile utility classes
type: feature
---
**Layout (`src/components/admin/AdminLayout.tsx`)** wraps shell in `AdminFabProvider`. Mobile (<lg) renders `AdminMobileHeader` (52px, title from `useAdminPageTitle`, sidebar trigger, kebab menu with theme/fullscreen/idioma) + `AdminBottomNav` (5 tabs: Hoje, Reservas, Frota, Clientes, Mais) + `AdminFab` (above bottom nav). Desktop (≥lg) keeps original header + `AdminTabsBar`.

**Bottom nav** (`AdminBottomNav.tsx`): role-filtered via `useAdminAuth().hasAny`. "Mais" calls `setOpenMobile(true)` from `useSidebar()` to open sidebar as sheet. `AdminTabsBar` is `hidden lg:flex`.

**FAB system** (`useAdminFab.tsx`): page-level `useRegisterFab({ icon, label, onClick })` registers context-aware floating action; cleared on unmount. Already wired: AdminBookings (Nova reserva), AdminCustomers (Adicionar cliente), AdminFleet (Adicionar veículo).

**CSS tokens (index.css)**: `--admin-touch-min: 44px`, `.admin-touch`, `.admin-chip-scroll` (horizontal-scroll chips for mobile), `.admin-stack` (gap-3 mobile/gap-4 desktop), `.admin-h1` auto-scales to 1.5rem on mobile.

**Main padding**: bottom uses `max(calc(64px + safe-area + 16px), 1rem)` to clear bottom nav.
