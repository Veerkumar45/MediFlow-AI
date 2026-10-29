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
  AuditLog,
  ChatApiResponse
} from '../types/index.ts';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    }
  });

  if (!res.ok) {
    let errorMsg = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data.error) errorMsg = data.error;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return res.json();
}

export const api = {
  // Clinic
  getClinic: () => request<ClinicProfile>('/api/clinic'),
  updateClinic: (data: Partial<ClinicProfile>) =>
    request<ClinicProfile>('/api/clinic', {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  // Doctors
  getDoctors: () => request<Doctor[]>('/api/doctors'),
  createDoctor: (data: Omit<Doctor, 'id'>) =>
    request<Doctor>('/api/doctors', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateDoctor: (id: string, data: Partial<Doctor>) =>
    request<Doctor>(`/api/doctors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  deleteDoctor: (id: string) =>
    request<{ success: boolean }>(`/api/doctors/${id}`, {
      method: 'DELETE'
    }),

  // Services
  getServices: () => request<HealthcareService[]>('/api/services'),
  createService: (data: Omit<HealthcareService, 'id'>) =>
    request<HealthcareService>('/api/services', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateService: (id: string, data: Partial<HealthcareService>) =>
    request<HealthcareService>(`/api/services/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  deleteService: (id: string) =>
    request<{ success: boolean }>(`/api/services/${id}`, {
      method: 'DELETE'
    }),

  // Patients
  getPatients: () => request<Patient[]>('/api/patients'),
  createPatient: (data: Omit<Patient, 'id' | 'createdAt'>) =>
    request<{ patient: Patient; possibleDuplicate: string | null }>('/api/patients', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updatePatient: (id: string, data: Partial<Patient>) =>
    request<Patient>(`/api/patients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  deletePatient: (id: string) =>
    request<{ success: boolean }>(`/api/patients/${id}`, {
      method: 'DELETE'
    }),

  // Appointments
  getAppointments: () => request<Appointment[]>('/api/appointments'),
  checkSlotConflict: (data: { doctorId: string; date: string; startTime: string; durationMinutes: number }) =>
    request<{ hasConflict: boolean; reason?: string }>('/api/appointments/check-slot', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  createAppointment: (data: Omit<Appointment, 'id' | 'bookingReference' | 'createdAt' | 'updatedAt' | 'endTime' | 'patientId'> & { patientId?: string }) =>
    request<Appointment>('/api/appointments', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateAppointment: (id: string, data: Partial<Appointment>) =>
    request<Appointment>(`/api/appointments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  deleteAppointment: (id: string) =>
    request<{ success: boolean }>(`/api/appointments/${id}`, {
      method: 'DELETE'
    }),

  // Inquiries
  getInquiries: () => request<Inquiry[]>('/api/inquiries'),
  createInquiry: (data: { patientName: string; patientContact?: string; message: string }) =>
    request<Inquiry>('/api/inquiries', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateInquiry: (id: string, data: Partial<Inquiry>) =>
    request<Inquiry>(`/api/inquiries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  // Automations
  getAutomations: () => request<AutomationRule[]>('/api/automations'),
  updateAutomation: (id: string, data: Partial<AutomationRule>) =>
    request<AutomationRule>(`/api/automations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  getExecutions: () => request<AutomationExecution[]>('/api/automations/executions'),
  runAutomation: (id: string) =>
    request<AutomationExecution>(`/api/automations/${id}/run`, {
      method: 'POST'
    }),

  // Analytics
  getAnalytics: () =>
    request<{
      totalAppointments: number;
      completedVisits: number;
      cancellations: number;
      noShows: number;
      pendingRequests: number;
      confirmed: number;
      completionRate: number;
      cancellationRate: number;
      noShowRate: number;
      mostRequestedServices: Array<{ name: string; count: number }>;
      doctorDistribution: Array<{ name: string; count: number }>;
      inquiryCategoryBreakdown: Array<{ category: string; count: number }>;
      totalInquiries: number;
      aiHandledInquiries: number;
      aiResolutionRate: number;
      weeklyTrends: Array<{ date: string; total: number; confirmed: number; completed: number; cancelled: number }>;
    }>('/api/analytics'),

  generateInsights: () =>
    request<{ insights: string[] }>('/api/analytics/insights', {
      method: 'POST'
    }),

  // Reports
  getReports: () => request<ClinicReport[]>('/api/reports'),
  generateReport: (data: { reportType: string; startDate: string; endDate: string }) =>
    request<ClinicReport>('/api/reports/generate', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  // Gemini AI Receptionist Chat
  chatWithReceptionist: (messages: Array<{ role: 'user' | 'assistant'; content: string }>, patientContext?: any) =>
    request<ChatApiResponse>('/api/gemini/chat', {
      method: 'POST',
      body: JSON.stringify({ messages, patientContext })
    }),

  draftFollowup: (patientName: string, doctorName: string, date: string) =>
    request<{ message: string }>('/api/gemini/draft-followup', {
      method: 'POST',
      body: JSON.stringify({ patientName, doctorName, date })
    }),

  // Audit logs & data reset
  getAuditLogs: () => request<AuditLog[]>('/api/audit-logs'),
  getAvailability: (date: string, doctorId?: string, serviceId?: string) =>
    request<{ date: string; slots: Array<{ time: string; doctorId: string; doctorName: string; specialty: string }> }>(
      `/api/availability?date=${encodeURIComponent(date)}${doctorId && doctorId !== 'any' ? `&doctorId=${encodeURIComponent(doctorId)}` : ''}${serviceId ? `&serviceId=${encodeURIComponent(serviceId)}` : ''}`
    ),

  getAiStatus: () =>
    request<{ configured: boolean; model: string | null; lastEngine: 'gemini' | 'offline'; lastError: string | null }>('/api/ai/status'),

  resetData: () =>
    request<{ success: boolean; message: string }>('/api/reset-data', {
      method: 'POST'
    })
};
