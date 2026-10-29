# Changes

**Removed:** Public Clinic Portal (component, gateway card, buttons, routes). AI assistant now lives in the Patient Portal.
**Clean data:** all seeded patients, appointments, inquiries, executions, reports, audit logs and fake automation counters removed; `data/clinic_db.json` ships clean; "Reset Demo" is now "Clear Data".

**Bugs fixed**
- `npm install` failed (esbuild ^0.25 vs Vite 8 peer); `npm start` used `node server.ts`
- Booking references/ids could collide after a deletion (`length + 1`)
- Dates used UTC instead of clinic time (reminders, "today", report defaults)
- No validation for past times, advance-booking window, clinic hours, Sunday; reactivating a cancelled booking skipped conflict checks
- Patient portal used a hard-coded slot grid that ignored doctor schedules/breaks; now uses live `/api/availability`
- AI/portal bookings created placeholder patient ids; now find-or-create the patient by phone/email
- Offline assistant invented a "Valued Patient" with a fake phone; now asks for the patient's own details
- `includes('')` silently matched the first doctor; invalid model id `gemini-3.8-flash` replaced by configurable chain
- Tool results were sent with the non-standard role `tool` (now a user turn); report fallback invented statistics; daily report "utilization" was mislabelled
- Async route errors hung requests (Express 4); duplicate-patient check crashed without email
- Booking lookup revealed bookings by reference alone; phone now required
- Widget used `alert()`, never refreshed dashboards, showed raw markdown
