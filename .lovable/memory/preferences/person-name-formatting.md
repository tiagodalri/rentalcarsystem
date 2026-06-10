---
name: Person Name Capitalization
description: Person names (customers, drivers, team) always display with each word capitalized, particles (de, da, do) stay lowercase. Use formatPersonName from @/lib/formatName.
type: preference
---

**Rule**: Every time a person name is rendered in the UI (customers, drivers, additional drivers, team members, contacts), pipe it through `formatPersonName` from `@/lib/formatName.ts`.

**Why**: Customers type names in lowercase ("gabriel ademar craveiro da cunha") and the UI must always show them correctly capitalized ("Gabriel Ademar Craveiro da Cunha").

**How to apply**:
```tsx
import { formatPersonName } from "@/lib/formatName";
<span>{formatPersonName(customer.name)}</span>
```

Particles `de da do das dos e di du la le van von den der del della` stay lowercase when not the first word. Hyphenated names, O'/D'/Mc/Mac prefixes handled automatically.

Storage is NOT normalized — keep raw value in DB, only format at render time.
