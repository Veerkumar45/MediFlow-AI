import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, User, Stethoscope, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Doctor, HealthcareService, Patient, Appointment } from '../../types/index.ts';
import { api } from '../../services/api.ts';
import { useToast } from '../common/Toast.tsx';

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  doctors: Doctor[];
  services: HealthcareService[];
  patients: Patient[];
  appointmentToEdit?: Appointment | null;
}

export const AppointmentModal: React.FC<AppointmentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  doctors,
  services,
  patients,
  appointmentToEdit
}) => {
  const { showToast } = useToast();

  const [patientId, setPatientId] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<Appointment['status']>('Confirmed');

  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [checkingConflict, setCheckingConflict] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (appointmentToEdit) {
      setPatientId(appointmentToEdit.patientId);
      setPatientName(appointmentToEdit.patientName);
      setPatientPhone(appointmentToEdit.patientPhone);
      setPatientEmail(appointmentToEdit.patientEmail);
      setDoctorId(appointmentToEdit.doctorId);
      setServiceId(appointmentToEdit.serviceId);
      setDate(appointmentToEdit.date);
      setStartTime(appointmentToEdit.startTime);
      setNotes(appointmentToEdit.notes || '');
      setStatus(appointmentToEdit.status);
    } else {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      setDate(todayStr);
      setDoctorId(doctors[0]?.id || '');
      setServiceId(services[0]?.id || '');
      setStartTime('10:00');
      setPatientId(patients[0]?.id || '');
      setPatientName(patients[0]?.fullName || '');
      setPatientPhone(patients[0]?.phone || '');
      setPatientEmail(patients[0]?.email || '');
      setNotes('');
      setStatus('Confirmed');
    }
    setConflictWarning(null);
  }, [appointmentToEdit, isOpen, doctors, services, patients]);

  const handlePatientSelect = (pId: string) => {
    setPatientId(pId);
    if (pId === 'walk-in') {
      setPatientName('');
      setPatientPhone('');
      setPatientEmail('');
      return;
    }
    const found = patients.find((p) => p.id === pId);
    if (found) {
      setPatientName(found.fullName);
      setPatientPhone(found.phone);
      setPatientEmail(found.email);
    }
  };

  useEffect(() => {
    if (!doctorId || !date || !startTime || !serviceId) return;

    const srv = services.find((s) => s.id === serviceId);
    const duration = srv?.durationMinutes || 30;

    let isMounted = true;
    setCheckingConflict(true);

    api
      .checkSlotConflict({
        doctorId,
        date,
        startTime,
        durationMinutes: duration
      })
      .then((res) => {
        if (!isMounted) return;
        setCheckingConflict(false);
        if (res.hasConflict) {
          setConflictWarning(res.reason || 'Doctor has a scheduling conflict.');
        } else {
          setConflictWarning(null);
        }
      })
      .catch(() => {
        if (isMounted) setCheckingConflict(false);
      });

    return () => {
      isMounted = false;
    };
  }, [doctorId, date, startTime, serviceId, services]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!patientName.trim() || !patientPhone.trim()) {
      showToast('Please provide patient name and contact phone.', 'error');
      return;
    }

    if (!doctorId || !serviceId || !date || !startTime) {
      showToast('Please complete all appointment scheduling fields.', 'error');
      return;
    }

    const doc = doctors.find((d) => d.id === doctorId);
    const srv = services.find((s) => s.id === serviceId);

    setIsSubmitting(true);
    try {
      if (appointmentToEdit) {
        await api.updateAppointment(appointmentToEdit.id, {
          patientName,
          patientPhone,
          patientEmail,
          doctorId,
          doctorName: doc?.name || '',
          serviceId,
          serviceName: srv?.name || '',
          date,
          startTime,
          durationMinutes: srv?.durationMinutes || 30,
          status,
          notes
        });
        showToast(`Appointment ${appointmentToEdit.bookingReference} successfully updated.`, 'success');
      } else {
        await api.createAppointment({
          patientId: patientId || undefined,
          patientName,
          patientPhone,
          patientEmail,
          doctorId,
          doctorName: doc?.name || '',
          serviceId,
          serviceName: srv?.name || '',
          date,
          startTime,
          durationMinutes: srv?.durationMinutes || 30,
          status,
          notes
        });
        showToast('New appointment booked successfully!', 'success');
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to save appointment. Please check for scheduling conflicts.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {appointmentToEdit ? `Edit Appointment (${appointmentToEdit.bookingReference})` : 'Schedule New Appointment'}
            </h3>
            <p className="text-xs text-slate-500">
              Validated against clinic hours, doctor availability, and calendar conflict detection.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">Patient</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                value={patientId}
                onChange={(e) => handlePatientSelect(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600"
              >
                <option value="walk-in">+ New / Walk-in Patient</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName} ({p.phone})
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Patient Full Name *"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number *</label>
              <input
                type="tel"
                placeholder="+1 (217) 555-0100"
                value={patientPhone}
                onChange={(e) => setPatientPhone(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                placeholder="patient@example.com"
                value={patientEmail}
                onChange={(e) => setPatientEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Doctor *</label>
              <select
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600"
              >
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.specialty})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Healthcare Service *</label>
              <select
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600"
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.durationMinutes} min · ${s.consultationFee})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Appointment Date *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Time Slot *</label>
              <select
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600 font-mono"
              >
                <option value="09:00">09:00 AM</option>
                <option value="09:30">09:30 AM</option>
                <option value="10:00">10:00 AM</option>
                <option value="10:30">10:30 AM</option>
                <option value="11:00">11:00 AM</option>
                <option value="11:30">11:30 AM</option>
                <option value="14:00">02:00 PM</option>
                <option value="14:30">02:30 PM</option>
                <option value="15:00">03:00 PM</option>
                <option value="15:30">03:30 PM</option>
                <option value="16:00">04:00 PM</option>
                <option value="16:30">04:30 PM</option>
              </select>
            </div>
          </div>

          {conflictWarning ? (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Scheduling Conflict Detected:</span> {conflictWarning}
              </div>
            </div>
          ) : !checkingConflict && doctorId && date && startTime ? (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Selected slot is open and verified conflict-free.</span>
            </div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600"
              >
                <option value="Confirmed">Confirmed</option>
                <option value="Pending">Pending</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
                <option value="No-show">No-show</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Administrative Notes</label>
              <input
                type="text"
                placeholder="Optional notes or patient requests"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600"
              />
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || Boolean(conflictWarning && !appointmentToEdit)}
              className="px-5 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors shadow-xs"
            >
              {isSubmitting ? 'Saving...' : appointmentToEdit ? 'Save Changes' : 'Confirm & Book Slot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
