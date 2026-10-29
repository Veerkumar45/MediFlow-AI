export type UserRole = 'admin' | 'receptionist' | 'patient';

export type AppointmentStatus = 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled' | 'No-show';

export type InquiryCategory = 
  | 'Appointment'
  | 'Clinic Information'
  | 'Billing'
  | 'Service Inquiry'
  | 'General Question'
  | 'Human Assistance Required';

export type InquiryPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Doctor {
  id: string;
  name: string;
  title: string;
  specialty: string;
  avatar?: string;
  email: string;
  phone: string;
  workingDays: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  workHours: { start: string; end: string }; // e.g. "09:00", "17:00"
  breakHours?: { start: string; end: string }; // e.g. "13:00", "14:00"
  servicesOffered: string[]; // service IDs
  roomNumber: string;
}

export interface HealthcareService {
  id: string;
  name: string;
  category: string;
  description: string;
  durationMinutes: number;
  consultationFee: number;
  isActive: boolean;
}

export interface Patient {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth?: string;
  gender?: string;
  emergencyContact?: string;
  administrativeNotes?: string;
  createdAt: string;
}

export interface Appointment {
  id: string;
  bookingReference: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  patientEmail: string;
  doctorId: string;
  doctorName: string;
  serviceId: string;
  serviceName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  durationMinutes: number;
  status: AppointmentStatus;
  notes?: string;
  cancellationReason?: string;
  reminderSent?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Inquiry {
  id: string;
  patientName: string;
  patientContact: string;
  message: string;
  category: InquiryCategory;
  priority: InquiryPriority;
  status: 'New' | 'In Progress' | 'Resolved' | 'Escalated';
  aiAssisted: boolean;
  aiSuggestedResponse?: string;
  assignedTo?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  trigger: string;
  enabled: boolean;
  lastExecutedAt?: string;
  executionCount: number;
  actions: string[];
}

export interface AutomationExecution {
  id: string;
  ruleId: string;
  ruleName: string;
  triggerEvent: string;
  status: 'Success' | 'Failed' | 'Warning';
  details: string;
  timestamp: string;
}

export interface ClinicReport {
  id: string;
  title: string;
  reportType: 'Daily Clinic Summary' | 'Weekly Appointment Report' | 'Monthly Operations Report' | 'Inquiry Analysis Report' | 'Automation Performance Report';
  startDate: string;
  endDate: string;
  generatedAt: string;
  summary: string;
  metrics: Record<string, string | number>;
  operationalTrends: string[];
  keyObservations: string[];
  recommendations: string[];
  pendingActions: string[];
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: 'Appointment' | 'Patient' | 'Setting' | 'Automation' | 'Inquiry';
  entityId: string;
  userRole: UserRole;
  details: string;
  timestamp: string;
}

export interface ClinicProfile {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  timeZone: string;
  openingHours: {
    weekdays: { start: string; end: string };
    saturday: { start: string; end: string };
    sunday: { closed: boolean; start?: string; end?: string };
  };
  bookingPolicies: {
    advanceBookingDays: number;
    cancellationWindowHours: number;
    autoConfirmRequests: boolean;
    requirePhoneVerification: boolean;
  };
  aiReceptionist: {
    welcomeMessage: string;
    escalationThreshold: string;
    allowedTopics: string[];
    clinicBio: string;
  };
}

export interface AvailableSlot {
  time: string;
  available: boolean;
  doctorId: string;
  doctorName: string;
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

export interface ExecutedToolLog {
  tool: 'check_availability' | 'request_booking' | 'classify_inquiry' | 'escalate_to_staff';
  summary: string;
  timestamp: string;
  status: 'success' | 'warning' | 'error';
  details?: any;
}

export interface ChatApiResponse {
  reply: string;
  category?: InquiryCategory | string;
  actionRequired?: 'confirm_booking' | 'escalate_emergency' | 'none';
  pendingBooking?: PendingBookingProposal;
  executedTools?: ExecutedToolLog[];
  engine?: 'gemini' | 'offline';
}

export type PortalType = 'portal-select' | 'user' | 'receptionist' | 'admin';
