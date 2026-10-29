import React, { useState } from 'react';
import {
  Building,
  UserCheck,
  Stethoscope,
  Bot,
  Database,
  Save,
  Plus,
  Edit2,
  Trash2,
  Clock,
  Shield,
  X
} from 'lucide-react';
import { ClinicProfile, Doctor, HealthcareService, AutomationRule } from '../../types/index.ts';
import { api } from '../../services/api.ts';
import { useToast } from '../common/Toast.tsx';
import { ConfirmDialog } from '../common/ConfirmDialog.tsx';

interface ClinicSettingsProps {
  clinic: ClinicProfile;
  doctors: Doctor[];
  services: HealthcareService[];
  automations: AutomationRule[];
  onRefresh: () => void;
}

export const ClinicSettings: React.FC<ClinicSettingsProps> = ({
  clinic,
  doctors,
  services,
  automations,
  onRefresh
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'clinic' | 'doctors' | 'services' | 'ai' | 'deployment'>('clinic');

  // Clinic profile form state
  const [name, setName] = useState(clinic.name);
  const [tagline, setTagline] = useState(clinic.tagline);
  const [address, setAddress] = useState(clinic.address);
  const [phone, setPhone] = useState(clinic.phone);
  const [email, setEmail] = useState(clinic.email);
  const [timeZone, setTimeZone] = useState(clinic.timeZone);
  const [weekdayStart, setWeekdayStart] = useState(clinic.openingHours?.weekdays?.start || '08:30');
  const [weekdayEnd, setWeekdayEnd] = useState(clinic.openingHours?.weekdays?.end || '17:30');
  const [satStart, setSatStart] = useState(clinic.openingHours?.saturday?.start || '09:00');
  const [satEnd, setSatEnd] = useState(clinic.openingHours?.saturday?.end || '13:00');
  const [sunClosed, setSunClosed] = useState(clinic.openingHours?.sunday?.closed ?? true);
  const [isSavingClinic, setIsSavingClinic] = useState(false);

  // Doctor CRUD modal state
  const [doctorModalOpen, setDoctorModalOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [docName, setDocName] = useState('');
  const [docTitle, setDocTitle] = useState('MD');
  const [docSpecialty, setDocSpecialty] = useState('');
  const [docEmail, setDocEmail] = useState('');
  const [docPhone, setDocPhone] = useState('');
  const [docRoom, setDocRoom] = useState('Suite 101');
  const [docStartHour, setDocStartHour] = useState('09:00');
  const [docEndHour, setDocEndHour] = useState('17:00');
  const [docWorkingDays, setDocWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [deletingDoctor, setDeletingDoctor] = useState<Doctor | null>(null);

  // Service CRUD modal state
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<HealthcareService | null>(null);
  const [srvName, setSrvName] = useState('');
  const [srvCategory, setSrvCategory] = useState('Primary Care');
  const [srvDescription, setSrvDescription] = useState('');
  const [srvDuration, setSrvDuration] = useState(30);
  const [srvFee, setSrvFee] = useState(95);
  const [deletingService, setDeletingService] = useState<HealthcareService | null>(null);

  // AI configuration state
  const [welcomeMessage, setWelcomeMessage] = useState(clinic.aiReceptionist?.welcomeMessage || '');
  const [escalationRules, setEscalationRules] = useState(clinic.aiReceptionist?.escalationThreshold || '');
  const [clinicBio, setClinicBio] = useState(clinic.aiReceptionist?.clinicBio || '');
  const [isSavingAI, setIsSavingAI] = useState(false);

  // Save Clinic Profile
  const handleSaveClinic = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingClinic(true);
    try {
      await api.updateClinic({
        name,
        tagline,
        address,
        phone,
        email,
        timeZone,
        openingHours: {
          weekdays: { start: weekdayStart, end: weekdayEnd },
          saturday: { start: satStart, end: satEnd },
          sunday: { closed: sunClosed }
        }
      });
      showToast('Clinic details and operational hours saved.', 'success');
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to update clinic', 'error');
    } finally {
      setIsSavingClinic(false);
    }
  };

  // Open Doctor Modal
  const openDoctorModal = (doc?: Doctor) => {
    if (doc) {
      setEditingDoctor(doc);
      setDocName(doc.name);
      setDocTitle(doc.title);
      setDocSpecialty(doc.specialty);
      setDocEmail(doc.email);
      setDocPhone(doc.phone);
      setDocRoom(doc.roomNumber);
      setDocStartHour(doc.workHours.start);
      setDocEndHour(doc.workHours.end);
      setDocWorkingDays(doc.workingDays);
    } else {
      setEditingDoctor(null);
      setDocName('');
      setDocTitle('MD');
      setDocSpecialty('General Medicine');
      setDocEmail('doctor@harmonyhealthclinic.com');
      setDocPhone('+1 (217) 555-0100');
      setDocRoom('Consultation Room 102');
      setDocStartHour('09:00');
      setDocEndHour('17:00');
      setDocWorkingDays([1, 2, 3, 4, 5]);
    }
    setDoctorModalOpen(true);
  };

  // Save Doctor
  const handleSaveDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docName.trim() || !docSpecialty.trim()) {
      showToast('Doctor name and specialty are required.', 'error');
      return;
    }

    try {
      if (editingDoctor) {
        await api.updateDoctor(editingDoctor.id, {
          name: docName,
          title: docTitle,
          specialty: docSpecialty,
          email: docEmail,
          phone: docPhone,
          roomNumber: docRoom,
          workHours: { start: docStartHour, end: docEndHour },
          workingDays: docWorkingDays
        });
        showToast(`Doctor ${docName} updated successfully.`, 'success');
      } else {
        await api.createDoctor({
          name: docName,
          title: docTitle,
          specialty: docSpecialty,
          email: docEmail,
          phone: docPhone,
          roomNumber: docRoom,
          workHours: { start: docStartHour, end: docEndHour },
          workingDays: docWorkingDays,
          servicesOffered: [services[0]?.id || 'srv-1']
        });
        showToast(`Doctor ${docName} added to practice roster.`, 'success');
      }
      setDoctorModalOpen(false);
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to save doctor', 'error');
    }
  };

  // Delete Doctor
  const handleDeleteDoctor = async () => {
    if (!deletingDoctor) return;
    try {
      await api.deleteDoctor(deletingDoctor.id);
      showToast(`Doctor ${deletingDoctor.name} removed from roster.`, 'success');
      setDeletingDoctor(null);
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete doctor', 'error');
    }
  };

  // Open Service Modal
  const openServiceModal = (srv?: HealthcareService) => {
    if (srv) {
      setEditingService(srv);
      setSrvName(srv.name);
      setSrvCategory(srv.category);
      setSrvDescription(srv.description);
      setSrvDuration(srv.durationMinutes);
      setSrvFee(srv.consultationFee);
    } else {
      setEditingService(null);
      setSrvName('');
      setSrvCategory('Primary Care');
      setSrvDescription('');
      setSrvDuration(30);
      setSrvFee(95);
    }
    setServiceModalOpen(true);
  };

  // Save Service
  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!srvName.trim()) {
      showToast('Service name is required.', 'error');
      return;
    }

    try {
      if (editingService) {
        await api.updateService(editingService.id, {
          name: srvName,
          category: srvCategory,
          description: srvDescription,
          durationMinutes: Number(srvDuration),
          consultationFee: Number(srvFee)
        });
        showToast(`Service "${srvName}" updated.`, 'success');
      } else {
        await api.createService({
          name: srvName,
          category: srvCategory,
          description: srvDescription,
          durationMinutes: Number(srvDuration),
          consultationFee: Number(srvFee),
          isActive: true
        });
        showToast(`Service "${srvName}" added to catalog.`, 'success');
      }
      setServiceModalOpen(false);
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to save service', 'error');
    }
  };

  // Delete Service
  const handleDeleteService = async () => {
    if (!deletingService) return;
    try {
      await api.deleteService(deletingService.id);
      showToast(`Service "${deletingService.name}" removed from catalog.`, 'success');
      setDeletingService(null);
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete service', 'error');
    }
  };

  // Save AI Config
  const handleSaveAIConfig = async () => {
    setIsSavingAI(true);
    try {
      await api.updateClinic({
        aiReceptionist: {
          ...clinic.aiReceptionist,
          welcomeMessage,
          escalationThreshold: escalationRules,
          clinicBio
        }
      });
      showToast('AI Receptionist parameters saved.', 'success');
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to update AI settings', 'error');
    } finally {
      setIsSavingAI(false);
    }
  };

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Clinic Configuration & Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage practice location, provider rosters, clinical service catalog, and AI receptionist boundaries.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-200/80 rounded-xl max-w-2xl overflow-x-auto">
        <button
          onClick={() => setActiveTab('clinic')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'clinic' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>Clinic Profile</span>
        </button>

        <button
          onClick={() => setActiveTab('doctors')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'doctors' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>Doctors & Rosters</span>
        </button>

        <button
          onClick={() => setActiveTab('services')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'services' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Stethoscope className="w-3.5 h-3.5" />
          <span>Services & Pricing</span>
        </button>

        <button
          onClick={() => setActiveTab('ai')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'ai' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          <span>AI Receptionist</span>
        </button>

        <button
          onClick={() => setActiveTab('deployment')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'deployment' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Backend & Persistence</span>
        </button>
      </div>

      {/* Tab 1: Clinic Profile */}
      {activeTab === 'clinic' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs max-w-3xl">
          <h2 className="text-base font-bold text-slate-900 mb-1">Practice Information</h2>
          <p className="text-xs text-slate-500 mb-5">
            Public identity displayed to patients across portal bookings and AI conversations.
          </p>

          <form onSubmit={handleSaveClinic} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Clinic Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tagline</label>
                <input
                  type="text"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Physical Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Timezone</label>
                <input
                  type="text"
                  value={timeZone}
                  onChange={(e) => setTimeZone(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600 font-mono"
                />
              </div>
            </div>

            {/* Operating Hours Editor */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Clinic Operating Hours</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                  <div className="font-semibold text-slate-900">Monday - Friday (Weekdays)</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={weekdayStart}
                      onChange={(e) => setWeekdayStart(e.target.value)}
                      className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-mono"
                    />
                    <span className="text-slate-400">to</span>
                    <input
                      type="time"
                      value={weekdayEnd}
                      onChange={(e) => setWeekdayEnd(e.target.value)}
                      className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                  <div className="font-semibold text-slate-900">Saturday</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={satStart}
                      onChange={(e) => setSatStart(e.target.value)}
                      className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-mono"
                    />
                    <span className="text-slate-400">to</span>
                    <input
                      type="time"
                      value={satEnd}
                      onChange={(e) => setSatEnd(e.target.value)}
                      className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={isSavingClinic}
                className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingClinic ? 'Saving...' : 'Save Settings'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 2: Doctors & Rosters */}
      {activeTab === 'doctors' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Doctor Profiles & Working Hours</h2>
                <p className="text-xs text-slate-500">
                  Configures provider calendar hours and consultation suites.
                </p>
              </div>
              <button
                onClick={() => openDoctorModal()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Doctor</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {doctors.map((doc) => (
                <div key={doc.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between text-xs space-y-3">
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">{doc.name}</h3>
                        <p className="text-teal-700 font-medium">{doc.specialty}</p>
                      </div>
                      <span className="font-mono text-[10px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {doc.roomNumber}
                      </span>
                    </div>

                    <div className="mt-2 text-slate-600">
                      <span className="font-semibold text-slate-700">Hours:</span> {doc.workHours.start} - {doc.workHours.end}
                    </div>

                    <div className="text-slate-600 mt-1">
                      <span className="font-semibold text-slate-700">Days:</span>{' '}
                      {doc.workingDays.map((d) => dayLabels[d]).join(', ')}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                    <span className="font-mono text-[11px] text-slate-400">{doc.phone}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openDoctorModal(doc)}
                        className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded"
                        title="Edit Doctor"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingDoctor(doc)}
                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                        title="Delete Doctor"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Services & Pricing */}
      {activeTab === 'services' && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Healthcare Service Catalog</h2>
              <p className="text-xs text-slate-500">
                Available medical appointments, standardized durations, and consultation fees.
              </p>
            </div>
            <button
              onClick={() => openServiceModal()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Service</span>
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {services.map((srv) => (
              <div key={srv.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 text-sm">{srv.name}</span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                      {srv.category}
                    </span>
                  </div>
                  <p className="text-slate-500 mt-0.5 max-w-xl">{srv.description}</p>
                </div>

                <div className="flex items-center gap-4 shrink-0 ml-4">
                  <div className="text-right">
                    <div className="font-bold text-slate-900 text-sm tabular-nums">${srv.consultationFee}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{srv.durationMinutes} mins</div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openServiceModal(srv)}
                      className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded"
                      title="Edit Service"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletingService(srv)}
                      className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                      title="Delete Service"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: AI Receptionist Settings */}
      {activeTab === 'ai' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs max-w-3xl space-y-5">
          <div>
            <h2 className="text-base font-bold text-slate-900">AI Receptionist Persona & Escalation Thresholds</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Powered by Google Gemini 3.8 Flash. Configures conversational boundaries and nurse triage escalation rules.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Greeting & Welcome Message</label>
            <textarea
              rows={2}
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Clinic Knowledge Base & Bio</label>
            <textarea
              rows={3}
              value={clinicBio}
              onChange={(e) => setClinicBio(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Escalation Policy</label>
            <textarea
              rows={2}
              value={escalationRules}
              onChange={(e) => setEscalationRules(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600"
            />
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-900">
            <strong>Mandatory Safety Boundary:</strong> The AI receptionist is programmed never to provide clinical diagnoses, drug dosage suggestions, or symptom treatments. Urgent symptoms automatically trigger the 911 / Emergency Room protocol.
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={handleSaveAIConfig}
              disabled={isSavingAI}
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSavingAI ? 'Saving...' : 'Update AI Guidelines'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab 5: Backend & Persistence Instructions */}
      {activeTab === 'deployment' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs max-w-3xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Backend Persistence & Production Setup</h2>
              <p className="text-xs text-slate-500">
                Currently running on a <strong>local JSON file store</strong>.
              </p>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs text-slate-700 leading-relaxed">
            <h3 className="font-bold text-slate-900">Local storage notice:</h3>
            <p>
              Records are persisted locally in <code>/data/clinic_db.json</code> on the server.
              Appointments created, modified, or cancelled survive browser refreshes.
            </p>
            <p className="text-slate-500 italic">
              Note: local file storage is designed for single-node evaluation and does not replace production multi-region distributed databases or HIPAA Business Associate Agreements (BAAs).
            </p>
          </div>

          <div className="space-y-3 text-xs text-slate-700">
            <h3 className="font-bold text-slate-900">Production Firebase & Google Cloud Activation Steps:</h3>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-600">
              <li>Provision a Google Cloud project with Firebase Firestore enabled.</li>
              <li>Configure Firebase Authentication with Email/Password and OAuth providers.</li>
              <li>Deploy the Firestore security rules to enforce clinic data isolation and patient record privacy.</li>
              <li>Set <code>GEMINI_API_KEY</code> in environment secrets to activate production quota for Gemini 3.8 Flash.</li>
              <li>Connect transactional SMS (Twilio or Firebase Cloud Messaging) for live 24-hour appointment reminders.</li>
            </ol>
          </div>
        </div>
      )}

      {/* Doctor Modal (Add/Edit) */}
      {doctorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">
                {editingDoctor ? `Edit ${editingDoctor.name}` : 'Add New Doctor to Practice'}
              </h3>
              <button onClick={() => setDoctorModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDoctor} className="mt-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Dr. Jennifer Adams"
                    value={docName}
                    onChange={(e) => setDocName(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Specialty *</label>
                <input
                  type="text"
                  placeholder="e.g. Family Medicine, Cardiology"
                  value={docSpecialty}
                  onChange={(e) => setDocSpecialty(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={docPhone}
                    onChange={(e) => setDocPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Room / Suite</label>
                  <input
                    type="text"
                    value={docRoom}
                    onChange={(e) => setDocRoom(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Work Start Time</label>
                  <input
                    type="time"
                    value={docStartHour}
                    onChange={(e) => setDocStartHour(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Work End Time</label>
                  <input
                    type="time"
                    value={docEndHour}
                    onChange={(e) => setDocEndHour(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Working Days Checkboxes */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Scheduled Working Days</label>
                <div className="flex items-center gap-2">
                  {dayLabels.map((lbl, idx) => {
                    const isChecked = docWorkingDays.includes(idx);
                    return (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => {
                          if (isChecked) {
                            setDocWorkingDays(docWorkingDays.filter((d) => d !== idx));
                          } else {
                            setDocWorkingDays([...docWorkingDays, idx]);
                          }
                        }}
                        className={`px-2 py-1 rounded text-[11px] font-semibold border ${
                          isChecked ? 'bg-teal-600 border-teal-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        {lbl}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDoctorModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg shadow-xs"
                >
                  {editingDoctor ? 'Save Changes' : 'Add Doctor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Service Modal (Add/Edit) */}
      {serviceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">
                {editingService ? `Edit ${editingService.name}` : 'Add Healthcare Service'}
              </h3>
              <button onClick={() => setServiceModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveService} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Service Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Comprehensive Physical Exam"
                  value={srvName}
                  onChange={(e) => setSrvName(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600 text-xs"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={srvCategory}
                    onChange={(e) => setSrvCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600 text-xs"
                  >
                    <option value="Primary Care">Primary Care</option>
                    <option value="Specialty Care">Specialty Care</option>
                    <option value="Preventive Care">Preventive Care</option>
                    <option value="Pediatrics">Pediatrics</option>
                    <option value="Immunization">Immunization</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Duration (Mins)</label>
                  <input
                    type="number"
                    min="15"
                    step="5"
                    value={srvDuration}
                    onChange={(e) => setSrvDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fee ($ USD)</label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={srvFee}
                    onChange={(e) => setSrvFee(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Clinical preparation instructions and visit scope"
                  value={srvDescription}
                  onChange={(e) => setSrvDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600 text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setServiceModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg shadow-xs"
                >
                  {editingService ? 'Save Changes' : 'Add Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Doctor Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingDoctor)}
        title="Remove Doctor from Practice"
        message={`Are you sure you want to remove ${deletingDoctor?.name}? Their existing appointments will remain in the database.`}
        confirmLabel="Remove Doctor"
        isDestructive={true}
        onConfirm={handleDeleteDoctor}
        onCancel={() => setDeletingDoctor(null)}
      />

      {/* Delete Service Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingService)}
        title="Remove Service from Catalog"
        message={`Are you sure you want to remove "${deletingService?.name}"?`}
        confirmLabel="Remove Service"
        isDestructive={true}
        onConfirm={handleDeleteService}
        onCancel={() => setDeletingService(null)}
      />
    </div>
  );
};
