import { GoogleGenAI, Type } from '@google/genai';
import { db, clinicNow, addDaysToDate, dayOfWeekOf } from './db.ts';

/* -------------------------------------------------------------------------- */
/*  Gemini client + model selection                                           */
/* -------------------------------------------------------------------------- */

const apiKey = process.env.GEMINI_API_KEY;
const hasRealKey = Boolean(apiKey && !/^MY_|your-|YOUR_/i.test(apiKey));

let ai: GoogleGenAI | null = null;
if (hasRealKey) {
  ai = new GoogleGenAI({ apiKey: apiKey as string });
}

/**
 * Model chain: GEMINI_MODEL (if set) first, then known stable Flash models.
 * If a model id is unknown/retired (404) the next one is tried automatically and remembered.
 */
const MODEL_CHAIN = Array.from(
  new Set([process.env.GEMINI_MODEL, 'gemini-3.5-flash', 'gemini-3.1-flash-lite'].filter(Boolean) as string[])
);
let activeModelIdx = 0;
let lastEngine: 'gemini' | 'offline' = 'offline';
let lastError: string | null = null;

export function getAiStatus() {
  return {
    configured: Boolean(ai),
    model: ai ? MODEL_CHAIN[activeModelIdx] : null,
    lastEngine,
    lastError
  };
}

async function generate(params: { contents: any; config?: any; timeoutMs?: number }): Promise<any> {
  if (!ai) throw new Error('Gemini is not configured');
  let lastErr: any;
  for (let i = activeModelIdx; i < MODEL_CHAIN.length; i++) {
    let timer: any;
    try {
      const call = ai.models.generateContent({ model: MODEL_CHAIN[i], contents: params.contents, config: params.config });
      const timeout = new Promise<never>((_, rej) => {
        timer = setTimeout(() => rej(new Error('Gemini request timed out')), params.timeoutMs ?? 25000);
      });
      const res = await Promise.race([call, timeout]);
      activeModelIdx = i;
      lastEngine = 'gemini';
      lastError = null;
      return res;
    } catch (err: any) {
      lastErr = err;
      const msg = String(err?.message || err);
      lastError = msg.slice(0, 200);
      // Only move to the next model when this one does not exist / is retired.
      if (!/404|NOT_FOUND|not found|no longer available|is not supported/i.test(msg)) break;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

/* -------------------------------------------------------------------------- */
/*  Shared types                                                              */
/* -------------------------------------------------------------------------- */

export interface ExecutedToolLog {
  tool: 'check_availability' | 'request_booking' | 'classify_inquiry' | 'escalate_to_staff';
  summary: string;
  timestamp: string;
  status: 'success' | 'warning' | 'error';
  details?: any;
}

export interface PendingBookingProposal {
  doctorId: string;
  doctorName: string;
  serviceId: string;
  serviceName: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  consultationFee: number;
  patientName: string;
  patientPhone: string;
  patientEmail?: string;
  notes?: string;
}

export interface ReceptionistChatResult {
  reply: string;
  category?: string;
  actionRequired?: 'confirm_booking' | 'escalate_emergency' | 'none';
  pendingBooking?: PendingBookingProposal;
  executedTools?: ExecutedToolLog[];
  engine?: 'gemini' | 'offline';
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const nowStamp = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function clinicToday() {
  return clinicNow(db.getClinic().timeZone);
}

function fmtTime12(t: string) {
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${suffix}`;
}

/* -------------------------------------------------------------------------- */
/*  Tool declarations (Gemini function calling)                               */
/* -------------------------------------------------------------------------- */

const receptionistTools: any[] = [
  {
    functionDeclarations: [
      {
        name: 'check_availability',
        description:
          'Looks up REAL open appointment slots in the clinic database for a date. Always call this before stating any availability. Optionally filter by doctor or by service/specialty.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING, description: 'Date in YYYY-MM-DD format.' },
            doctorId: { type: Type.STRING, description: 'Optional doctor id such as doc-1.' },
            doctorName: { type: Type.STRING, description: 'Optional doctor name, e.g. Dr. Sarah Mitchell.' },
            serviceName: { type: Type.STRING, description: 'Optional service or specialty, e.g. Cardiology, Dermatology.' }
          },
          required: ['date']
        }
      },
      {
        name: 'request_booking',
        description:
          'Stages an appointment after re-validating the slot against the live calendar. Nothing is saved until the patient presses Confirm. Only call once you have the patient name AND phone number from the patient.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            patientName: { type: Type.STRING, description: 'Full name given by the patient.' },
            patientPhone: { type: Type.STRING, description: 'Phone number given by the patient.' },
            patientEmail: { type: Type.STRING, description: 'Optional email.' },
            doctorId: { type: Type.STRING, description: 'Doctor id such as doc-1.' },
            serviceId: { type: Type.STRING, description: 'Service id such as srv-1.' },
            date: { type: Type.STRING, description: 'YYYY-MM-DD.' },
            startTime: { type: Type.STRING, description: 'HH:mm, 24-hour.' },
            notes: { type: Type.STRING, description: 'Reason for visit in the patient\'s own words.' }
          },
          required: ['patientName', 'patientPhone', 'doctorId', 'serviceId', 'date', 'startTime']
        }
      },
      {
        name: 'classify_inquiry',
        description: 'Categorises a patient message and tags its priority for front-desk operations.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            category: {
              type: Type.STRING,
              description: 'One of: Appointment, Clinic Information, Billing, Service Inquiry, General Question, Human Assistance Required.'
            },
            priority: { type: Type.STRING, description: 'low, medium, high or urgent.' },
            summary: { type: Type.STRING, description: 'One-sentence summary.' }
          },
          required: ['category', 'priority', 'summary']
        }
      },
      {
        name: 'escalate_to_staff',
        description: 'Hands complex, billing-dispute or human-assistance requests to clinic staff.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            patientName: { type: Type.STRING },
            contactInfo: { type: Type.STRING },
            reason: { type: Type.STRING },
            priority: { type: Type.STRING, description: 'medium, high or urgent.' },
            summary: { type: Type.STRING }
          },
          required: ['reason', 'priority', 'summary']
        }
      }
    ]
  }
];

/* -------------------------------------------------------------------------- */
/*  Tool implementations (always run against the real database)               */
/* -------------------------------------------------------------------------- */

function resolveService(q?: { serviceId?: string; serviceName?: string }) {
  const services = db.getServices().filter((s) => s.isActive !== false);
  if (q?.serviceId) {
    const byId = services.find((s) => s.id === q.serviceId);
    if (byId) return byId;
  }
  const name = (q?.serviceName || '').toLowerCase().trim();
  if (!name) return undefined;
  return (
    services.find((s) => s.name.toLowerCase() === name) ||
    services.find((s) => s.name.toLowerCase().includes(name) || name.includes(s.name.toLowerCase())) ||
    services.find((s) => s.category.toLowerCase().includes(name))
  );
}

function resolveDoctor(q?: { doctorId?: string; doctorName?: string }) {
  const doctors = db.getDoctors();
  if (q?.doctorId) {
    const byId = doctors.find((d) => d.id === q.doctorId);
    if (byId) return byId;
  }
  const name = (q?.doctorName || '').toLowerCase().replace(/^dr\.?\s*/, '').trim();
  if (!name) return undefined;
  return doctors.find((d) => d.name.toLowerCase().includes(name) || name.includes(d.name.toLowerCase().replace(/^dr\.?\s*/, '')));
}

function executeCheckAvailability(args: { date: string; doctorId?: string; doctorName?: string; serviceName?: string }) {
  const clinic = db.getClinic();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date || '')) {
    return { success: false, message: 'Date must be in YYYY-MM-DD format.', availableSlots: [], availableSlotsCount: 0 };
  }
  const dow = dayOfWeekOf(args.date);
  const today = clinicToday().date;
  if (args.date < today) {
    return { success: true, date: args.date, clinicOpen: false, message: 'That date has already passed.', availableSlots: [], availableSlotsCount: 0 };
  }
  if (dow === 0 && clinic.openingHours.sunday?.closed !== false) {
    return {
      success: true,
      date: args.date,
      weekday: DAY_NAMES[dow],
      clinicOpen: false,
      message: `${clinic.name} is closed on Sundays. Open Mon-Fri ${clinic.openingHours.weekdays.start}-${clinic.openingHours.weekdays.end} and Sat ${clinic.openingHours.saturday.start}-${clinic.openingHours.saturday.end}.`,
      availableSlots: [],
      availableSlotsCount: 0
    };
  }

  const doctor = resolveDoctor(args);
  const service = resolveService({ serviceName: args.serviceName });
  if ((args.doctorId || args.doctorName) && !doctor) {
    return { success: false, message: `No doctor matching "${args.doctorName || args.doctorId}" was found.`, availableSlots: [], availableSlotsCount: 0 };
  }

  let slots = db.getAvailableSlots(args.date, { doctorId: doctor?.id, serviceId: service?.id, durationMinutes: service?.durationMinutes });
  // Specialty keyword that is not a service name (e.g. "cardiology" or "skin")
  if (!doctor && !service && args.serviceName) {
    const q = args.serviceName.toLowerCase();
    const matchDocs = db.getDoctors().filter((d) => d.specialty.toLowerCase().includes(q) || d.title.toLowerCase().includes(q));
    if (matchDocs.length) {
      slots = matchDocs.flatMap((d) => db.getAvailableSlots(args.date, { doctorId: d.id }));
      slots.sort((a, b) => a.time.localeCompare(b.time));
    }
  }

  return {
    success: true,
    date: args.date,
    weekday: DAY_NAMES[dow],
    clinicOpen: true,
    availableSlotsCount: slots.length,
    availableSlots: slots.slice(0, 12),
    message: slots.length
      ? `Found ${slots.length} open slot(s) on ${DAY_NAMES[dow]} ${args.date}.`
      : `No open slots on ${DAY_NAMES[dow]} ${args.date} for the selected provider/service.`
  };
}

function executeRequestBooking(args: {
  patientName?: string;
  patientPhone?: string;
  patientEmail?: string;
  doctorId?: string;
  doctorName?: string;
  serviceId?: string;
  serviceName?: string;
  date: string;
  startTime: string;
  durationMinutes?: number;
  notes?: string;
}): { success: boolean; status: string; bookingProposal?: PendingBookingProposal; conflictReason?: string; message: string } {
  const doctor = resolveDoctor(args);
  const service = resolveService(args);

  if (!args.patientName?.trim() || (args.patientPhone || '').replace(/\D/g, '').length < 7) {
    return { success: false, status: 'MISSING_PATIENT_DETAILS', message: 'A patient name and a valid phone number are required before a booking can be staged.' };
  }
  if (!doctor) return { success: false, status: 'INVALID_DOCTOR', message: 'Doctor not found in the clinic roster.' };
  if (!service) return { success: false, status: 'INVALID_SERVICE', message: 'Service not found in the clinic catalogue.' };
  if (!doctor.servicesOffered.includes(service.id)) {
    return { success: false, status: 'SERVICE_NOT_OFFERED', message: `${doctor.name} does not offer "${service.name}".` };
  }

  const duration = Number(args.durationMinutes || service.durationMinutes || 30);
  const conflict = db.checkAppointmentConflict(doctor.id, args.date, args.startTime, duration);
  if (conflict.hasConflict) {
    return { success: false, status: 'SLOT_UNAVAILABLE', conflictReason: conflict.reason, message: `Cannot stage booking: ${conflict.reason}` };
  }

  return {
    success: true,
    status: 'CONFIRMATION_REQUIRED',
    bookingProposal: {
      doctorId: doctor.id,
      doctorName: doctor.name,
      serviceId: service.id,
      serviceName: service.name,
      date: args.date,
      startTime: args.startTime,
      durationMinutes: duration,
      consultationFee: service.consultationFee,
      patientName: args.patientName.trim(),
      patientPhone: (args.patientPhone || '').trim(),
      patientEmail: args.patientEmail || '',
      notes: args.notes || 'Booked via MediFlow AI assistant'
    },
    message: `Slot verified with ${doctor.name} on ${args.date} at ${args.startTime}. The patient must press Confirm to save it.`
  };
}

/* -------------------------------------------------------------------------- */
/*  Emergency detection                                                       */
/* -------------------------------------------------------------------------- */

const EMERGENCY_PATTERNS = [
  /chest (pain|tightness|pressure)/i,
  /(shortness of breath|trouble breathing|difficulty breathing|can'?t breathe|cannot breathe)/i,
  /\b(having|had|think i'?m having) (a )?(stroke|heart attack)\b/i,
  /\bunconscious\b/i,
  /bleeding (heavily|profusely|badly)/i,
  /(severe allergic|anaphyla)/i,
  /\boverdose\b/i,
  /\bseizure\b/i
];
const isEmergencyText = (t: string) => EMERGENCY_PATTERNS.some((r) => r.test(t)) && !/\b(no|not|without|never)\s+(any\s+)?(chest pain|seizure)/i.test(t);

/* -------------------------------------------------------------------------- */
/*  AI receptionist chat                                                      */
/* -------------------------------------------------------------------------- */

function buildSystemInstruction(patientContext?: { name?: string; phone?: string; bookingRef?: string }) {
  const clinic = db.getClinic();
  const now = clinicToday();
  const tomorrow = addDaysToDate(now.date, 1);
  const doctors = db
    .getDoctors()
    .map(
      (d) =>
        `- ${d.id} | ${d.name} | ${d.specialty} | ${d.workingDays.map((x) => DAY_NAMES[x].slice(0, 3)).join('/')} ${d.workHours.start}-${d.workHours.end} | offers: ${d.servicesOffered.join(', ')}`
    )
    .join('\n');
  const services = db
    .getServices()
    .filter((s) => s.isActive !== false)
    .map((s) => `- ${s.id} | ${s.name} | ${s.durationMinutes} min | $${s.consultationFee}`)
    .join('\n');

  return `# ROLE
You are MediFlow AI, the front-desk assistant of ${clinic.name} (${clinic.address}, ${clinic.phone}).
You help patients with appointments, clinic hours, doctors and prices. You are NOT a clinician.

# CLINIC FACTS (the only source of truth)
Hours: Mon-Fri ${clinic.openingHours.weekdays.start}-${clinic.openingHours.weekdays.end}, Sat ${clinic.openingHours.saturday.start}-${clinic.openingHours.saturday.end}, Sunday closed. Time zone: ${clinic.timeZone}.
Today is ${DAY_NAMES[now.dayOfWeek]} ${now.date}. Tomorrow is ${tomorrow}. Resolve "next Tuesday", "tomorrow" etc. to YYYY-MM-DD yourself.
Doctors (id | name | specialty | days hours | services):
${doctors}
Services (id | name | duration | fee):
${services}

# RULES
1. Never diagnose, interpret symptoms, or advise on medication. Redirect to booking a consultation. For emergencies tell the patient to call 911.
2. Never state availability from memory. Call check_availability first, then offer 3-5 concrete times with the doctor name.
3. To book you need: service (or doctor), date, time, the patient's FULL NAME and PHONE NUMBER. Ask for anything missing, one short question at a time. Never invent or assume a name, phone or email.
4. When everything is known call request_booking, then tell the patient the doctor, service, date, time and fee and ask them to press the Confirm button. Say the booking is NOT final until they confirm.
5. If request_booking fails, explain why in plain words and offer the nearest alternatives from check_availability.
6. For billing disputes, complaints or anything you cannot resolve, call escalate_to_staff.
7. Reply in the patient's language, in at most 4 short sentences, warm and professional. Use times like "2:30 PM".
${patientContext?.bookingRef ? `\nThe patient mentioned booking reference ${patientContext.bookingRef}.` : ''}`;
}

function logTool(list: ExecutedToolLog[], tool: ExecutedToolLog['tool'], summary: string, status: ExecutedToolLog['status'], details?: any) {
  list.push({ tool, summary, timestamp: nowStamp(), status, details });
}

function emergencyResult(userMessage: string, patientContext?: { name?: string; phone?: string }): ReceptionistChatResult {
  const inq = db.addInquiry({
    patientName: patientContext?.name || 'Anonymous patient (chat)',
    patientContact: patientContext?.phone || '',
    message: `EMERGENCY ALERT - patient wrote: "${userMessage}". Advised to call 911.`,
    category: 'Human Assistance Required',
    priority: 'urgent',
    status: 'Escalated',
    aiAssisted: true,
    aiSuggestedResponse: 'Advised patient to call 911 or go to the nearest emergency department immediately.',
    assignedTo: 'Clinical Nurse Triage'
  });
  db.recordExecution('auto-3', 'Emergency Triage Protocol', 'Acute symptom keywords in chat', 'Warning', `Escalated inquiry ${inq.id} to Clinical Nurse Triage.`);
  return {
    reply:
      '**This may be an emergency.** I am an administrative assistant and cannot assess symptoms. Please call **911** or go to the nearest emergency department right now. Our clinical triage team has been alerted.',
    category: 'Human Assistance Required',
    actionRequired: 'escalate_emergency',
    executedTools: [
      {
        tool: 'escalate_to_staff',
        summary: `Urgent escalation sent to Clinical Nurse Triage (${inq.id}).`,
        timestamp: nowStamp(),
        status: 'warning',
        details: { inquiryId: inq.id, priority: 'urgent' }
      }
    ],
    engine: lastEngine
  };
}

export async function chatWithReceptionist(
  conversation: Array<{ role: 'user' | 'assistant'; content: string }>,
  patientContext?: { name?: string; phone?: string; bookingRef?: string }
): Promise<ReceptionistChatResult> {
  const userMessage = conversation[conversation.length - 1]?.content || '';
  if (isEmergencyText(userMessage)) return emergencyResult(userMessage, patientContext);

  if (ai) {
    try {
      const executedTools: ExecutedToolLog[] = [];
      let pendingBooking: PendingBookingProposal | undefined;
      const systemInstruction = buildSystemInstruction(patientContext);

      // Gemini requires the history to start with a user turn.
      const history = conversation.slice(conversation.findIndex((m) => m.role === 'user'));
      const contents: any[] = history.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

      // Up to 4 tool rounds (e.g. check_availability -> request_booking -> final text)
      for (let round = 0; round < 4; round++) {
        const response = await generate({
          contents,
          config: { systemInstruction, tools: receptionistTools, temperature: 0.3 }
        });
        const candidate = response.candidates?.[0];
        const calls = (candidate?.content?.parts || []).filter((p: any) => p.functionCall).map((p: any) => p.functionCall);

        if (!calls.length) {
          const reply = (response.text || '').trim() || 'How can I help you with your visit to Harmony Health Clinic?';
          const lower = userMessage.toLowerCase();
          const category = pendingBooking || /book|appointment|slot|available/.test(lower)
            ? 'Appointment'
            : /bill|cost|price|fee|insurance/.test(lower)
              ? 'Billing'
              : /hour|address|where|open/.test(lower)
                ? 'Clinic Information'
                : 'General Question';
          return {
            reply,
            category,
            actionRequired: pendingBooking ? 'confirm_booking' : 'none',
            pendingBooking,
            executedTools,
            engine: 'gemini'
          };
        }

        contents.push(candidate.content);
        const responses: any[] = [];
        for (const call of calls) {
          const args = call.args || {};
          let result: any;
          if (call.name === 'check_availability') {
            result = executeCheckAvailability(args);
            logTool(executedTools, 'check_availability', `Checked live calendar for ${args.date}: ${result.availableSlotsCount ?? 0} open slot(s).`, 'success', result);
          } else if (call.name === 'request_booking') {
            result = executeRequestBooking(args);
            if (result.success && result.bookingProposal) {
              pendingBooking = result.bookingProposal;
              logTool(executedTools, 'request_booking', `Slot validated with ${pendingBooking!.doctorName} on ${pendingBooking!.date} at ${pendingBooking!.startTime}. Awaiting patient confirmation.`, 'success', pendingBooking);
            } else {
              logTool(executedTools, 'request_booking', `Booking not staged: ${result.conflictReason || result.message}`, 'warning', result);
            }
          } else if (call.name === 'classify_inquiry') {
            result = { success: true };
            logTool(executedTools, 'classify_inquiry', `Classified as ${args.category} (${args.priority} priority).`, 'success', args);
          } else if (call.name === 'escalate_to_staff') {
            const inq = db.addInquiry({
              patientName: args.patientName || patientContext?.name || 'Chat patient',
              patientContact: args.contactInfo || patientContext?.phone || '',
              message: args.summary || args.reason,
              category: 'Human Assistance Required',
              priority: ['medium', 'high', 'urgent'].includes(args.priority) ? args.priority : 'high',
              status: 'Escalated',
              aiAssisted: true,
              assignedTo: 'Front Desk Lead'
            });
            db.recordExecution('auto-3', 'Front Desk Staff Escalation', `Escalation from ${inq.patientName}`, 'Warning', `Escalated to Front Desk Lead: ${args.reason}`);
            result = { success: true, ticketId: inq.id };
            logTool(executedTools, 'escalate_to_staff', `Escalated to Front Desk Lead (${inq.id}).`, 'warning', { inquiryId: inq.id });
          } else {
            result = { success: false, message: `Unknown tool ${call.name}` };
          }
          responses.push({ functionResponse: { name: call.name, response: result } });
        }
        // Function results are sent back as a user turn.
        contents.push({ role: 'user', parts: responses });
      }
      return {
        reply: 'I could not finish that request. Please try again or call the front desk.',
        category: 'General Question',
        actionRequired: 'none',
        pendingBooking,
        executedTools,
        engine: 'gemini'
      };
    } catch (err) {
      console.warn('[MediFlow] Gemini call failed, using offline grounded engine:', (err as any)?.message || err);
    }
  }

  lastEngine = 'offline';
  return offlineReceptionist(conversation, patientContext);
}

/* -------------------------------------------------------------------------- */
/*  Offline grounded engine (used when no API key / Gemini unreachable)       */
/*  Conversation-aware slot filling: it NEVER invents patient details.        */
/* -------------------------------------------------------------------------- */

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const SERVICE_SYNONYMS: Record<string, string[]> = {
  'srv-1': ['general', 'consultation', 'check up', 'checkup', 'see a doctor', 'gp'],
  'srv-2': ['annual', 'wellness', 'preventive', 'physical'],
  'srv-3': ['dermat', 'skin', 'rash', 'acne', 'mole'],
  'srv-4': ['cardio', 'heart', 'ecg', 'ekg'],
  'srv-5': ['pediatric', 'paediatric', 'child', 'kid', 'baby', 'well-child'],
  'srv-6': ['chronic', 'diabetes', 'follow-up', 'follow up'],
  'srv-7': ['cryo', 'lesion', 'wart'],
  'srv-8': ['vaccin', 'flu', 'travel', 'shot', 'immuni']
};

interface ParsedChat {
  wantsBooking: boolean;
  wantsAvailability: boolean;
  date?: string;
  time?: string;
  doctorId?: string;
  serviceId?: string;
  name?: string;
  phone?: string;
  email?: string;
}

function parseTime(text: string): string | undefined {
  const m24 = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b(?!\s*(am|pm))/i);
  const ampm = text.match(/\b(1[0-2]|[1-9])(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)/i);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const pm = ampm[3].toLowerCase().startsWith('p');
    if (pm && h < 12) h += 12;
    if (!pm && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${ampm[2] || '00'}`;
  }
  if (m24) return `${m24[1].padStart(2, '0')}:${m24[2]}`;
  const bare = text.match(/\bat\s+(1[0-2]|[1-9])\b(?!\s*(?:\/|-|\d))/i);
  if (bare) {
    let h = parseInt(bare[1], 10);
    if (h <= 6 || h === 12) h = h === 12 ? 12 : h + 12;
    return `${String(h).padStart(2, '0')}:00`;
  }
  return undefined;
}

function parseDate(text: string): string | undefined {
  const today = clinicToday();
  const iso = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];
  const lower = text.toLowerCase();
  if (/day after tomorrow/.test(lower)) return addDaysToDate(today.date, 2);
  if (/\btomorrow\b/.test(lower)) return addDaysToDate(today.date, 1);
  if (/\btoday\b|\btonight\b/.test(lower)) return today.date;
  for (let i = 0; i < 7; i++) {
    if (new RegExp(`\\b${WEEKDAYS[i]}\\b`).test(lower)) {
      let delta = (i - today.dayOfWeek + 7) % 7;
      if (delta === 0) delta = 7; // the same weekday name means next week ("today" is handled above)
      return addDaysToDate(today.date, delta);
    }
  }
  return undefined;
}

function parseConversation(conversation: Array<{ role: string; content: string }>): ParsedChat {
  const userTurns = conversation.filter((m) => m.role === 'user').map((m) => m.content);
  const out: ParsedChat = { wantsBooking: false, wantsAvailability: false };
  const all = userTurns.join(' \n ').toLowerCase();
  out.wantsBooking = /\b(book|reserve|schedule|make an appointment|set up an appointment|appointment for|i want an appointment|i need an appointment)\b/.test(all);
  out.wantsAvailability = /\b(available|availability|slots?|open|free|when can|earliest|any appointments?)\b/.test(all);

  const doctors = db.getDoctors();
  const services = db.getServices();
  // Newest message wins for every field.
  for (const turn of [...userTurns].reverse()) {
    const lower = turn.toLowerCase();
    if (!out.date) out.date = parseDate(turn);
    if (!out.time) out.time = parseTime(turn);
    if (!out.doctorId) {
      const d = doctors.find((x) => {
        const n = x.name.toLowerCase().replace(/^dr\.?\s*/, '');
        return lower.includes(n) || lower.includes(n.split(' ').pop() as string);
      });
      if (d) out.doctorId = d.id;
    }
    if (!out.serviceId) {
      const s = services.find((x) => lower.includes(x.name.toLowerCase())) ||
        services.find((x) => (SERVICE_SYNONYMS[x.id] || []).some((k) => lower.includes(k)));
      if (s) out.serviceId = s.id;
    }
    if (!out.name) {
      const nm = turn.match(/(?:my name is|name is|i am|i'm|this is|name[:\-])\s+([A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*){0,3}?)(?=\s*(?:[,.;!?\n]|\band\b|\bmy\b|\bphone\b|\bnumber\b|\bemail\b|\bat\b|\bfor\b|\d|$))/i);
      if (nm && !/^(looking|trying|calling|a |an |the |not|here|fine|good|ok)/i.test(nm[1])) out.name = nm[1].trim();
    }
    if (!out.phone) {
      const ph = turn.match(/(\+?\d[\d\s().-]{6,}\d)/);
      if (ph && ph[1].replace(/\D/g, '').length >= 7 && !/^\d{4}-\d{2}-\d{2}$/.test(ph[1].trim())) out.phone = ph[1].trim();
    }
    if (!out.email) {
      const em = turn.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
      if (em) out.email = em[0];
    }
  }
  return out;
}

function formatSlots(slots: Array<{ time: string; doctorName: string; specialty: string }>, max = 6) {
  // Spread across doctors rather than listing one doctor's whole day.
  const byDoc = new Map<string, typeof slots>();
  slots.forEach((s) => byDoc.set(s.doctorName, [...(byDoc.get(s.doctorName) || []), s]));
  const picked: typeof slots = [];
  let i = 0;
  while (picked.length < max && [...byDoc.values()].some((l) => l[i])) {
    for (const l of byDoc.values()) if (l[i] && picked.length < max) picked.push(l[i]);
    i++;
  }
  picked.sort((a, b) => a.time.localeCompare(b.time));
  return picked.map((s) => `- **${fmtTime12(s.time)}** with ${s.doctorName} (${s.specialty})`).join('\n');
}

function offlineReceptionist(
  conversation: Array<{ role: 'user' | 'assistant'; content: string }>,
  patientContext?: { name?: string; phone?: string }
): ReceptionistChatResult {
  const clinic = db.getClinic();
  const doctors = db.getDoctors();
  const services = db.getServices().filter((s) => s.isActive !== false);
  const last = (conversation[conversation.length - 1]?.content || '').toLowerCase();
  const p = parseConversation(conversation);
  const executedTools: ExecutedToolLog[] = [];
  const done = (r: Partial<ReceptionistChatResult> & { reply: string }): ReceptionistChatResult => ({
    category: 'General Question',
    actionRequired: 'none',
    executedTools,
    engine: 'offline',
    ...r
  });

  const doctor = p.doctorId ? doctors.find((d) => d.id === p.doctorId) : undefined;
  let service = p.serviceId ? services.find((s) => s.id === p.serviceId) : undefined;
  if (!service && doctor) {
    service = services.find((s) => doctor.servicesOffered.includes(s.id) && /consult|follow|well|skin|cardio/i.test(s.name)) ||
      services.find((s) => doctor.servicesOffered.includes(s.id));
  }

  const lastIsInfo = /\b(hour|open until|address|where are you|location|parking)\b/.test(last) && !p.wantsBooking;
  const lastIsPrice = /\b(fee|cost|price|how much|charge)\b/.test(last);
  const lastIsDoctors = /\b(doctors?|providers?|specialists?|who works|physicians?)\b/.test(last) && !p.wantsBooking && !p.wantsAvailability;

  if (lastIsInfo) {
    return done({
      category: 'Clinic Information',
      reply: `${clinic.name} is at **${clinic.address}**. Hours: Mon-Fri ${clinic.openingHours.weekdays.start}-${clinic.openingHours.weekdays.end}, Sat ${clinic.openingHours.saturday.start}-${clinic.openingHours.saturday.end}, closed Sundays. Phone: ${clinic.phone}.`
    });
  }
  if (lastIsPrice && !p.wantsBooking) {
    const list = (service ? [service] : services).map((s) => `- **${s.name}**: $${s.consultationFee} (${s.durationMinutes} min)`).join('\n');
    return done({ category: 'Billing', reply: `Here are our consultation fees:\n\n${list}\n\nWould you like me to check available times?` });
  }
  if (lastIsDoctors) {
    const list = doctors.map((d) => `- **${d.name}**, ${d.specialty}`).join('\n');
    return done({ category: 'Clinic Information', reply: `Our doctors:\n\n${list}\n\nTell me which specialty you need and I will check their open slots.` });
  }

  if (p.wantsBooking || p.wantsAvailability || p.date || p.time) {
    // Resolve date: asked date, else the next open day that has slots.
    let date = p.date;
    let slots: ReturnType<typeof db.getAvailableSlots> = [];
    const query = { doctorId: doctor?.id, serviceId: service?.id, durationMinutes: service?.durationMinutes };
    if (date) {
      const res = executeCheckAvailability({ date, doctorId: doctor?.id });
      slots = date >= clinicToday().date ? db.getAvailableSlots(date, query) : [];
      logTool(executedTools, 'check_availability', `Checked live calendar for ${date}: ${slots.length} open slot(s).`, 'success', { ...res, availableSlotsCount: slots.length });
      if (!res.clinicOpen) {
        return done({ category: 'Appointment', reply: `${res.message} Which other day works for you?` });
      }
    } else {
      for (let i = 0; i <= 14 && !slots.length; i++) {
        const d = addDaysToDate(clinicToday().date, i);
        slots = db.getAvailableSlots(d, query);
        if (slots.length) date = d;
      }
      if (date) logTool(executedTools, 'check_availability', `Found the next open day: ${date} (${slots.length} slot(s)).`, 'success', { date, availableSlotsCount: slots.length });
    }

    if (!date || !slots.length) {
      return done({ category: 'Appointment', reply: `I could not find any open slots${date ? ` on ${date}` : ' in the next two weeks'} for that request. Would you like to try another day, doctor or service?` });
    }

    const dow = DAY_NAMES[dayOfWeekOf(date)];

    // Not enough to book yet: show real slots and ask for the next missing item.
    if (!p.wantsBooking || !p.time) {
      return done({
        category: 'Appointment',
        reply: `Here are verified open times${doctor ? ` with ${doctor.name}` : service ? ` for ${service.name}` : ''} on **${dow} ${date}**:\n\n${formatSlots(slots)}\n\n${p.wantsBooking ? 'Which time would you like?' : 'Would you like me to book one of these? Tell me the time and which service you need.'}`
      });
    }

    // Time chosen: find a matching slot (pick the doctor when none specified).
    const timeSlots = slots.filter((s) => s.time === p.time);
    if (!timeSlots.length) {
      return done({
        category: 'Appointment',
        reply: `${fmtTime12(p.time)} is not open on ${dow} ${date}. These times are:\n\n${formatSlots(slots)}\n\nWhich would you like?`
      });
    }
    const chosen = timeSlots[0];
    const chosenDoctor = doctors.find((d) => d.id === chosen.doctorId)!;
    const chosenService = service && chosenDoctor.servicesOffered.includes(service.id)
      ? service
      : services.find((s) => chosenDoctor.servicesOffered.includes(s.id));

    const name = p.name || patientContext?.name;
    const phone = p.phone || patientContext?.phone;
    if (!name || !phone) {
      const missing = [!name && 'your full name', !phone && 'a phone number'].filter(Boolean).join(' and ');
      return done({
        category: 'Appointment',
        reply: `${fmtTime12(p.time)} on ${dow} ${date} is open with **${chosenDoctor.name}**${chosenService ? ` for ${chosenService.name}` : ''}. To reserve it I need ${missing}.`
      });
    }

    const staged = executeRequestBooking({
      patientName: name,
      patientPhone: phone,
      patientEmail: p.email,
      doctorId: chosenDoctor.id,
      serviceId: chosenService?.id,
      date,
      startTime: p.time,
      notes: 'Requested via MediFlow AI assistant'
    });
    if (staged.success && staged.bookingProposal) {
      const b = staged.bookingProposal;
      logTool(executedTools, 'request_booking', `Slot validated with ${b.doctorName} on ${b.date} at ${b.startTime}. Awaiting patient confirmation.`, 'success', b);
      return done({
        category: 'Appointment',
        actionRequired: 'confirm_booking',
        pendingBooking: b,
        reply: `Thanks ${b.patientName}. I verified the calendar and prepared this booking: **${b.serviceName}** with **${b.doctorName}** on **${dow} ${b.date} at ${fmtTime12(b.startTime)}** (fee $${b.consultationFee}). It is **not final** until you press **Confirm** below.`
      });
    }
    logTool(executedTools, 'request_booking', `Booking not staged: ${staged.conflictReason || staged.message}`, 'warning', staged);
    return done({ category: 'Appointment', reply: `I could not stage that booking: ${staged.conflictReason || staged.message} Shall I look at other times?` });
  }

  if (/\b(refund|complain|angry|billing dispute|speak to (a )?(human|person|staff)|manager)\b/.test(last)) {
    const inq = db.addInquiry({
      patientName: patientContext?.name || 'Chat patient',
      patientContact: patientContext?.phone || '',
      message: conversation[conversation.length - 1]?.content || '',
      category: 'Human Assistance Required',
      priority: 'high',
      status: 'Escalated',
      aiAssisted: true,
      assignedTo: 'Front Desk Lead'
    });
    db.recordExecution('auto-3', 'Front Desk Staff Escalation', `Escalation from ${inq.patientName}`, 'Warning', 'Escalated chat request to Front Desk Lead.');
    logTool(executedTools, 'escalate_to_staff', `Escalated to Front Desk Lead (${inq.id}).`, 'warning', { inquiryId: inq.id });
    return done({ category: 'Human Assistance Required', reply: 'I have passed this to our front-desk lead, who will contact you. Is there anything else I can help with?' });
  }

  return done({
    reply: `Hello, I am the MediFlow AI assistant for ${clinic.name}. I can find open appointment times, book a visit, and answer questions about hours, doctors and prices. What would you like to do?`
  });
}

/* -------------------------------------------------------------------------- */
/*  Inquiry classification                                                    */
/* -------------------------------------------------------------------------- */

export const INQUIRY_CATEGORIES = [
  'Appointment',
  'Clinic Information',
  'Billing',
  'Service Inquiry',
  'General Question',
  'Human Assistance Required'
] as const;
type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface ClassificationResult {
  category: string;
  priority: Priority;
  suggestedResponse: string;
  isEscalated: boolean;
}

/**
 * Prompt v3 (see PROMPT_ENGINEERING.md): explicit category definitions, priority rubric,
 * three worked examples, enum-constrained JSON schema, and a rule that the model must never
 * give clinical advice in the suggested response.
 */
const CLASSIFY_SYSTEM = `You are the triage classifier for the front desk of a multi-specialty outpatient clinic.
Classify ONE patient message.

CATEGORIES
- Appointment: booking, rescheduling, cancelling, availability, reminders.
- Clinic Information: hours, address, parking, doctors, what to bring.
- Billing: fees, invoices, insurance, payments, refunds.
- Service Inquiry: what a service involves, preparation, duration.
- General Question: anything administrative that fits nowhere else.
- Human Assistance Required: symptoms, medication/refill requests, complaints, disputes, distress, anything a clinician or manager must handle.

PRIORITY RUBRIC
- urgent: possible emergency or acute symptoms.
- high: new or worsening symptoms, medication/refill needs, same-day cancellations, complaints.
- medium: normal booking or rescheduling requests, service questions.
- low: informational questions (hours, parking, prices).
Set isEscalated=true for urgent or high priority, or whenever the category is Human Assistance Required.

suggestedResponse: 1-2 warm, professional sentences from the front desk. Never diagnose, never recommend medication. For urgent messages tell the patient to call 911.

EXAMPLES
"What time do you close on Saturday?" -> {"category":"Clinic Information","priority":"low","isEscalated":false}
"I need to move my Thursday visit to next week" -> {"category":"Appointment","priority":"medium","isEscalated":false}
"My chest has been tight since last night" -> {"category":"Human Assistance Required","priority":"urgent","isEscalated":true}`;

export async function classifyInquiryWithGemini(patientMessage: string): Promise<ClassificationResult> {
  if (isEmergencyText(patientMessage)) {
    return {
      category: 'Human Assistance Required',
      priority: 'urgent',
      suggestedResponse: 'Please call 911 or go to the nearest emergency department immediately. Our clinical triage team has been alerted.',
      isEscalated: true
    };
  }

  if (ai) {
    try {
      const res = await generate({
        contents: `Patient message:\n"""${patientMessage}"""`,
        config: {
          systemInstruction: CLASSIFY_SYSTEM,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING, enum: [...INQUIRY_CATEGORIES] },
              priority: { type: Type.STRING, enum: ['low', 'medium', 'high', 'urgent'] },
              suggestedResponse: { type: Type.STRING },
              isEscalated: { type: Type.BOOLEAN }
            },
            required: ['category', 'priority', 'suggestedResponse', 'isEscalated']
          },
          temperature: 0.1
        }
      });
      const parsed = JSON.parse(res.text || '{}');
      if (INQUIRY_CATEGORIES.includes(parsed.category) && ['low', 'medium', 'high', 'urgent'].includes(parsed.priority)) {
        return {
          category: parsed.category,
          priority: parsed.priority,
          suggestedResponse: parsed.suggestedResponse || 'Thank you for contacting us. Our front desk will review your message shortly.',
          isEscalated: Boolean(parsed.isEscalated) || parsed.priority === 'urgent' || parsed.priority === 'high'
        };
      }
    } catch (e) {
      console.warn('[MediFlow] Gemini classification failed, using rules:', (e as any)?.message || e);
    }
  }
  lastEngine = 'offline';
  return classifyWithRules(patientMessage);
}

function classifyWithRules(message: string): ClassificationResult {
  const t = message.toLowerCase();
  const has = (re: RegExp) => re.test(t);
  let category: string = 'General Question';
  let priority: Priority = 'medium';
  let suggestedResponse = 'Thank you for contacting Harmony Health Clinic. Our front desk has received your message and will reply shortly.';

  if (has(/\b(refill|prescription|medication|pain|symptom|fever|dizzy|vomit|worse|bleed|swelling|complain|refund|dispute|manager)\b/)) {
    category = 'Human Assistance Required';
    priority = 'high';
    suggestedResponse = 'Thank you for letting us know. A member of our clinical team will contact you today. If this feels like an emergency please call 911.';
  } else if (has(/\b(bill|invoice|receipt|insurance|payment|charge|copay)\b/)) {
    category = 'Billing';
    priority = 'low';
    suggestedResponse = 'Thanks for your question. Our billing desk will review it and respond within one business day.';
  } else if (has(/\b(reschedul|cancel|book|appointment|slot|available|availability|move my|change my)\b/)) {
    category = 'Appointment';
    priority = has(/\b(today|tonight|cancel|urgent|asap)\b/) ? 'high' : 'medium';
    suggestedResponse = 'Thanks for reaching out. Our scheduling team will confirm your appointment details shortly.';
  } else if (has(/\b(hours?|open|close|address|location|parking|directions|bus|transit|phone)\b/)) {
    category = 'Clinic Information';
    priority = 'low';
    suggestedResponse = 'Our hours are Mon-Fri 08:30-17:30 and Sat 09:00-13:00. The front desk will send any further details you need.';
  } else if (has(/\b(vaccin|ecg|exam|checkup|check-up|consultation|prepare|fasting|how long)\b/)) {
    category = 'Service Inquiry';
    priority = 'medium';
    suggestedResponse = 'Our team will send you the preparation details for that service shortly.';
  }
  return { category, priority, suggestedResponse, isEscalated: priority === 'high' };
}

/* -------------------------------------------------------------------------- */
/*  Operational insights (analytics panel)                                    */
/* -------------------------------------------------------------------------- */

export interface InsightStats {
  totalAppointments: number;
  completedVisits: number;
  cancellations: number;
  noShows: number;
  completionRate: number;
  cancellationRate: number;
  topService: string | null;
  totalInquiries: number;
  aiHandledInquiries: number;
}

export async function generateOperationalInsights(stats: InsightStats): Promise<string[]> {
  if (stats.totalAppointments === 0 && stats.totalInquiries === 0) {
    return ['No appointments or inquiries have been recorded yet. Insights will appear as soon as patients start booking.'];
  }

  if (ai) {
    try {
      const res = await generate({
        contents: `Clinic metrics (JSON):\n${JSON.stringify(stats)}`,
        config: {
          systemInstruction: `You write operational insights for a clinic manager.
Use ONLY numbers present in the JSON. Never invent trends, comparisons with earlier periods, or causes.
If a metric is 0 or null say that plainly instead of guessing. Write exactly 4 insights, each 1-2 sentences, plain language, each mentioning at least one real number.`,
          responseMimeType: 'application/json',
          responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } },
          temperature: 0.2
        }
      });
      const parsed = JSON.parse(res.text || '[]');
      if (Array.isArray(parsed) && parsed.length) return parsed.slice(0, 4).map(String);
    } catch (e) {
      console.warn('[MediFlow] Gemini insights failed, using computed insights:', (e as any)?.message || e);
    }
  }
  lastEngine = 'offline';
  return [
    `${stats.completedVisits} of ${stats.totalAppointments} appointments are completed (${stats.completionRate}% completion rate).`,
    stats.topService ? `${stats.topService} is the most requested service so far.` : 'No service has been requested yet.',
    `${stats.cancellations} cancellation(s) (${stats.cancellationRate}%) and ${stats.noShows} no-show(s) are recorded.`,
    `The AI assistant has handled ${stats.aiHandledInquiries} of ${stats.totalInquiries} patient inquiries.`
  ];
}

/* -------------------------------------------------------------------------- */
/*  AI daily / periodic clinic report                                         */
/* -------------------------------------------------------------------------- */

export interface ReportContent {
  summary: string;
  operationalTrends: string[];
  keyObservations: string[];
  recommendations: string[];
  pendingActions: string[];
}

/** Everything the report prompt is allowed to talk about. Built from the live database. */
export interface ReportFacts {
  clinicName: string;
  reportType: string;
  startDate: string;
  endDate: string;
  appointments: {
    total: number;
    byStatus: Record<string, number>;
    byDoctor: Record<string, number>;
    byService: Record<string, number>;
    pendingApproval: number;
    bookedViaAssistantOrPortal: number;
    bookingsMadeInPeriod: number;
  };
  inquiries: {
    total: number;
    byCategory: Record<string, number>;
    byPriority: Record<string, number>;
    escalated: number;
    stillOpen: number;
  };
  automations: { runs: number; byRule: Record<string, number> };
  newPatients: number;
}

/**
 * Prompt v3 (see PROMPT_ENGINEERING.md).
 * v1 asked for "a formal report" and let the model invent facts.
 * v2 added "do not fabricate".
 * v3 separates ROLE / DATA / RULES / OUTPUT, sends the facts as JSON, forces JSON-schema output,
 * defines how to behave with empty data, and requires every claim to cite a number from the data.
 */
const REPORT_SYSTEM = `# ROLE
You are the practice-operations analyst for an outpatient clinic. You write the report a clinic manager reads in 60 seconds.

# RULES
1. Use ONLY the figures in the DATA JSON. Do not invent numbers, percentages, trends, prior-period comparisons, staff names or causes.
2. Every sentence in trends and observations must contain at least one concrete figure from the data (a count, a name from byDoctor/byService, or a status).
3. If a count is 0, say so plainly ("no cancellations were recorded"). If total appointments is 0, say there is not enough activity to analyse and keep the report short: recommendations should be about getting data flowing, not about performance.
4. Recommendations must be actionable, small in number (max 3) and directly justified by a figure. Pending actions must be concrete tasks that follow from the data (e.g. "Confirm 2 pending appointments"); if nothing is pending, return one item saying no pending actions.
5. Neutral, professional tone. No clinical advice, no patient names, no marketing language.

# OUTPUT
Return JSON only, matching the schema. summary = 2-3 sentences. operationalTrends = 2-3 items. keyObservations = 2-3 items. recommendations = 1-3 items. pendingActions = 1-3 items.`;

export async function generateReportWithGemini(facts: ReportFacts): Promise<ReportContent> {
  if (ai) {
    try {
      const res = await generate({
        contents: `# DATA\n${JSON.stringify(facts, null, 2)}`,
        config: {
          systemInstruction: REPORT_SYSTEM,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              operationalTrends: { type: Type.ARRAY, items: { type: Type.STRING } },
              keyObservations: { type: Type.ARRAY, items: { type: Type.STRING } },
              recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
              pendingActions: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['summary', 'operationalTrends', 'keyObservations', 'recommendations', 'pendingActions']
          },
          temperature: 0.2
        },
        timeoutMs: 40000
      });
      const parsed = JSON.parse(res.text || '{}');
      if (parsed.summary && Array.isArray(parsed.operationalTrends)) return parsed as ReportContent;
    } catch (e) {
      console.warn('[MediFlow] Gemini report failed, using data-driven fallback:', (e as any)?.message || e);
    }
  }
  lastEngine = 'offline';
  return reportFromFacts(facts);
}

const top = (rec: Record<string, number>) => Object.entries(rec).sort((a, b) => b[1] - a[1])[0];
const listCounts = (rec: Record<string, number>) =>
  Object.entries(rec)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} (${v})`)
    .join(', ');

/** Deterministic report built only from real figures - no invented claims. */
export function reportFromFacts(f: ReportFacts): ReportContent {
  const period = f.startDate === f.endDate ? f.startDate : `${f.startDate} to ${f.endDate}`;
  const a = f.appointments;
  if (a.total === 0 && f.inquiries.total === 0) {
    return {
      summary: `No appointments or patient inquiries were recorded for ${period}, so there is not enough activity to analyse.`,
      operationalTrends: ['0 appointments and 0 inquiries were recorded in this period.'],
      keyObservations: [`${f.newPatients} new patient record(s) were created in this period.`],
      recommendations: ['Share the patient portal link so patients can start booking; reports fill in automatically as activity is recorded.'],
      pendingActions: ['No pending actions.']
    };
  }
  const topDoc = top(a.byDoctor);
  const topSrv = top(a.byService);
  const completed = a.byStatus['Completed'] || 0;
  const cancelled = a.byStatus['Cancelled'] || 0;
  const noShow = a.byStatus['No-show'] || 0;
  const confirmed = a.byStatus['Confirmed'] || 0;
  return {
    summary: `For ${period}, ${f.clinicName} recorded ${a.total} appointment(s): ${confirmed} confirmed, ${a.pendingApproval} pending, ${completed} completed, ${cancelled} cancelled and ${noShow} no-show. ${f.inquiries.total} patient inquiries were received, of which ${f.inquiries.escalated} were escalated to staff.`,
    operationalTrends: [
      topSrv ? `${topSrv[0]} was the most requested service with ${topSrv[1]} of ${a.total} appointment(s).` : 'No service demand data yet.',
      topDoc ? `${topDoc[0]} carried the largest share of visits (${topDoc[1]} of ${a.total}).` : 'No provider workload data yet.',
      `${a.bookedViaAssistantOrPortal} appointment(s) were created through the AI assistant or patient portal; ${a.bookingsMadeInPeriod} booking(s) were made during this period.`
    ],
    keyObservations: [
      `Status breakdown: ${listCounts(a.byStatus) || 'none'}.`,
      f.inquiries.total ? `Inquiry categories: ${listCounts(f.inquiries.byCategory)}; ${f.inquiries.stillOpen} still open.` : 'No patient inquiries were received.',
      `Automations ran ${f.automations.runs} time(s) in this period.`
    ],
    recommendations: [
      a.pendingApproval > 0 ? `Review and confirm the ${a.pendingApproval} pending appointment(s) so patients receive confirmation.` : 'All appointment requests have been processed; keep monitoring new requests.',
      f.inquiries.stillOpen > 0 ? `Respond to the ${f.inquiries.stillOpen} open inquiry(ies) to keep response times low.` : 'No inquiries are waiting for a response.'
    ],
    pendingActions: [
      a.pendingApproval > 0 ? `Confirm ${a.pendingApproval} pending appointment(s).` : 'No pending appointment approvals.',
      f.inquiries.escalated > 0 ? `Follow up on ${f.inquiries.escalated} escalated inquiry(ies).` : 'No escalated inquiries to follow up.'
    ]
  };
}

/* -------------------------------------------------------------------------- */
/*  Missed-appointment follow-up                                              */
/* -------------------------------------------------------------------------- */

export async function draftMissedAppointmentFollowup(patientName: string, doctorName: string, date: string): Promise<string> {
  if (ai) {
    try {
      const res = await generate({
        contents: `Patient: ${patientName}\nDoctor: ${doctorName}\nMissed appointment date: ${date}`,
        config: {
          systemInstruction:
            'Write a 2-3 sentence follow-up message from a clinic front desk to a patient who missed an appointment. Warm, non-judgmental, no blame, no clinical advice. Invite them to rebook via the patient portal or by replying. Sign off as "Harmony Health Clinic Team".',
          temperature: 0.5
        }
      });
      if (res.text) return res.text.trim();
    } catch (e) {
      console.warn('[MediFlow] Gemini follow-up failed, using template:', (e as any)?.message || e);
    }
  }
  lastEngine = 'offline';
  return `Dear ${patientName}, we noticed you could not make your appointment with ${doctorName} on ${date}. We hope all is well. You can rebook any time through the patient portal or by replying to this message. - Harmony Health Clinic Team`;
}
