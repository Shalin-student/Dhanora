# Dhanora — Family Income & Spend Tracking System

A complete, multi-member household financial management web application built with React 19, TypeScript, Vite, and Tailwind CSS v4.

## Key Features

- **Household Pulse Dashboard**: Monthly income, spending, net cashflow, savings rate, family net worth, 6-month cashflow trend chart, category donut chart, 50/30/20 rule analyzer, and automated Financial Health Score.
- **Multi-Member & Shared Expense Splitting**: Filter all views by **All Family** or any individual family member, track monthly allowances, and split bills among members with IOU settlement tracking.
- **Full Transactions Ledger**: Income, Expense, and Account-to-Account Transfer entries; category split breakdowns; tags, notes, receipt attachments; multi-filter search; bulk delete; and CSV Import (with column mapping) & Export.
- **Budgets, Rollovers & Zero-Based Mode**: Editable category limits, true multi-month envelope rollover carryover math (`Base + Rollover = Available`), 80%/100% status indicators, Month Pace & Daily Safe-to-Spend meter, 50/30/20 vs. Zero-Based Budgeting toggle, and custom category creation.
- **90-Day Balance Forecaster**: Interactive SVG projection chart simulating checking/cash and all-liquid balances day-by-day over 90 days from active recurring inflows and outflows, with low-balance warning alerts.
- **Recurring Bills & Payroll**: Weekly/biweekly/monthly/quarterly/yearly schedules with overdue alerts and one-click posting.
- **Savings Goals, Debt Simulator & Net Worth History**: Sinking funds with monthly pacing targets, an interactive **Snowball vs. Avalanche** multi-loan payoff simulator with extra-payment slider, and 6-month historical Net Worth growth charts across Accounts and Reports.
- **Family Profiles & 1-Click IOU Settlement**: Member allowance tracking, shared expense splitting, pairwise net IOU simplification, and 1-click settlement (with optional ledger transfer logging and Undo).
- **Reports & Statements**: Daily spend calendar heatmap, tag rollups, 6-month ledger table, and print-ready monthly statements.
- **Smart Automation, Rules & Anomaly Alerts**: Idempotent startup auto-posting for due recurring schedules, custom merchant categorization & tagging rules (applied live in Quick Entry, CSV imports, and batch ledger backfill), CSV duplicate fingerprinting & saved bank column presets, and recurring price-hike / category spend-spike alerts.
- **IndexedDB Storage, Receipt Vault & Crypto Security**: Asynchronous IndexedDB persistence (`hearthledger_db`) with automatic migration from legacy `localStorage`, deferred orphan receipt garbage collection, client-side image compression, a paginated Receipt Vault & lightbox viewer, salted SHA-256 PIN hashing (`crypto.subtle`) with inactivity auto-lock, Privacy Mode, Command Palette (`Ctrl/⌘ + K`), 6-second Undo toasts, and offline-ready PWA support.
- **Multi-Device Node + SQLite Sync & Role-Based Views**: Built-in `node:sqlite` (`server/`) backend with WAL persistence, optimistic revision concurrency (`409 SYNC_CONFLICT` detection), Server-Sent Events (`/api/events`) real-time sync, receipt blob synchronization, optional household sync key auth, active family profile switching (`Acting As`) with PIN-gated elevation from Dependent views, and a synchronized Household Activity Audit Feed.
- **Full English / ગુજરાતી (Gujarati) Language Split**: Instant one-click `EN | ગુજ` header, lock-screen, and Settings switcher translating all navigation, views, modals, categories, charts, month labels, alerts, toasts, and dependent role views cleanly between English and Gujarati.

## Scripts

```bash
npm install
npm run dev      # Start Node + SQLite sync server (:4174) & Vite dev server (:5173)
npm run dev:web  # Start frontend-only Vite dev server (local IndexedDB offline mode)
npm run build    # Type-check & build production bundle
npm run server   # Start Node + SQLite sync server (default http://127.0.0.1:4174)
npm start        # Build production bundle and serve app + sync API on :4174
npm test         # Run Vitest unit & UI tests
```
