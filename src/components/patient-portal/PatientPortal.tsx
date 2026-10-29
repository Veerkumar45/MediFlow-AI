import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  User,
  Stethoscope,
  ShieldCheck,
  CheckCircle2,
  Search,
  ArrowRight,
  Bot,
  MapPin,
  Phone,
  AlertCircle,
  HelpCircle,
  XCircle,
  Sparkles,
  Loader2
} from 'lucide-react';
import { Doctor, HealthcareService, ClinicProfile, Appointment } from '../../types/index.ts';
import { api } from '../../services/api.ts';
import { useToast } from '../common/Toast.tsx';
import { OPEN_ASSISTANT_EVENT } from '../receptionist/FloatingChatWidget.tsx';

interface PatientPortalProps {
  clinic: ClinicProfile;
  doctors: Doctor[];
  services: HealthcareService[];
  existingAppointments?: Appointment[];
  onBackToAdmin?: () => void;
  onAppointmentBooked?: () => void;
}

export const PatientPortal: React.FC<PatientPortalProps> = ({
  clinic,
  doctors,
  services,
  existingAppointments = [],
  onBackToAdmin,
  onAppointmentBooked
}) => {
  const { showToast } = useToast();

  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);

  // Booking Flow State
  const [selectedServiceId, setSelectedServiceId] = useState(services[0]?.id || '');
  const [selectedDoctorId, setSelectedDoctorId] = useState('any');
  // "Today" is always the clinic's own calendar day, not the browser's.
  const clinicTz = (clinic.timeZone.match(/[A-Za-z]+\/[A-Za-z_]+/) || ['America/Chicago'])[0];
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: clinicTz });
  const [bookingDate, setBookingDate] = useState(() => {
    const [y, m, d] = todayStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  });
  const [openSlots, setOpenSlots] = useState<Array<{ time: string; doctorId: string; doctorName: string; specialty: string }>>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ time: string; doctorId: string } | null>(null);
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<Appointment | null>(null);

  // Booking Reference Lookup state
  const [lookupRef, setLookupRef] = useState('');
  const [lookupPhone, setLookupPhone] = useState('');
  const [lookupResult, setLookupResult] = useState<Appointment | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);

  const selectedService = services.find((s) => s.id === selectedServiceId);
  const targetDoctor = selectedSlot
    ? doctors.find((d) => d.id === selectedSlot.doctorId)
    : selectedDoctorId === 'any'
      ? undefined
      : doctors.find((d) => d.id === selectedDoctorId);

  // Real availability from the server: doctor schedules, breaks, clinic hours and existing bookings.
  useEffect(() => {
    if (!bookingDate || !selectedServiceId) return;
    let cancelled = false;
    setSlotsLoading(true);
    api
      .getAvailability(bookingDate, selectedDoctorId, selectedServiceId)
      .then((r) => {
        if (cancelled) return;
        setOpenSlots(r.slots);
        setSelectedSlot((cur) => (cur && r.slots.some((x) => x.time === cur.time && x.doctorId === cur.doctorId) ? cur : null));
      })
      .catch(() => !cancelled && setOpenSlots([]))
      .finally(() => !cancelled && setSlotsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [bookingDate, selectedDoctorId, selectedServiceId, existingAppointments]);

  // Handle Booking Submission
  const handleConfirmBooking = async () => {
    if (!patientName.trim() || !patientPhone.trim()) {
      showToast('Please provide your name and phone number.', 'error');
      return;
    }

    if (!targetDoctor || !selectedService || !selectedSlot) {
      showToast('Please choose a service and an available time slot.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const appt = await api.createAppointment({
        patientName,
        patientPhone,
        patientEmail,
        doctorId: targetDoctor.id,
        doctorName: targetDoctor.name,
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        date: bookingDate,
        startTime: selectedSlot.time,
        durationMinutes: selectedService.durationMinutes,
        status: 'Pending', // Submitted requests start as Pending awaiting clinic confirmation
        notes
      });

      setConfirmedBooking(appt);
      setSelectedSlot(null);
      setActiveStep(4);
      showToast(`Appointment request ${appt.bookingReference} submitted!`, 'success');
      onAppointmentBooked?.();
    } catch (err: any) {
      showToast(err.message || 'Scheduling conflict detected. Please select another time slot.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Lookup existing booking
  const handleLookupBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupRef.trim() || lookupPhone.replace(/\D/g, '').length < 4) {
      setLookupResult(null);
      setLookupError('Enter your booking reference and the phone number used for the booking.');
      return;
    }

    setIsLookingUp(true);
    setLookupError(null);
    setLookupResult(null);

    try {
      const all = await api.getAppointments();
      const found = all.find(
        (a) =>
          a.bookingReference.toLowerCase() === lookupRef.trim().toLowerCase() &&
          a.patientPhone.replace(/\D/g, '').endsWith(lookupPhone.replace(/\D/g, ''))
      );

      if (found) {
        setLookupResult(found);
      } else {
        setLookupError('No matching appointment found with this reference and phone number.');
      }
    } catch {
      setLookupError('Could not verify appointment details.');
    } finally {
      setIsLookingUp(false);
    }
  };

  // Cancel via lookup
  const handleCancelMyBooking = async () => {
    if (!lookupResult) return;
    try {
      const updated = await api.updateAppointment(lookupResult.id, {
        status: 'Cancelled',
        cancellationReason: 'Cancelled by patient through portal'
      });
      setLookupResult(updated);
      showToast('Your appointment has been cancelled.', 'success');
      onAppointmentBooked?.();
    } catch (err: any) {
      showToast(err.message || 'Cancellation failed', 'error');
    }
  };

  return (
    <div className="space-y-10 pb-16">
      {/* Clinic Hero Banner */}
      <div className="bg-[#142D4E] text-white rounded-3xl p-8 md:p-12 shadow-lg relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-widest text-teal-400">
            Welcome to {clinic.name}
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-2 text-white">
            Care centered around you.
          </h1>
          <p className="mt-3 text-sm text-slate-300 leading-relaxed">
            {clinic.tagline}. Book primary consultations, pediatric checkups, cardiovascular care, and dermatology evaluations with automated real-time slot verification.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-slate-300">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-teal-400" />
              <span>{clinic.address}</span>
            </span>
            <span className="flex items-center gap-1.5 font-mono">
              <Phone className="w-4 h-4 text-teal-400" />
              <span>{clinic.phone}</span>
            </span>
          </div>
        </div>

        {onBackToAdmin && (
          <div className="absolute top-6 right-6 z-20">
            <button
              onClick={onBackToAdmin}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-lg transition-colors"
            >
              ← Back to Admin Console
            </button>
          </div>
        )}
      </div>

      {/* AI assistant call-to-action (lives in the patient portal) */}
      <div className="bg-gradient-to-r from-teal-50 to-white border border-teal-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Book faster with the MediFlow AI assistant</h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Ask for open times in plain language, for example "dermatology appointment tomorrow morning". The assistant checks the live calendar and prepares the booking for your confirmation.
            </p>
          </div>
        </div>
        <button
          onClick={() => window.dispatchEvent(new Event(OPEN_ASSISTANT_EVENT))}
          className="px-4 py-2.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-xs flex items-center gap-2 shrink-0"
          data-testid="banner-open-assistant"
        >
          <Bot className="w-4 h-4" />
          Chat with the assistant
        </button>
      </div>

      {/* Main Grid: Booking Flow & Lookup Tracker */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Booking Experience (2 columns) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs">
          {/* Step Progress Indicators */}
          <div className="flex items-center justify-between pb-6 border-b border-slate-100 mb-6">
            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${activeStep >= 1 ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-500'}`}>1</span>
              <span className="text-xs font-semibold text-slate-800">Service</span>
            </div>
            <div className="h-0.5 w-8 bg-slate-200" />
            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${activeStep >= 2 ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-500'}`}>2</span>
              <span className="text-xs font-semibold text-slate-800">Doctor & Time</span>
            </div>
            <div className="h-0.5 w-8 bg-slate-200" />
            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${activeStep >= 3 ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-500'}`}>3</span>
              <span className="text-xs font-semibold text-slate-800">Your Info</span>
            </div>
          </div>

          {/* STEP 1: Select Healthcare Service */}
          {activeStep === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Select Healthcare Service</h2>
                <p className="text-xs text-slate-500">Choose the medical consultation you would like to book</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                {services.map((srv) => (
                  <div
                    key={srv.id}
                    onClick={() => setSelectedServiceId(srv.id)}
                    className={`p-4 rounded-xl border text-xs cursor-pointer transition-all ${
                      selectedServiceId === srv.id
                        ? 'border-teal-600 bg-teal-50/50 shadow-xs ring-1 ring-teal-600'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="font-bold text-slate-900 text-sm">{srv.name}</span>
                      <span className="font-bold text-teal-700 font-mono">${srv.consultationFee}</span>
                    </div>
                    <p className="text-slate-500 mt-1 line-clamp-2">{srv.description}</p>
                    <div className="mt-2 text-[11px] text-slate-400 font-mono">{srv.durationMinutes} mins · {srv.category}</div>
                  </div>
                ))}
              </div>

              <div className="pt-6 flex justify-end">
                <button
                  onClick={() => setActiveStep(2)}
                  className="px-6 py-2.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors flex items-center gap-2 shadow-xs"
                >
                  <span>Select Provider & Time</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Doctor, Date, Time Slot */}
          {activeStep === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Choose Doctor & Available Slot</h2>
                <p className="text-xs text-slate-500">Service: {selectedService?.name} (${selectedService?.consultationFee})</p>
              </div>

              {/* Doctor picker */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">Preferred Doctor</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setSelectedDoctorId('any')}
                    className={`p-3 rounded-xl border cursor-pointer text-xs ${
                      selectedDoctorId === 'any' ? 'border-teal-600 bg-teal-50/50 font-semibold text-teal-900' : 'border-slate-200'
                    }`}
                  >
                    Any Available Specialist
                  </div>
                  {doctors
                    .filter((d) => d.servicesOffered.includes(selectedServiceId))
                    .map((doc) => (
                      <div
                        key={doc.id}
                        onClick={() => setSelectedDoctorId(doc.id)}
                        className={`p-3 rounded-xl border cursor-pointer text-xs ${
                          selectedDoctorId === doc.id ? 'border-teal-600 bg-teal-50/50 font-semibold text-teal-900' : 'border-slate-200'
                        }`}
                      >
                        <div>{doc.name}</div>
                        <div className="text-[11px] text-slate-500 font-normal">{doc.specialty}</div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Date picker */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Appointment Date</label>
                <input
                  type="date"
                  value={bookingDate}
                  min={todayStr}
                  onChange={(e) => setBookingDate(e.target.value)}
                  className="w-full sm:w-64 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600 font-mono"
                />
              </div>

              {/* Time Slots (live from the clinic calendar) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-slate-700">Available Time Slots</label>
                  <span className="text-[11px] text-slate-400">Only open, conflict-free times are shown</span>
                </div>
                {slotsLoading ? (
                  <div className="flex items-center gap-2 text-xs text-slate-400 py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-teal-600" /> Checking the clinic calendar...
                  </div>
                ) : openSlots.length === 0 ? (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-800">
                    No open slots on this date for the selected service. Try another day (the clinic is closed on Sundays) or ask the AI assistant.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {openSlots.map((slot) => {
                      const active = selectedSlot?.time === slot.time && selectedSlot?.doctorId === slot.doctorId;
                      return (
                        <button
                          key={`${slot.doctorId}-${slot.time}`}
                          type="button"
                          onClick={() => setSelectedSlot({ time: slot.time, doctorId: slot.doctorId })}
                          className={`py-2 px-3 text-xs rounded-lg border transition-all text-left ${
                            active
                              ? 'bg-teal-600 border-teal-600 text-white shadow-xs'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span className="font-mono font-bold">{slot.time}</span>
                          <span className={`block text-[10px] ${active ? 'text-teal-100' : 'text-slate-400'}`}>{slot.doctorName}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-6 flex items-center justify-between border-t border-slate-100">
                <button
                  onClick={() => setActiveStep(1)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setActiveStep(3)}
                  disabled={!selectedSlot}
                  className="px-6 py-2.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 shadow-xs"
                >
                  <span>Enter Patient Details</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Contact Details & Review */}
          {activeStep === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Your Contact Information</h2>
                <p className="text-xs text-slate-500">Provide your contact info for SMS and email appointment updates</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Your Full Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Jessica Williams"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Phone (for SMS updates) *</label>
                  <input
                    type="tel"
                    placeholder="+1 (217) 555-0188"
                    value={patientPhone}
                    onChange={(e) => setPatientPhone(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="jessica.williams@example.com"
                  value={patientEmail}
                  onChange={(e) => setPatientEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for Visit / Symptoms (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Brief explanation of visit purpose"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600"
                />
              </div>

              {/* Review card */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div className="font-bold text-slate-900 text-sm">Booking Summary:</div>
                <div className="text-slate-700"><strong>Service:</strong> {selectedService?.name} (${selectedService?.consultationFee})</div>
                <div className="text-slate-700"><strong>Doctor:</strong> {targetDoctor?.name} ({targetDoctor?.specialty})</div>
                <div className="text-slate-700"><strong>Time:</strong> {bookingDate} at {selectedSlot?.time} ({selectedService?.durationMinutes} mins)</div>
              </div>

              <div className="pt-6 flex items-center justify-between border-t border-slate-100">
                <button
                  onClick={() => setActiveStep(2)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  ← Back
                </button>
                <button
                  onClick={handleConfirmBooking}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 rounded-lg transition-colors flex items-center gap-2 shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSubmitting ? 'Confirming with Doctor Roster...' : 'Submit Appointment Request'}</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Success Confirmation */}
          {activeStep === 4 && confirmedBooking && (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2.5 py-1 rounded">
                  Request Confirmed
                </span>
                <h2 className="text-2xl font-extrabold text-slate-900 mt-2">
                  Booking Reference: {confirmedBooking.bookingReference}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Keep this booking code to check appointment status or request rescheduling.
                </p>
              </div>

              <div className="max-w-md mx-auto p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-left space-y-2">
                <div><strong>Patient:</strong> {confirmedBooking.patientName} ({confirmedBooking.patientPhone})</div>
                <div><strong>Doctor:</strong> {confirmedBooking.doctorName}</div>
                <div><strong>Service:</strong> {confirmedBooking.serviceName}</div>
                <div><strong>Scheduled:</strong> {confirmedBooking.date} at {confirmedBooking.startTime}</div>
                <div><strong>Status:</strong> <span className="text-amber-700 font-semibold">Pending Staff Confirmation</span></div>
              </div>

              <div className="pt-4 flex justify-center gap-3">
                <button
                  onClick={() => {
                    setActiveStep(1);
                    setConfirmedBooking(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Book Another Visit
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Track Appointment by Reference */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Search className="w-4 h-4 text-teal-600" />
              <h2 className="text-base font-bold text-slate-900">Track My Appointment</h2>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Enter your booking reference (e.g. MF-10012) to check your visit status or request cancellation.
            </p>

            <form onSubmit={handleLookupBooking} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Booking Reference</label>
                <input
                  type="text"
                  placeholder="MF-10012"
                  value={lookupRef}
                  onChange={(e) => setLookupRef(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600 font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number (Optional Verification)</label>
                <input
                  type="tel"
                  placeholder="Phone used during booking"
                  value={lookupPhone}
                  onChange={(e) => setLookupPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600 font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={isLookingUp}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition-colors shadow-xs"
              >
                {isLookingUp ? 'Searching...' : 'Find My Appointment'}
              </button>
            </form>

            {lookupError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
                {lookupError}
              </div>
            )}

            {lookupResult && (
              <div className="mt-4 p-4 bg-teal-50/60 border border-teal-200 rounded-xl text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-teal-800">{lookupResult.bookingReference}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      lookupResult.status === 'Confirmed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : lookupResult.status === 'Pending'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-200 text-slate-800'
                    }`}
                  >
                    {lookupResult.status}
                  </span>
                </div>
                <div><strong>Doctor:</strong> {lookupResult.doctorName}</div>
                <div><strong>Service:</strong> {lookupResult.serviceName}</div>
                <div><strong>Time:</strong> {lookupResult.date} at {lookupResult.startTime}</div>

                {lookupResult.status !== 'Cancelled' && (
                  <div className="pt-2 border-t border-teal-200/60 flex justify-end">
                    <button
                      onClick={handleCancelMyBooking}
                      className="text-xs text-red-600 hover:text-red-700 font-medium"
                    >
                      Cancel Appointment
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-400">
            For urgent clinic questions, contact our front desk directly at {clinic.phone}.
          </div>
        </div>
      </div>
    </div>
  );
};
