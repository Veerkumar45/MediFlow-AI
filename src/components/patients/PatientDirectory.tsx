import React, { useState } from 'react';
import {
  Users,
  Search,
  Plus,
  Mail,
  Phone,
  Calendar,
  Eye,
  Edit2,
  Trash2,
  AlertCircle,
  FileText,
  Clock,
  ShieldCheck,
  X
} from 'lucide-react';
import { Patient, Appointment } from '../../types/index.ts';
import { api } from '../../services/api.ts';
import { useToast } from '../common/Toast.tsx';
import { ConfirmDialog } from '../common/ConfirmDialog.tsx';

interface PatientDirectoryProps {
  patients: Patient[];
  appointments: Appointment[];
  onRefresh: () => void;
  onSelectAppointment?: (appt: Appointment) => void;
}

export const PatientDirectory: React.FC<PatientDirectoryProps> = ({
  patients,
  appointments,
  onRefresh,
  onSelectAppointment
}) => {
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientToDelete, setPatientToDelete] = useState<Patient | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Add/Edit Patient Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('Female');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter patients
  const filteredPatients = patients.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.fullName.toLowerCase().includes(q) ||
      p.phone.includes(q) ||
      p.email.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q)
    );
  });

  const openAddModal = () => {
    setEditingPatient(null);
    setFullName('');
    setEmail('');
    setPhone('');
    setDateOfBirth('1985-06-15');
    setGender('Female');
    setEmergencyContact('');
    setNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (p: Patient) => {
    setEditingPatient(p);
    setFullName(p.fullName);
    setEmail(p.email);
    setPhone(p.phone);
    setDateOfBirth(p.dateOfBirth || '');
    setGender(p.gender || 'Female');
    setEmergencyContact(p.emergencyContact || '');
    setNotes(p.administrativeNotes || '');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim()) {
      showToast('Patient full name and phone number are required.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingPatient) {
        await api.updatePatient(editingPatient.id, {
          fullName,
          email,
          phone,
          dateOfBirth,
          gender,
          emergencyContact,
          administrativeNotes: notes
        });
        showToast(`Patient ${fullName} updated successfully.`, 'success');
      } else {
        const res = await api.createPatient({
          fullName,
          email,
          phone,
          dateOfBirth,
          gender,
          emergencyContact,
          administrativeNotes: notes
        });
        if (res.possibleDuplicate) {
          showToast(`Patient added. Note: Possible duplicate contact detected matching "${res.possibleDuplicate}".`, 'info');
        } else {
          showToast(`Patient ${fullName} successfully registered.`, 'success');
        }
      }
      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to save patient', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePatient = async () => {
    if (!patientToDelete) return;
    setIsDeleting(true);
    try {
      await api.deletePatient(patientToDelete.id);
      showToast(`Patient ${patientToDelete.fullName} removed from active directory.`, 'success');
      if (selectedPatient?.id === patientToDelete.id) {
        setSelectedPatient(null);
      }
      setPatientToDelete(null);
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete patient', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Selected patient's appointment history
  const patientAppointments = selectedPatient
    ? appointments.filter(
        (a) =>
          a.patientId === selectedPatient.id ||
          a.patientName.toLowerCase() === selectedPatient.fullName.toLowerCase() ||
          a.patientPhone.replace(/\D/g, '') === selectedPatient.phone.replace(/\D/g, '')
      )
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Patient Directory</h1>
          <p className="text-sm text-slate-500 mt-1">
            Administrative patient records, contact preferences, and historical visit tracking.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Register Patient</span>
        </button>
      </div>

      {/* Privacy Notice Banner */}
      <div className="p-3 bg-teal-50/70 border border-teal-200/80 rounded-xl flex items-center justify-between text-xs text-teal-900">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0" />
          <span>
            <strong>Data Minimization Standard:</strong> MediFlow AI stores only administrative contact data. Diagnoses, clinical charts, and prescriptions are isolated from administrative receptionist workflows.
          </span>
        </div>
        <span className="font-semibold text-teal-700 font-mono text-[11px] shrink-0">HIPAA Compliant Protocol</span>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by patient name, phone number, email, or patient ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600"
          />
        </div>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="px-3 py-2 text-xs text-slate-500 hover:text-slate-800 font-medium"
          >
            Clear
          </button>
        )}
      </div>

      {/* Patients Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
              <tr>
                <th className="py-3 px-4 font-semibold">ID</th>
                <th className="py-3 px-4 font-semibold">Full Name</th>
                <th className="py-3 px-4 font-semibold">Contact Details</th>
                <th className="py-3 px-4 font-semibold">Date of Birth</th>
                <th className="py-3 px-4 font-semibold">Visit Count</th>
                <th className="py-3 px-4 font-semibold">Registered</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPatients.length > 0 ? (
                filteredPatients.map((patient) => {
                  const visitCount = appointments.filter(
                    (a) => a.patientId === patient.id || a.patientName === patient.fullName
                  ).length;

                  return (
                    <tr key={patient.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-500">
                        {patient.id}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {patient.fullName}
                        {patient.gender && (
                          <span className="text-xs font-normal text-slate-400 ml-1.5">({patient.gender})</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <div className="flex items-center gap-1.5 text-slate-800 font-mono">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{patient.phone}</span>
                        </div>
                        {patient.email && (
                          <div className="flex items-center gap-1.5 text-slate-500 mt-0.5">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            <span>{patient.email}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 font-mono">
                        {patient.dateOfBirth || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold tabular-nums">
                          {visitCount} visits
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-500">
                        {patient.createdAt.split('T')[0]}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedPatient(patient)}
                            className="p-1.5 text-slate-600 hover:text-teal-700 hover:bg-slate-100 rounded transition-colors"
                            title="View appointment history"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(patient)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                            title="Edit patient"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setPatientToDelete(patient)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Archive / Remove patient"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-slate-400">
                    No patients match "{searchQuery}".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
          Showing {filteredPatients.length} of {patients.length} patients in directory
        </div>
      </div>

      {/* Patient Profile & Visit History Modal */}
      {selectedPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <span className="text-xs font-mono font-semibold text-slate-500">{selectedPatient.id}</span>
                <h3 className="text-xl font-bold text-slate-900 mt-0.5">{selectedPatient.fullName}</h3>
                <p className="text-xs text-slate-500">
                  {selectedPatient.gender} · DOB: {selectedPatient.dateOfBirth || 'N/A'}
                </p>
              </div>
              <button
                onClick={() => setSelectedPatient(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile info cards */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 font-medium">Contact:</span>
                <div className="font-semibold text-slate-800 mt-1 font-mono">{selectedPatient.phone}</div>
                <div className="text-slate-600">{selectedPatient.email || 'No email provided'}</div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 font-medium">Emergency Contact:</span>
                <div className="text-slate-800 font-medium mt-1">
                  {selectedPatient.emergencyContact || 'None on file'}
                </div>
              </div>
            </div>

            {selectedPatient.administrativeNotes && (
              <div className="mt-3 p-3 bg-slate-50 rounded-xl text-xs text-slate-700">
                <span className="text-slate-400 font-medium">Administrative Notes:</span>
                <p className="mt-0.5">{selectedPatient.administrativeNotes}</p>
              </div>
            )}

            {/* Appointment History List */}
            <div className="mt-5 flex-1 overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Appointment History ({patientAppointments.length})
                </h4>
              </div>

              {patientAppointments.length > 0 ? (
                <div className="space-y-2.5">
                  {patientAppointments.map((appt) => (
                    <div
                      key={appt.id}
                      className="p-3 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-teal-700">{appt.bookingReference}</span>
                          <span className="text-slate-400">·</span>
                          <span className="font-semibold text-slate-800">{appt.serviceName}</span>
                        </div>
                        <div className="text-slate-500 mt-0.5">
                          {appt.doctorName} · {appt.date} at {appt.startTime} ({appt.durationMinutes} mins)
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold ${
                          appt.status === 'Confirmed'
                            ? 'bg-emerald-50 text-emerald-700'
                            : appt.status === 'Completed'
                            ? 'bg-teal-50 text-teal-700'
                            : appt.status === 'Pending'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {appt.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-400 italic">
                  No appointments found for this patient record.
                </div>
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => {
                  const toDelete = selectedPatient;
                  setPatientToDelete(toDelete);
                }}
                className="text-xs text-red-600 hover:text-red-700 font-semibold flex items-center gap-1.5 px-3 py-1.5 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Patient</span>
              </button>
              <button
                onClick={() => setSelectedPatient(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Deletion Dialog */}
      <ConfirmDialog
        isOpen={Boolean(patientToDelete)}
        title="Remove Patient Record"
        message={
          patientToDelete
            ? `Are you sure you want to remove ${patientToDelete.fullName} (${patientToDelete.id}) from the active directory? Past consultation records will remain archived for regulatory retention.`
            : ''
        }
        confirmLabel={isDeleting ? 'Removing...' : 'Remove Patient'}
        isDestructive={true}
        onConfirm={handleDeletePatient}
        onCancel={() => setPatientToDelete(null)}
      />

      {/* Add / Edit Patient Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">
                {editingPatient ? 'Edit Patient Information' : 'Register New Patient'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Eleanor Vance"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    placeholder="+1 (217) 555-0100"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="patient@syntheticmail.test"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600"
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other / Non-binary</option>
                    <option value="Decline">Decline to specify</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Emergency Contact</label>
                <input
                  type="text"
                  placeholder="e.g. Spouse (+1 217-555-0199)"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Administrative Notes</label>
                <textarea
                  rows={2}
                  placeholder="Communication preferences, accessibility accommodations..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors"
                >
                  {isSubmitting ? 'Saving...' : editingPatient ? 'Update Patient' : 'Register Patient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
