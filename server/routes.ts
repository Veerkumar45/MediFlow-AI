import express from 'express';
import { db, clinicNow, addDaysToDate } from './db.ts';
import {
  chatWithReceptionist,
  classifyInquiryWithGemini,
  generateOperationalInsights,
  generateReportWithGemini,
  draftMissedAppointmentFollowup,
  getAiStatus,
  type ReportFacts
} from './gemini.ts';

export const apiRouter = express.Router();

// Middleware to parse json
apiRouter.use(express.json());

// Express 4 does not catch rejected promises: wrap async handlers so errors become JSON 500s.
const wrap =
  (fn: (req: express.Request, res: express.Response) => Promise<any>): express.RequestHandler =>
  (req, res, next) => {
    fn(req, res).catch(next);
  };

const localToday = () => clinicNow(db.getClinic().timeZone).date;
const localDateOf = (iso: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: (db.getClinic().timeZone.match(/[A-Za-z]+\/[A-Za-z_]+/) || ['America/Chicago'])[0],
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)?.value;
  return `${g('year')}-${g('month')}-${g('day')}`;
};

const tally = <T,>(items: T[], key: (x: T) => string) =>
  items.reduce<Record<string, number>>((acc, x) => {
    const k = key(x);
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

/** Facts for a report period, built ONLY from the live database. */
function buildReportFacts(reportType: string, startDate: string, endDate: string): ReportFacts {
  const inRange = (d: string) => d >= startDate && d <= endDate;
  const appts = db.getAppointments().filter((a) => inRange(a.date));
  const inquiries = db.getInquiries().filter((i) => inRange(localDateOf(i.createdAt)));
  const runs = db.getExecutions().filter((e) => inRange(localDateOf(e.timestamp)));
  return {
    clinicName: db.getClinic().name,
    reportType,
    startDate,
    endDate,
    appointments: {
      total: appts.length,
      byStatus: tally(appts, (a) => a.status),
      byDoctor: tally(appts, (a) => a.doctorName),
      byService: tally(appts, (a) => a.serviceName),
      pendingApproval: appts.filter((a) => a.status === 'Pending').length,
      bookedViaAssistantOrPortal: appts.filter((a) => /ai assistant|portal|receptionist/i.test(a.notes || '')).length,
      bookingsMadeInPeriod: db.getAppointments().filter((a) => inRange(localDateOf(a.createdAt))).length
    },
    inquiries: {
      total: inquiries.length,
      byCategory: tally(inquiries, (i) => i.category),
      byPriority: tally(inquiries, (i) => i.priority),
      escalated: inquiries.filter((i) => i.status === 'Escalated').length,
      stillOpen: inquiries.filter((i) => i.status === 'New' || i.status === 'In Progress' || i.status === 'Escalated').length
    },
    automations: { runs: runs.length, byRule: tally(runs, (e) => e.ruleName) },
    newPatients: db.getPatients().filter((p) => inRange(localDateOf(p.createdAt))).length
  };
}

const metricsFromFacts = (f: ReportFacts): Record<string, string | number> => {
  const a = f.appointments;
  const done = a.byStatus['Completed'] || 0;
  return {
    'Scheduled Appointments': a.total,
    'Bookings Made In Period': a.bookingsMadeInPeriod,
    'Pending Approval': a.pendingApproval,
    'Completed Visits': done,
    Cancellations: a.byStatus['Cancelled'] || 0,
    'No-shows': a.byStatus['No-show'] || 0,
    'Completion Rate': a.total > 0 ? `${Math.round((done / a.total) * 100)}%` : 'n/a',
    'Patient Inquiries': f.inquiries.total,
    'Escalated Inquiries': f.inquiries.escalated,
    'Automation Runs': f.automations.runs,
    'New Patients': f.newPatients
  };
};

// --- HEALTH / AI STATUS ---
apiRouter.get('/ai/status', (_req, res) => {
  res.json(getAiStatus());
});

apiRouter.get('/availability', (req, res) => {
  const date = String(req.query.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'date=YYYY-MM-DD is required.' });
  const serviceId = req.query.serviceId ? String(req.query.serviceId) : undefined;
  const doctorId = req.query.doctorId && req.query.doctorId !== 'any' ? String(req.query.doctorId) : undefined;
  res.json({ date, slots: db.getAvailableSlots(date, { doctorId, serviceId }) });
});

// --- CLINIC PROFILE & SETTINGS ---
apiRouter.get('/clinic', (req, res) => {
  res.json(db.getClinic());
});

apiRouter.put('/clinic', (req, res) => {
  const updated = db.updateClinic(req.body);
  res.json(updated);
});

// --- DOCTORS ---
apiRouter.get('/doctors', (req, res) => {
  res.json(db.getDoctors());
});

apiRouter.post('/doctors', (req, res) => {
  const newDoc = {
    ...req.body,
    id: `doc-${Date.now()}`
  };
  const created = db.addDoctor(newDoc);
  res.status(201).json(created);
});

apiRouter.put('/doctors/:id', (req, res) => {
  const updated = db.updateDoctor(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Doctor not found' });
  res.json(updated);
});

apiRouter.delete('/doctors/:id', (req, res) => {
  const success = db.deleteDoctor(req.params.id);
  if (!success) return res.status(404).json({ error: 'Doctor not found' });
  res.json({ success: true });
});

// --- SERVICES ---
apiRouter.get('/services', (req, res) => {
  res.json(db.getServices());
});

apiRouter.post('/services', (req, res) => {
  const newSrv = {
    ...req.body,
    id: `srv-${Date.now()}`
  };
  const created = db.addService(newSrv);
  res.status(201).json(created);
});

apiRouter.put('/services/:id', (req, res) => {
  const updated = db.updateService(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Service not found' });
  res.json(updated);
});

apiRouter.delete('/services/:id', (req, res) => {
  const success = db.deleteService(req.params.id);
  if (!success) return res.status(404).json({ error: 'Service not found' });
  res.json({ success: true });
});

// --- PATIENTS ---
apiRouter.get('/patients', (req, res) => {
  res.json(db.getPatients());
});

apiRouter.post('/patients', (req, res) => {
  const { fullName, email, phone } = req.body;
  if (!fullName || !phone) {
    return res.status(400).json({ error: 'Full name and phone number are required.' });
  }

  // Duplicate detection check
  const existing = db.getPatients().find(
    p => (p.phone || '').replace(/\D/g, '') === String(phone).replace(/\D/g, '') ||
         (email && p.email && p.email.toLowerCase() === email.toLowerCase())
  );

  const newPat = {
    id: `pat-${Date.now()}`,
    fullName,
    email: email || '',
    phone,
    dateOfBirth: req.body.dateOfBirth,
    gender: req.body.gender,
    emergencyContact: req.body.emergencyContact,
    administrativeNotes: req.body.administrativeNotes || '',
    createdAt: new Date().toISOString()
  };

  const created = db.addPatient(newPat);
  res.status(201).json({ patient: created, possibleDuplicate: existing ? existing.fullName : null });
});

apiRouter.put('/patients/:id', (req, res) => {
  const updated = db.updatePatient(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Patient not found' });
  res.json(updated);
});

apiRouter.delete('/patients/:id', (req, res) => {
  const success = db.deletePatient(req.params.id);
  if (!success) return res.status(404).json({ error: 'Patient not found' });
  res.json({ success: true });
});

// --- APPOINTMENTS ---
apiRouter.get('/appointments', (req, res) => {
  res.json(db.getAppointments());
});

apiRouter.post('/appointments/check-slot', (req, res) => {
  const { doctorId, date, startTime, durationMinutes } = req.body;
  if (!doctorId || !date || !startTime || !durationMinutes) {
    return res.status(400).json({ error: 'Missing required parameters for slot check.' });
  }
  const result = db.checkAppointmentConflict(doctorId, date, startTime, Number(durationMinutes));
  res.json(result);
});

apiRouter.post('/appointments', (req, res) => {
  const {
    patientId,
    patientName,
    patientPhone,
    patientEmail,
    doctorId,
    doctorName,
    serviceId,
    serviceName,
    date,
    startTime,
    durationMinutes,
    status = 'Pending',
    notes
  } = req.body;

  if (!doctorId || !serviceId || !date || !startTime || !patientName || !patientPhone) {
    return res.status(400).json({ error: 'Missing mandatory appointment booking details.' });
  }

  // Calculate endTime
  const [h, m] = startTime.split(':').map(Number);
  const endTotal = h * 60 + m + Number(durationMinutes || 30);
  const endH = Math.floor(endTotal / 60);
  const endM = endTotal % 60;
  const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

  if (String(patientPhone).replace(/\D/g, '').length < 7) {
    return res.status(400).json({ error: 'Please provide a valid phone number.' });
  }

  // Reuse the patient record (matched by phone/email) or create one, so portal and AI bookings
  // always show up in the Patient Directory without placeholder IDs.
  const patientRecord =
    (patientId && db.getPatient(patientId)) ||
    db.findOrCreatePatient({ fullName: patientName, phone: patientPhone, email: patientEmail });

  const result = db.addAppointment({
    patientId: patientRecord.id,
    patientName,
    patientPhone,
    patientEmail: patientEmail || '',
    doctorId,
    doctorName,
    serviceId,
    serviceName,
    date,
    startTime,
    endTime,
    durationMinutes: Number(durationMinutes || 30),
    status,
    notes,
    reminderSent: false
  });

  if (result.error) {
    return res.status(409).json({ error: result.error });
  }

  res.status(201).json(result.appointment);
});

apiRouter.put('/appointments/:id', (req, res) => {
  const result = db.updateAppointment(req.params.id, req.body);
  if (result.error) {
    return res.status(409).json({ error: result.error });
  }
  res.json(result.appointment);
});

apiRouter.delete('/appointments/:id', (req, res) => {
  const success = db.deleteAppointment(req.params.id);
  if (!success) return res.status(404).json({ error: 'Appointment not found' });
  res.json({ success: true });
});

// --- INQUIRIES ---
apiRouter.get('/inquiries', (req, res) => {
  res.json(db.getInquiries());
});

apiRouter.post('/inquiries', wrap(async (req, res) => {
  const { patientName, patientContact, message } = req.body;
  if (!patientName || !message) {
    return res.status(400).json({ error: 'Patient name and message are required.' });
  }

  // Run Gemini classifier / automation
  const classified = await classifyInquiryWithGemini(message);

  const newInq = db.addInquiry({
    patientName,
    patientContact: patientContact || '',
    message,
    category: classified.category as any,
    priority: classified.priority,
    status: classified.isEscalated ? 'Escalated' : 'New',
    aiAssisted: true,
    aiSuggestedResponse: classified.suggestedResponse,
    assignedTo: classified.isEscalated ? 'Clinical Nurse Triage' : 'Receptionist Desk'
  });

  // Record automation 3 execution
  db.recordExecution(
    'auto-3',
    'Inquiry Classification & Routing',
    `Inquiry from ${patientName}`,
    classified.isEscalated ? 'Warning' : 'Success',
    `Classified as "${classified.category}" (${classified.priority} priority). Response generated.`
  );

  res.status(201).json(newInq);
}));

apiRouter.put('/inquiries/:id', (req, res) => {
  const updated = db.updateInquiry(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Inquiry not found' });
  res.json(updated);
});

// --- AUTOMATIONS ---
apiRouter.get('/automations', (req, res) => {
  res.json(db.getAutomations());
});

apiRouter.put('/automations/:id', (req, res) => {
  const updated = db.updateAutomation(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Automation not found' });
  res.json(updated);
});

apiRouter.get('/automations/executions', (req, res) => {
  res.json(db.getExecutions());
});

apiRouter.post('/automations/:id/run', wrap(async (req, res) => {
  const { id } = req.params;
  const automations = db.getAutomations();
  const rule = automations.find(a => a.id === id);

  if (!rule) {
    return res.status(404).json({ error: 'Automation rule not found.' });
  }

  let details = '';
  let status: 'Success' | 'Failed' | 'Warning' = 'Success';

  if (id === 'auto-1') {
    // Confirm every conflict-free pending request; leave conflicting/past ones for staff.
    const pendings = db.getAppointments().filter((a) => a.status === 'Pending');
    let confirmedCount = 0;
    let needsReview = 0;
    for (const p of pendings) {
      const conflict = db.checkAppointmentConflict(p.doctorId, p.date, p.startTime, p.durationMinutes, p.id);
      if (!conflict.hasConflict) {
        db.updateAppointment(p.id, { status: 'Confirmed' });
        confirmedCount++;
      } else {
        needsReview++;
      }
    }
    if (needsReview > 0) status = 'Warning';
    details = pendings.length
      ? `Scanned ${pendings.length} pending request(s): auto-confirmed ${confirmedCount}, ${needsReview} need staff review.`
      : 'No pending appointment requests to process.';
  } else if (id === 'auto-2') {
    // Reminders for confirmed visits today/tomorrow (clinic local time)
    const today = localToday();
    const tomorrow = addDaysToDate(today, 1);
    const upcoming = db
      .getAppointments()
      .filter((a) => (a.date === today || a.date === tomorrow) && a.status === 'Confirmed' && !a.reminderSent);
    upcoming.forEach((a) => db.updateAppointment(a.id, { reminderSent: true }));
    details = upcoming.length
      ? `Queued pre-visit reminders for ${upcoming.length} patient(s) with visits on ${today} / ${tomorrow}.`
      : `No confirmed visits needing a reminder on ${today} / ${tomorrow}.`;
  } else if (id === 'auto-3') {
    // Inquiry classification & triage using Gemini
    const openInquiries = db.getInquiries().filter(i => i.status === 'New');
    let classifiedCount = 0;
    let escalatedCount = 0;
    for (const inq of openInquiries) {
      const result = await classifyInquiryWithGemini(inq.message);
      db.updateInquiry(inq.id, {
        category: result.category as any,
        priority: result.priority,
        status: result.isEscalated ? 'Escalated' : 'In Progress',
        aiSuggestedResponse: result.suggestedResponse,
        assignedTo: result.isEscalated ? 'Clinical Nurse Triage' : 'Receptionist Desk'
      });
      classifiedCount++;
      if (result.isEscalated) escalatedCount++;
    }
    details = openInquiries.length
      ? `Classified ${classifiedCount} new inquiry(ies); routed ${escalatedCount} high-priority one(s) to clinical triage.`
      : 'No new inquiries waiting for classification.';
  } else if (id === 'auto-4') {
    // Daily summary: Gemini report grounded in real database facts
    const today = localToday();
    const facts = buildReportFacts('Daily Clinic Summary', today, today);
    const aiContent = await generateReportWithGemini(facts);
    const rep = db.addReport({
      id: `rep-${Date.now()}`,
      title: `Daily Operations Briefing (${today})`,
      reportType: 'Daily Clinic Summary',
      startDate: today,
      endDate: today,
      generatedAt: new Date().toISOString(),
      summary: aiContent.summary,
      metrics: metricsFromFacts(facts),
      operationalTrends: aiContent.operationalTrends,
      keyObservations: aiContent.keyObservations,
      recommendations: aiContent.recommendations,
      pendingActions: aiContent.pendingActions
    });
    details = `Daily report for ${today} generated from live clinic data and saved to the Reports archive (${rep.id}).`;
  } else if (id === 'auto-5') {
    // Missed appointment follow-up with Gemini
    const noShows = db.getAppointments().filter(a => a.status === 'No-show');
    let draftsCount = 0;
    for (const appt of noShows) {
      await draftMissedAppointmentFollowup(appt.patientName, appt.doctorName, appt.date);
      draftsCount++;
    }
    details = noShows.length
      ? `Audited ${noShows.length} no-show visit(s); drafted ${draftsCount} rebooking message(s) for front-desk review.`
      : 'No no-show appointments need follow-up.';
  } else {
    details = `Executed manual run of ${rule.name}.`;
  }

  const execution = db.recordExecution(rule.id, rule.name, 'Manual Trigger ("Run Now")', status, details);
  res.json(execution);
}));

// --- ANALYTICS ---
apiRouter.get('/analytics', (req, res) => {
  const appointments = db.getAppointments();
  const inquiries = db.getInquiries();
  const doctors = db.getDoctors();
  const services = db.getServices();

  const totalAppointments = appointments.length;
  const completedVisits = appointments.filter(a => a.status === 'Completed').length;
  const cancellations = appointments.filter(a => a.status === 'Cancelled').length;
  const noShows = appointments.filter(a => a.status === 'No-show').length;
  const pendingRequests = appointments.filter(a => a.status === 'Pending').length;
  const confirmed = appointments.filter(a => a.status === 'Confirmed').length;

  const completionRate = totalAppointments > 0 ? Math.round((completedVisits / totalAppointments) * 100) : 0;
  const cancellationRate = totalAppointments > 0 ? Number(((cancellations / totalAppointments) * 100).toFixed(1)) : 0;
  const noShowRate = totalAppointments > 0 ? Number(((noShows / totalAppointments) * 100).toFixed(1)) : 0;

  // Service breakdown
  const serviceCounts: Record<string, number> = {};
  appointments.forEach(a => {
    serviceCounts[a.serviceName] = (serviceCounts[a.serviceName] || 0) + 1;
  });
  const mostRequestedServices = Object.entries(serviceCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Doctor breakdown
  const doctorCounts: Record<string, number> = {};
  appointments.forEach(a => {
    doctorCounts[a.doctorName] = (doctorCounts[a.doctorName] || 0) + 1;
  });
  const doctorDistribution = Object.entries(doctorCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Inquiry breakdown
  const inquiryCategories: Record<string, number> = {};
  inquiries.forEach(i => {
    inquiryCategories[i.category] = (inquiryCategories[i.category] || 0) + 1;
  });
  const inquiryCategoryBreakdown = Object.entries(inquiryCategories)
    .map(([category, count]) => ({ category, count }));

  const totalInquiries = inquiries.length;
  const aiHandledInquiries = inquiries.filter(i => i.aiAssisted).length;
  const aiResolutionRate = totalInquiries > 0 ? Math.round((aiHandledInquiries / totalInquiries) * 100) : 0;

  // Weekly trend by date
  const dateCounts: Record<string, { total: number; confirmed: number; completed: number; cancelled: number }> = {};
  appointments.forEach(a => {
    if (!dateCounts[a.date]) {
      dateCounts[a.date] = { total: 0, confirmed: 0, completed: 0, cancelled: 0 };
    }
    dateCounts[a.date].total += 1;
    if (a.status === 'Confirmed') dateCounts[a.date].confirmed += 1;
    if (a.status === 'Completed') dateCounts[a.date].completed += 1;
    if (a.status === 'Cancelled' || a.status === 'No-show') dateCounts[a.date].cancelled += 1;
  });

  const weeklyTrends = Object.entries(dateCounts)
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => a.date.localeCompare(b.date));

  res.json({
    totalAppointments,
    completedVisits,
    cancellations,
    noShows,
    pendingRequests,
    confirmed,
    completionRate,
    cancellationRate,
    noShowRate,
    mostRequestedServices,
    doctorDistribution,
    inquiryCategoryBreakdown,
    totalInquiries,
    aiHandledInquiries,
    aiResolutionRate,
    weeklyTrends
  });
});

apiRouter.post('/analytics/insights', wrap(async (req, res) => {
  const appointments = db.getAppointments();
  const inquiries = db.getInquiries();

  const totalAppointments = appointments.length;
  const completedVisits = appointments.filter(a => a.status === 'Completed').length;
  const cancellations = appointments.filter(a => a.status === 'Cancelled').length;
  const noShows = appointments.filter(a => a.status === 'No-show').length;
  const completionRate = totalAppointments > 0 ? Math.round((completedVisits / totalAppointments) * 100) : 0;
  const cancellationRate = totalAppointments > 0 ? Number(((cancellations / totalAppointments) * 100).toFixed(1)) : 0;

  // Top service
  const serviceCounts: Record<string, number> = {};
  appointments.forEach(a => {
    serviceCounts[a.serviceName] = (serviceCounts[a.serviceName] || 0) + 1;
  });
  const topService = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const totalInquiries = inquiries.length;
  const aiHandledInquiries = inquiries.filter(i => i.aiAssisted).length;

  const insights = await generateOperationalInsights({
    totalAppointments,
    completedVisits,
    cancellations,
    noShows,
    completionRate,
    cancellationRate,
    topService,
    totalInquiries,
    aiHandledInquiries
  });

  res.json({ insights });
}));

// --- REPORTS ---
apiRouter.get('/reports', (req, res) => {
  res.json(db.getReports());
});

apiRouter.post('/reports/generate', wrap(async (req, res) => {
  const { reportType, startDate, endDate } = req.body;
  if (!reportType || !startDate || !endDate) {
    return res.status(400).json({ error: 'Missing report parameters.' });
  }

  if (startDate > endDate) {
    return res.status(400).json({ error: 'Start date must be on or before the end date.' });
  }

  const facts = buildReportFacts(reportType, startDate, endDate);
  const aiContent = await generateReportWithGemini(facts);

  const newReport = db.addReport({
    id: `rep-${Date.now()}`,
    title: `${reportType} (${startDate === endDate ? startDate : `${startDate} to ${endDate}`})`,
    reportType: reportType as any,
    startDate,
    endDate,
    generatedAt: new Date().toISOString(),
    summary: aiContent.summary,
    metrics: metricsFromFacts(facts),
    operationalTrends: aiContent.operationalTrends,
    keyObservations: aiContent.keyObservations,
    recommendations: aiContent.recommendations,
    pendingActions: aiContent.pendingActions
  });

  res.status(201).json(newReport);
}));

// --- GEMINI AI RECEPTIONIST CHAT ---
apiRouter.post('/gemini/chat', wrap(async (req, res) => {
  const { messages, patientContext } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages array is required.' });
  }

  const response = await chatWithReceptionist(messages, patientContext);
  res.json(response);
}));

apiRouter.post('/gemini/draft-followup', wrap(async (req, res) => {
  const { patientName, doctorName, date } = req.body;
  const message = await draftMissedAppointmentFollowup(patientName || 'Patient', doctorName || 'Physician', date || 'recently');
  res.json({ message });
}));

// --- AUDIT LOGS & DEMO RESET ---
apiRouter.get('/audit-logs', (req, res) => {
  res.json(db.getAuditLogs());
});

const resetData = (_req: express.Request, res: express.Response) => {
  db.resetToClean();
  res.json({ success: true, message: 'All patient, appointment, inquiry, report and log data has been cleared.' });
};
apiRouter.post('/reset-data', resetData);
apiRouter.post('/reset-demo', resetData); // backwards-compatible alias

// JSON error handler (must be last)
apiRouter.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[MediFlow] API error:', err);
  res.status(500).json({ error: err?.message || 'Internal server error' });
});
