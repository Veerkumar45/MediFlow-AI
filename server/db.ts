import fs from 'fs';
import path from 'path';
import {
  ClinicProfile,
  Doctor,
  HealthcareService,
  Patient,
  Appointment,
  Inquiry,
  AutomationRule,
  AutomationExecution,
  ClinicReport,
  AuditLog
} from '../src/types/index.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DATA_DIR, 'clinic_db.json');

export interface DatabaseSchema {
  clinic: ClinicProfile;
  doctors: Doctor[];
  services: HealthcareService[];
  patients: Patient[];
  appointments: Appointment[];
  inquiries: Inquiry[];
  automations: AutomationRule[];
  executions: AutomationExecution[];
  reports: ClinicReport[];
  auditLogs: AuditLog[];
}

/** IANA zone parsed from the clinic profile string, e.g. "America/Chicago (CST)". */
export function clinicZone(tz?: string): string {
  const m = (tz || '').match(/[A-Za-z]+\/[A-Za-z_]+/);
  return m ? m[0] : 'America/Chicago';
}

/** Current date (YYYY-MM-DD) and minutes-since-midnight in the clinic's own time zone. */
export function clinicNow(tz?: string): { date: string; minutes: number; dayOfWeek: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: clinicZone(tz),
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short'
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
    dayOfWeek: days.indexOf(get('weekday'))
  };
}

/** Add whole days to a YYYY-MM-DD string without any time-zone drift. */
export function addDaysToDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function dayOfWeekOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

export function generateCleanData(): DatabaseSchema {

  const clinic: ClinicProfile = {
    name: 'Harmony Health Clinic',
    tagline: 'Smarter Clinics. Seamless Care.',
    address: '742 Evergreen Medical Plaza, Suite 300, Springfield, IL 62704',
    phone: '+1 (217) 555-0199',
    email: 'contact@harmonyhealthclinic.com',
    timeZone: 'America/Chicago (CST)',
    openingHours: {
      weekdays: { start: '08:30', end: '17:30' },
      saturday: { start: '09:00', end: '13:00' },
      sunday: { closed: true }
    },
    bookingPolicies: {
      advanceBookingDays: 30,
      cancellationWindowHours: 24,
      autoConfirmRequests: false,
      requirePhoneVerification: false
    },
    aiReceptionist: {
      welcomeMessage: 'Hello! I am your MediFlow AI assistant for Harmony Health Clinic. How can I help you today?',
      escalationThreshold: 'Medical advice, emergencies, complex billing disputes, or unresolvable slot requests',
      allowedTopics: [
        'Booking requests',
        'Doctor schedules and specialties',
        'Clinic hours and directions',
        'Cancellation and rescheduling',
        'Service preparation and fees'
      ],
      clinicBio: 'Harmony Health Clinic is a multi-specialty outpatient healthcare facility offering compassionate primary care, pediatrics, dermatology, cardiology consultations, and diagnostic wellness checkups.'
    }
  };

  const doctors: Doctor[] = [
    {
      id: 'doc-1',
      name: 'Dr. Sarah Mitchell',
      title: 'MD, FACP',
      specialty: 'Internal & General Medicine',
      email: 's.mitchell@harmonyhealthclinic.com',
      phone: '+1 (217) 555-0101',
      workingDays: [1, 2, 3, 4, 5],
      workHours: { start: '09:00', end: '17:00' },
      breakHours: { start: '12:30', end: '13:30' },
      servicesOffered: ['srv-1', 'srv-2', 'srv-6'],
      roomNumber: 'Consultation Suite 101'
    },
    {
      id: 'doc-2',
      name: 'Dr. Marcus Vance',
      title: 'MD, FACC',
      specialty: 'Cardiovascular Care',
      email: 'm.vance@harmonyhealthclinic.com',
      phone: '+1 (217) 555-0102',
      workingDays: [1, 3, 5],
      workHours: { start: '09:30', end: '16:30' },
      breakHours: { start: '13:00', end: '14:00' },
      servicesOffered: ['srv-1', 'srv-4', 'srv-6'],
      roomNumber: 'Cardiology Center 202'
    },
    {
      id: 'doc-3',
      name: 'Dr. Elena Rostova',
      title: 'MD, FAAD',
      specialty: 'Dermatology & Skin Wellness',
      email: 'e.rostova@harmonyhealthclinic.com',
      phone: '+1 (217) 555-0103',
      workingDays: [2, 3, 4, 6],
      workHours: { start: '09:00', end: '16:00' },
      breakHours: { start: '12:00', end: '13:00' },
      servicesOffered: ['srv-3', 'srv-7'],
      roomNumber: 'Dermatology Lab 105'
    },
    {
      id: 'doc-4',
      name: 'Dr. David Chen',
      title: 'MD, FAAP',
      specialty: 'Pediatrics & Adolescent Care',
      email: 'd.chen@harmonyhealthclinic.com',
      phone: '+1 (217) 555-0104',
      workingDays: [1, 2, 4, 5],
      workHours: { start: '08:30', end: '16:30' },
      breakHours: { start: '12:30', end: '13:30' },
      servicesOffered: ['srv-1', 'srv-5', 'srv-8'],
      roomNumber: 'Pediatrics Wing 110'
    },
    {
      id: 'doc-5',
      name: 'Dr. Rachel Patel',
      title: 'DO, FAAFP',
      specialty: 'Family Medicine & Preventive Care',
      email: 'r.patel@harmonyhealthclinic.com',
      phone: '+1 (217) 555-0105',
      workingDays: [1, 2, 3, 4, 5, 6],
      workHours: { start: '09:00', end: '17:00' },
      breakHours: { start: '13:00', end: '14:00' },
      servicesOffered: ['srv-1', 'srv-2', 'srv-6', 'srv-8'],
      roomNumber: 'Family Practice 103'
    }
  ];

  const services: HealthcareService[] = [
    {
      id: 'srv-1',
      name: 'General Health Consultation',
      category: 'Primary Care',
      description: 'Comprehensive physical assessment, vitals check, chronic care review, and primary care medical guidance.',
      durationMinutes: 30,
      consultationFee: 95,
      isActive: true
    },
    {
      id: 'srv-2',
      name: 'Annual Preventive Wellness Exam',
      category: 'Preventive Care',
      description: 'Full body routine health screening, routine bloodwork order, lifestyle counseling, and preventive risk analysis.',
      durationMinutes: 45,
      consultationFee: 160,
      isActive: true
    },
    {
      id: 'srv-3',
      name: 'Dermatology Skin Evaluation',
      category: 'Specialty Care',
      description: 'Full dermoscopic skin check, mole screening, acne management, and eczema diagnosis.',
      durationMinutes: 30,
      consultationFee: 140,
      isActive: true
    },
    {
      id: 'srv-4',
      name: 'Cardiology Assessment & ECG Review',
      category: 'Specialty Care',
      description: 'Cardiovascular risk evaluation, 12-lead ECG tracing review, blood pressure optimization, and arrhythmia follow-up.',
      durationMinutes: 45,
      consultationFee: 210,
      isActive: true
    },
    {
      id: 'srv-5',
      name: 'Pediatric Well-Child Checkup',
      category: 'Pediatrics',
      description: 'Growth and milestone development assessment, immunization scheduling, vision/hearing check for infants and children.',
      durationMinutes: 30,
      consultationFee: 85,
      isActive: true
    },
    {
      id: 'srv-6',
      name: 'Chronic Disease Follow-up',
      category: 'Chronic Care',
      description: 'Follow-up for hypertension, diabetes type 2, asthma, or thyroid conditions with lab reviews.',
      durationMinutes: 30,
      consultationFee: 80,
      isActive: true
    },
    {
      id: 'srv-7',
      name: 'Minor Skin Lesion Cryotherapy',
      category: 'Specialty Care',
      description: 'Targeted liquid nitrogen cryosurgery for benign warts, seborrheic keratoses, and actinic keratoses.',
      durationMinutes: 20,
      consultationFee: 120,
      isActive: true
    },
    {
      id: 'srv-8',
      name: 'Flu & Travel Vaccination Visit',
      category: 'Immunization',
      description: 'Seasonal influenza vaccine administration or international travel immunization consultation and record issuance.',
      durationMinutes: 20,
      consultationFee: 45,
      isActive: true
    }
  ];

  // Clean slate: no sample patients, appointments, inquiries, reports, executions or audit logs.
  const patients: Patient[] = [];
  const appointments: Appointment[] = [];
  const inquiries: Inquiry[] = [];

  // 5 Automations
  const automations: AutomationRule[] = [
    {
      id: 'auto-1',
      name: 'Appointment Request Processing',
      description: 'Automatically validates requested doctor slot availability, validates patient contact, checks for calendar collisions, creates pending record, and queues staff notification.',
      trigger: 'New patient appointment booking request',
      enabled: true,
      executionCount: 0,
      actions: [
        'Validate schedule availability & doctor roster',
        'Verify conflict-free calendar slot',
        'Generate unique booking reference (MF-XXXXX)',
        'Send automated confirmation / pending notice to patient'
      ]
    },
    {
      id: 'auto-2',
      name: 'Smart Appointment Reminders',
      description: 'Identifies appointments scheduled within 24 hours, drafts personalized pre-visit instructions and time reminders, and marks delivery status.',
      trigger: 'Scheduled hourly check (24h before appointment)',
      enabled: true,
      executionCount: 0,
      actions: [
        'Scan upcoming appointments within 24-hour window',
        'Compose patient reminder with room number & doctor name',
        'Attach fasting or clinical prep guidelines if applicable',
        'Record delivery timestamp in audit trail'
      ]
    },
    {
      id: 'auto-3',
      name: 'Inquiry Classification & Routing',
      description: 'Uses Google Gemini to analyze patient message semantics, categorize the topic, evaluate urgency/priority, and automatically route urgent or medical issues to clinical staff.',
      trigger: 'New incoming inquiry or chat escalation',
      enabled: true,
      executionCount: 0,
      actions: [
        'Analyze incoming text with Gemini classifier',
        'Assign 1 of 6 official inquiry categories',
        'Tag priority level (low, medium, high, urgent)',
        'Route emergency/clinical questions to nurse triage queue'
      ]
    },
    {
      id: 'auto-4',
      name: 'Daily Clinic Operations Summary',
      description: 'Aggregates daily booking volume, cancellation metrics, doctor utilization, and outstanding inquiries into a concise administrative briefing for clinic management.',
      trigger: 'Daily at 17:30 or on-demand execution',
      enabled: true,
      executionCount: 0,
      actions: [
        'Aggregate appointment count, completions, no-shows',
        'Calculate clinic cancellation & conversion rates',
        'Summarize open inquiries requiring receptionist attention',
        'Generate executive narrative with Gemini'
      ]
    },
    {
      id: 'auto-5',
      name: 'Missed Appointment Follow-up',
      description: 'Detects when an appointment is marked as No-show, drafts a compassionate follow-up message with rebooking links, and queues it for receptionist review.',
      trigger: 'Appointment status updated to No-show',
      enabled: true,
      executionCount: 0,
      actions: [
        'Detect No-show status trigger',
        'Create administrative follow-up task for receptionist',
        'Draft polite check-in message with available rebooking slots',
        'Require receptionist review before sending'
      ]
    }
  ];

  const executions: AutomationExecution[] = [];
  const reports: ClinicReport[] = [];
  const auditLogs: AuditLog[] = [];

  return {
    clinic,
    doctors,
    services,
    patients,
    appointments,
    inquiries,
    automations,
    executions,
    reports,
    auditLogs
  };
}

class Database {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.loadOrSeed();
  }

  private loadOrSeed(): DatabaseSchema {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && parsed.clinic && parsed.doctors && parsed.appointments) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Could not read existing database, generating fresh seed data.', e);
    }

    const fresh = generateCleanData();
    this.save(fresh);
    return fresh;
  }

  private save(dataToSave?: DatabaseSchema) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(dataToSave || this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to persist database file', e);
    }
  }

  public resetToClean(): DatabaseSchema {
    this.data = generateCleanData();
    this.save();
    return this.data;
  }

  public getData(): DatabaseSchema {
    return this.data;
  }

  // Clinic
  public getClinic(): ClinicProfile {
    return this.data.clinic;
  }

  public updateClinic(updates: Partial<ClinicProfile>): ClinicProfile {
    this.data.clinic = { ...this.data.clinic, ...updates };
    this.logAudit('Update Clinic Settings', 'Setting', 'clinic', 'admin', 'Clinic profile updated');
    this.save();
    return this.data.clinic;
  }

  // Doctors
  public getDoctors(): Doctor[] {
    return this.data.doctors;
  }

  public getDoctor(id: string): Doctor | undefined {
    return this.data.doctors.find((d) => d.id === id);
  }

  public addDoctor(doctor: Doctor): Doctor {
    this.data.doctors.push(doctor);
    this.logAudit('Add Doctor', 'Setting', doctor.id, 'admin', `Added doctor ${doctor.name}`);
    this.save();
    return doctor;
  }

  public updateDoctor(id: string, updates: Partial<Doctor>): Doctor | null {
    const idx = this.data.doctors.findIndex((d) => d.id === id);
    if (idx === -1) return null;
    this.data.doctors[idx] = { ...this.data.doctors[idx], ...updates };
    this.logAudit('Update Doctor', 'Setting', id, 'admin', `Updated details for ${this.data.doctors[idx].name}`);
    this.save();
    return this.data.doctors[idx];
  }

  public deleteDoctor(id: string): boolean {
    const idx = this.data.doctors.findIndex((d) => d.id === id);
    if (idx === -1) return false;
    const removed = this.data.doctors.splice(idx, 1)[0];
    this.logAudit('Delete Doctor', 'Setting', id, 'admin', `Removed doctor ${removed.name}`);
    this.save();
    return true;
  }

  // Services
  public getServices(): HealthcareService[] {
    return this.data.services;
  }

  public getService(id: string): HealthcareService | undefined {
    return this.data.services.find((s) => s.id === id);
  }

  public addService(service: HealthcareService): HealthcareService {
    this.data.services.push(service);
    this.logAudit('Add Service', 'Setting', service.id, 'admin', `Added service ${service.name}`);
    this.save();
    return service;
  }

  public updateService(id: string, updates: Partial<HealthcareService>): HealthcareService | null {
    const idx = this.data.services.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    this.data.services[idx] = { ...this.data.services[idx], ...updates };
    this.logAudit('Update Service', 'Setting', id, 'admin', `Updated service ${this.data.services[idx].name}`);
    this.save();
    return this.data.services[idx];
  }

  public deleteService(id: string): boolean {
    const idx = this.data.services.findIndex((s) => s.id === id);
    if (idx === -1) return false;
    const removed = this.data.services.splice(idx, 1)[0];
    this.logAudit('Delete Service', 'Setting', id, 'admin', `Removed service ${removed.name}`);
    this.save();
    return true;
  }

  // Patients
  public getPatients(): Patient[] {
    return this.data.patients;
  }

  public getPatient(id: string): Patient | undefined {
    return this.data.patients.find((p) => p.id === id);
  }

  public addPatient(patient: Patient): Patient {
    this.data.patients.unshift(patient);
    this.logAudit('Add Patient', 'Patient', patient.id, 'receptionist', `Registered patient ${patient.fullName}`);
    this.save();
    return patient;
  }

  public updatePatient(id: string, updates: Partial<Patient>): Patient | null {
    const idx = this.data.patients.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    this.data.patients[idx] = { ...this.data.patients[idx], ...updates };
    this.logAudit('Update Patient', 'Patient', id, 'receptionist', `Updated record for ${this.data.patients[idx].fullName}`);
    this.save();
    return this.data.patients[idx];
  }

  public deletePatient(id: string): boolean {
    const idx = this.data.patients.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    const removed = this.data.patients.splice(idx, 1)[0];
    this.logAudit('Delete Patient', 'Patient', id, 'receptionist', `Deleted patient ${removed.fullName}`);
    this.save();
    return true;
  }

  // Appointments
  public getAppointments(): Appointment[] {
    return this.data.appointments;
  }

  public getAppointment(id: string): Appointment | undefined {
    return this.data.appointments.find((a) => a.id === id || a.bookingReference === id);
  }

  /**
   * Validates a requested slot against every rule the clinic enforces:
   * 1. Not in the past (clinic local time) and within the advance-booking window
   * 2. Clinic opening hours for that weekday (Sunday closed)
   * 3. Doctor working day, working hours and break
   * 4. No overlap with any other non-cancelled appointment for the same doctor
   */
  public checkAppointmentConflict(
    doctorId: string,
    date: string,
    startTime: string,
    durationMinutes: number,
    excludeAppointmentId?: string
  ): { hasConflict: boolean; reason?: string } {
    const doctor = this.getDoctor(doctorId);
    if (!doctor) {
      return { hasConflict: true, reason: 'Doctor does not exist in the system.' };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{1,2}:\d{2}$/.test(startTime)) {
      return { hasConflict: true, reason: 'Invalid date or time format (expected YYYY-MM-DD and HH:mm).' };
    }

    const clinic = this.getClinic();
    const now = clinicNow(clinic.timeZone);
    const reqStart = toMinutes(startTime);
    const reqEnd = reqStart + durationMinutes;

    // 1. Past / too far ahead
    if (date < now.date || (date === now.date && reqStart <= now.minutes)) {
      return { hasConflict: true, reason: 'That time has already passed. Please choose a future slot.' };
    }
    const maxDays = clinic.bookingPolicies?.advanceBookingDays ?? 30;
    if (date > addDaysToDate(now.date, maxDays)) {
      return { hasConflict: true, reason: `Appointments can only be booked up to ${maxDays} days in advance.` };
    }

    // 2. Clinic opening hours
    const dayOfWeek = dayOfWeekOf(date);
    const hours = dayOfWeek === 0 ? clinic.openingHours.sunday : dayOfWeek === 6 ? clinic.openingHours.saturday : clinic.openingHours.weekdays;
    if (!hours || (hours as any).closed || !(hours as any).start) {
      return { hasConflict: true, reason: `${clinic.name} is closed on this day.` };
    }
    if (reqStart < toMinutes((hours as any).start) || reqEnd > toMinutes((hours as any).end)) {
      return {
        hasConflict: true,
        reason: `Requested time is outside clinic hours (${(hours as any).start} - ${(hours as any).end}).`
      };
    }

    // 3. Doctor schedule
    if (!doctor.workingDays.includes(dayOfWeek)) {
      return { hasConflict: true, reason: `${doctor.name} is not scheduled to work on this day of the week.` };
    }
    const workStart = toMinutes(doctor.workHours.start);
    const workEnd = toMinutes(doctor.workHours.end);
    if (reqStart < workStart || reqEnd > workEnd) {
      return {
        hasConflict: true,
        reason: `Requested time ${startTime} falls outside ${doctor.name}'s working hours (${doctor.workHours.start} - ${doctor.workHours.end}).`
      };
    }
    if (doctor.breakHours) {
      const breakStart = toMinutes(doctor.breakHours.start);
      const breakEnd = toMinutes(doctor.breakHours.end);
      if (reqStart < breakEnd && reqEnd > breakStart) {
        return {
          hasConflict: true,
          reason: `${doctor.name} is on scheduled break during this time (${doctor.breakHours.start} - ${doctor.breakHours.end}).`
        };
      }
    }

    // 4. Overlap with existing bookings
    for (const appt of this.data.appointments) {
      if (appt.id === excludeAppointmentId) continue;
      if (appt.doctorId === doctorId && appt.date === date && appt.status !== 'Cancelled') {
        if (reqStart < toMinutes(appt.endTime) && reqEnd > toMinutes(appt.startTime)) {
          return {
            hasConflict: true,
            reason: `Conflicting booking exists: ${doctor.name} already has an appointment from ${appt.startTime} to ${appt.endTime}.`
          };
        }
      }
    }

    return { hasConflict: false };
  }

  /**
   * Real open slots for a date: every 30-minute start time that passes ALL conflict rules.
   * Optionally limited to one doctor and/or the doctors who offer a service.
   */
  public getAvailableSlots(
    date: string,
    opts: { doctorId?: string; serviceId?: string; durationMinutes?: number } = {}
  ): Array<{ time: string; doctorId: string; doctorName: string; specialty: string }> {
    const service = opts.serviceId ? this.getService(opts.serviceId) : undefined;
    const duration = opts.durationMinutes || service?.durationMinutes || 30;
    let docs = this.getDoctors();
    if (opts.doctorId) docs = docs.filter((d) => d.id === opts.doctorId);
    if (opts.serviceId) docs = docs.filter((d) => d.servicesOffered.includes(opts.serviceId!));

    const out: Array<{ time: string; doctorId: string; doctorName: string; specialty: string }> = [];
    for (const doc of docs) {
      const start = toMinutes(doc.workHours.start);
      const end = toMinutes(doc.workHours.end);
      for (let t = start; t + duration <= end; t += 30) {
        const time = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
        if (!this.checkAppointmentConflict(doc.id, date, time, duration).hasConflict) {
          out.push({ time, doctorId: doc.id, doctorName: doc.name, specialty: doc.specialty });
        }
      }
    }
    return out.sort((x, y) => x.time.localeCompare(y.time) || x.doctorName.localeCompare(y.doctorName));
  }

  /** Finds a patient by phone (digits only) or email; creates the record when none exists. */
  public findOrCreatePatient(info: { fullName: string; phone: string; email?: string }): Patient {
    const digits = (v?: string) => (v || '').replace(/\D/g, '');
    const existing = this.data.patients.find(
      (p) =>
        (digits(info.phone) && digits(p.phone) === digits(info.phone)) ||
        (info.email && p.email && p.email.toLowerCase() === info.email.toLowerCase())
    );
    if (existing) return existing;
    return this.addPatient({
      id: this.nextId('pat', this.data.patients),
      fullName: info.fullName,
      email: info.email || '',
      phone: info.phone,
      administrativeNotes: '',
      createdAt: new Date().toISOString()
    } as Patient);
  }

  /** Next sequential id such as apt-007 that can never collide, even after deletions. */
  public nextId(prefix: string, list: Array<{ id: string }>): string {
    const max = list.reduce((m, x) => {
      const n = Number((x.id.match(/-(\d+)$/) || [])[1]);
      return Number.isFinite(n) && n < 1e9 ? Math.max(m, n) : m;
    }, 0);
    return `${prefix}-${String(max + 1).padStart(3, '0')}`;
  }

  public addAppointment(appointmentData: Omit<Appointment, 'id' | 'bookingReference' | 'createdAt' | 'updatedAt'>): { appointment?: Appointment; error?: string } {
    const conflict = this.checkAppointmentConflict(
      appointmentData.doctorId,
      appointmentData.date,
      appointmentData.startTime,
      appointmentData.durationMinutes
    );

    if (conflict.hasConflict) {
      return { error: conflict.reason };
    }

    const id = this.nextId('apt', this.data.appointments);
    const seq = Number(id.split('-')[1]);
    const bookingReference = `MF-${10000 + seq}`;
    const now = new Date().toISOString();

    const newAppt: Appointment = {
      ...appointmentData,
      id,
      bookingReference,
      createdAt: now,
      updatedAt: now
    };

    this.data.appointments.unshift(newAppt);
    this.logAudit('Create Appointment', 'Appointment', id, 'receptionist', `Created appointment ${bookingReference} for ${newAppt.patientName}`);
    this.save();

    this.recordExecution(
      'auto-1',
      'Appointment Request Processing',
      `Booking request for ${newAppt.patientName}`,
      'Success',
      `Slot validated. Reference ${bookingReference} created with ${newAppt.doctorName}.`
    );

    return { appointment: newAppt };
  }

  public updateAppointment(id: string, updates: Partial<Appointment>): { appointment?: Appointment; error?: string } {
    const idx = this.data.appointments.findIndex((a) => a.id === id || a.bookingReference === id);
    if (idx === -1) return { error: 'Appointment not found' };

    const current = this.data.appointments[idx];
    const targetDoctorId = updates.doctorId || current.doctorId;
    const targetDate = updates.date || current.date;
    const targetStartTime = updates.startTime || current.startTime;
    const targetDuration = updates.durationMinutes || current.durationMinutes;

    // If changing time/date/doctor and not cancelling, check conflict
    const reactivating = current.status === 'Cancelled' && !!updates.status && updates.status !== 'Cancelled';
    const movingSlot = !!(updates.date || updates.startTime || updates.doctorId);
    if ((movingSlot || reactivating) && updates.status !== 'Cancelled' && updates.status !== 'Completed' && updates.status !== 'No-show') {
      const conflict = this.checkAppointmentConflict(
        targetDoctorId,
        targetDate,
        targetStartTime,
        targetDuration,
        current.id
      );
      if (conflict.hasConflict) {
        return { error: conflict.reason };
      }
    }

    // Check if status changed to No-show -> trigger automation 5
    if (updates.status === 'No-show' && current.status !== 'No-show') {
      this.recordExecution(
        'auto-5',
        'Missed Appointment Follow-up',
        `No-show registered for ${current.bookingReference}`,
        'Success',
        `Created follow-up task and drafted compassionate rebooking inquiry for ${current.patientName}.`
      );
    }

    const updated: Appointment = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.data.appointments[idx] = updated;
    this.logAudit(
      'Update Appointment',
      'Appointment',
      current.id,
      'receptionist',
      `Updated appointment ${current.bookingReference} status to ${updated.status}`
    );
    this.save();
    return { appointment: updated };
  }

  public deleteAppointment(id: string): boolean {
    const idx = this.data.appointments.findIndex((a) => a.id === id || a.bookingReference === id);
    if (idx === -1) return false;
    const removed = this.data.appointments.splice(idx, 1)[0];
    this.logAudit('Delete Appointment', 'Appointment', id, 'admin', `Deleted appointment ${removed.bookingReference}`);
    this.save();
    return true;
  }

  // Inquiries
  public getInquiries(): Inquiry[] {
    return this.data.inquiries;
  }

  public addInquiry(inquiry: Omit<Inquiry, 'id' | 'createdAt'>): Inquiry {
    const id = `inq-${(this.data.inquiries.length + 1).toString().padStart(3, '0')}`;
    const newInq: Inquiry = {
      ...inquiry,
      id,
      createdAt: new Date().toISOString()
    };
    this.data.inquiries.unshift(newInq);
    this.logAudit('New Inquiry', 'Inquiry', id, 'patient', `Inquiry submitted by ${newInq.patientName}`);
    this.save();
    return newInq;
  }

  public updateInquiry(id: string, updates: Partial<Inquiry>): Inquiry | null {
    const idx = this.data.inquiries.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    this.data.inquiries[idx] = { ...this.data.inquiries[idx], ...updates };
    this.logAudit('Update Inquiry', 'Inquiry', id, 'receptionist', `Updated inquiry ${id} status to ${this.data.inquiries[idx].status}`);
    this.save();
    return this.data.inquiries[idx];
  }

  // Automations
  public getAutomations(): AutomationRule[] {
    return this.data.automations;
  }

  public updateAutomation(id: string, updates: Partial<AutomationRule>): AutomationRule | null {
    const idx = this.data.automations.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    this.data.automations[idx] = { ...this.data.automations[idx], ...updates };
    this.save();
    return this.data.automations[idx];
  }

  public getExecutions(): AutomationExecution[] {
    return this.data.executions;
  }

  public recordExecution(
    ruleId: string,
    ruleName: string,
    triggerEvent: string,
    status: 'Success' | 'Failed' | 'Warning',
    details: string
  ): AutomationExecution {
    const exec: AutomationExecution = {
      id: `exec-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      ruleId,
      ruleName,
      triggerEvent,
      status,
      details,
      timestamp: new Date().toISOString()
    };
    this.data.executions.unshift(exec);

    // Update rule lastExecutedAt and counter
    const rIdx = this.data.automations.findIndex((a) => a.id === ruleId);
    if (rIdx !== -1) {
      this.data.automations[rIdx].lastExecutedAt = exec.timestamp;
      this.data.automations[rIdx].executionCount = (this.data.automations[rIdx].executionCount || 0) + 1;
    }

    // Keep max 100 executions
    if (this.data.executions.length > 100) {
      this.data.executions.pop();
    }
    this.save();
    return exec;
  }

  // Reports
  public getReports(): ClinicReport[] {
    return this.data.reports;
  }

  public addReport(report: ClinicReport): ClinicReport {
    this.data.reports.unshift(report);
    this.logAudit('Generate Report', 'Setting', report.id, 'admin', `Generated ${report.title}`);
    this.save();
    return report;
  }

  // Audit Logs
  public getAuditLogs(): AuditLog[] {
    return this.data.auditLogs;
  }

  public logAudit(
    action: string,
    entityType: AuditLog['entityType'],
    entityId: string,
    userRole: AuditLog['userRole'],
    details: string
  ) {
    const log: AuditLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      action,
      entityType,
      entityId,
      userRole,
      details,
      timestamp: new Date().toISOString()
    };
    this.data.auditLogs.unshift(log);
    if (this.data.auditLogs.length > 150) {
      this.data.auditLogs.pop();
    }
  }
}

export const db = new Database();
