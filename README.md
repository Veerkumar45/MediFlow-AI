# MediFlow AI — Intelligent Healthcare Front Desk & Automation Platform

**Tagline:** Smarter Clinics. Seamless Care.

MediFlow AI is a comprehensive, production-grade AI-powered healthcare front-desk and clinical administration platform built for small-to-medium healthcare clinics. It automates repetitive administrative workflows, manages conflict-free multi-provider appointments, triages patient inquiries, and generates real operational intelligence using Google Gemini AI.

---

## 1. Key Application Capabilities

### 🩺 Smart Appointment Management & Conflict Prevention
- Multi-provider calendar & table scheduling
- Automated calendar conflict validation:
  - Enforces clinic opening hours (America/Chicago timezone)
  - Prevents provider double-booking
  - Revalidates time slots on the server before committing
  - Accounts for service-specific durations and lunch break windows
- Status tracking: Pending, Confirmed, Completed, Cancelled (with mandatory reason log), and No-show

### 🤖 Gemini AI Receptionist
- Powered by Google Gemini (default `gemini-3.5-flash`, override with `GEMINI_MODEL`; falls back to the next stable model automatically)
- Grounded with real clinic knowledge base (Harmony Health Clinic hours, 5 doctors, 8 clinical services, pricing)
- Interactive slot availability lookup
- Clinical safety guardrails:
  - Zero medical diagnosis or drug prescription advice
  - Direct emergency escalation notice (911 / ER referral) for acute symptoms
  - Explicit confirmation requested prior to booking or cancelling
- Lives in the **Patient Portal** (floating assistant + call-to-action banner); staff also have an AI Receptionist tab for testing

### ⚡ AI Automation Center
- 5 configurable autonomous workflow rules:
  1. **Appointment Request Processing**: Verifies provider availability, assigns booking reference (`MF-XXXXX`), and queues confirmation
  2. **Smart Appointment Reminders**: Identifies upcoming visits within 24 hours, drafts personalized prep instructions, and records delivery
  3. **Inquiry Classification & Routing**: Evaluates incoming patient inquiries, assigns 1 of 6 categories, and sets triage priority (low, medium, high, urgent)
  4. **Daily Clinic Operations Summary**: Aggregates daily booking volume, cancellation metrics, and outstanding inquiries
  5. **Missed Appointment Follow-up**: Detects No-show statuses and drafts compassionate rebooking follow-ups for staff review
- "Run Now" on-demand workflow execution with audit logs

### 📊 Practice Analytics & Gemini Intelligence
- Real-time KPI statistics: Total Visits, Today's Visits, Pending Requests, Completion Rate, Cancellation Rate, AI-Handled Inquiries
- Visualizations (Recharts): Weekly Appointment Trend area chart, Status Distribution donut chart, Most Requested Services bar chart, AI Inquiry Categories bar chart
- AI Insights Panel: Plain-language operational takeaways computed strictly from actual database numbers
- CSV Export of all appointment records

### 📑 AI Report Generator
- Produces formal clinical practice reports: Daily Clinic Summary, Weekly Appointment Report, Monthly Operations Report, Inquiry Analysis Report, and Automation Performance Report
- Grounded executive briefing, calculated period metrics, operational trends, clinical observations, recommendations, and pending actions
- Printable layout and historical report archive

### 👥 Role-Based Access Control (RBAC)
- **Clinic Administrator**: Unrestricted access to overview, appointments, patients, automations, analytics, reports, rosters, and clinic settings
- **Receptionist**: Dedicated front-desk workflow for appointments, permitted patient contact records, and inquiry responses
- **Patient**: Patient portal with the AI assistant, live-slot booking, and booking lookup by reference + phone (`MF-XXXXX`). There is no separate public portal.

---

## 2. Technology Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS, Lucide React icons, Recharts data visualization
- **Backend:** Node.js, Express, tsx
- **AI Models:** Google Gemini 3.8 Flash via `@google/genai` TypeScript SDK
- **Data Persistence:** Local JSON database (`/data/clinic_db.json`) with persistent file store and seed reset

---

## 3. Data

The app ships **clean**: no patients, appointments, inquiries, reports, logs or automation counters. Only the clinic profile, 5 doctors, 8 services and the 5 automation rules (configuration) are present. Everything else is created by real use (patient portal, AI assistant, staff screens). The **Clear Data** button in the header wipes activity data again at any time.

## 4. Setup & API Configuration

### Environment Variables
Configure your environment in `.env` (or via the AI Studio Secrets panel):
```bash
GEMINI_API_KEY="your-google-gemini-api-key"
# GEMINI_MODEL="gemini-3.5-flash"   # optional override
PORT=3000
```

### Running Locally
```bash
# Install dependencies
npm install

# Start the full-stack development server
npm run dev
```
The server will start at `http://localhost:3000`.

---

## 5. Production Firebase Configuration

To activate Google Cloud Firebase Firestore for production multi-user synchronization:
1. Create a Firebase project in the Firebase Console.
2. Enable Cloud Firestore and Firebase Authentication.
3. Deploy Firestore security rules to enforce clinic tenant isolation and role permissions.
4. Replace the server-side file store (`server/db.ts`) with Firestore collections: `clinics`, `doctors`, `services`, `patients`, `appointments`, `inquiries`, `automations`, `reports`.
5. Connect SMS providers (Twilio or Firebase Cloud Messaging) for automated 24-hour reminder delivery.

---

## 6. Acceptance Testing Guide

1. **AI booking:** Gateway -> Patient Portal -> *Chat with the assistant* -> "Do you have any dermatology appointments tomorrow?" -> "Book 10:00 AM, my name is ... phone ..." -> **Confirm**. You get an `MF-xxxxx` reference.
2. **Shows in management:** Admin login (`admin` / `admin123`) -> Overview, Appointments and Patients all show the new booking (status Pending).
3. **Workflow:** Automation Center -> *Run Now* on Appointment Request Processing -> the pending booking becomes Confirmed and an audit entry is written.
4. **Inquiry classification:** Inquiries -> *Log Incoming Inquiry* -> "I need a medication refill and feel dizzy" -> Human Assistance Required, high priority, escalated.
5. **Emergency:** in the assistant type "I have chest pain" -> 911 notice and an urgent escalated inquiry.
6. **AI report:** AI Reports -> Daily Clinic Summary -> set the date range -> Generate. Figures come from the database only.
7. **Conflict rules:** try booking the same doctor/time twice, a Sunday, or a past time: all are rejected server-side.

## 7. Recording the demo video

```bash
pip install playwright && playwright install chromium
npm install && npm run build
python demo/record_demo.py      # -> demo/output/mediflow-demo.mp4 (1920x1080)
```
Put `GEMINI_API_KEY` in `.env` first to record with real Gemini answers; the captions state which engine was active.

See `PROMPT_ENGINEERING.md` for the prompt iterations and `CHANGES.md` for everything fixed.
