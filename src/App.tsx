import React, { useState, useEffect, useCallback } from 'react';
import { ToastProvider, useToast } from './components/common/Toast.tsx';
import { ConfirmDialog } from './components/common/ConfirmDialog.tsx';
import { Header } from './components/layout/Header.tsx';
import { Sidebar } from './components/layout/Sidebar.tsx';
import { OverviewDashboard } from './components/overview/OverviewDashboard.tsx';
import { AppointmentManager } from './components/appointments/AppointmentManager.tsx';
import { AppointmentModal } from './components/appointments/AppointmentModal.tsx';
import { PatientDirectory } from './components/patients/PatientDirectory.tsx';
import { AIReceptionistView } from './components/receptionist/AIReceptionistView.tsx';
import { FloatingChatWidget } from './components/receptionist/FloatingChatWidget.tsx';
import { AutomationCenter } from './components/automations/AutomationCenter.tsx';
import { AnalyticsDashboard } from './components/analytics/AnalyticsDashboard.tsx';
import { ReportGenerator } from './components/reports/ReportGenerator.tsx';
import { ClinicSettings } from './components/settings/ClinicSettings.tsx';
import { PatientPortal } from './components/patient-portal/PatientPortal.tsx';
import { InquiryManager } from './components/inquiries/InquiryManager.tsx';
import { PortalGateway } from './components/portal/PortalGateway.tsx';
import { AdminLoginView } from './components/admin/AdminLoginView.tsx';
import { api } from './services/api.ts';
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
  UserRole,
  PortalType
} from './types/index.ts';
import { Menu, HeartPulse } from 'lucide-react';

function MediFlowApp() {
  const { showToast } = useToast();

  // Multi-portal state: defaults to portal-select gateway when user opens the app
  const [currentPortal, setCurrentPortal] = useState<PortalType>('portal-select');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('mediflow_admin_auth') === 'true';
  });

  const [currentRole, setCurrentRole] = useState<UserRole>('admin');
  const [activeTab, setActiveTab] = useState('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Core data states
  const [clinic, setClinic] = useState<ClinicProfile | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [services, setServices] = useState<HealthcareService[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [automations, setAutomations] = useState<AutomationRule[]>([]);
  const [executions, setExecutions] = useState<AutomationExecution[]>([]);
  const [reports, setReports] = useState<ClinicReport[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Appointment Modal state
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [appointmentToEdit, setAppointmentToEdit] = useState<Appointment | null>(null);

  // Clear-data confirmation dialog
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Fetch all initial data
  const fetchData = useCallback(async () => {
    try {
      const [
        clinicData,
        doctorsData,
        servicesData,
        patientsData,
        apptsData,
        inquiriesData,
        automationsData,
        executionsData,
        reportsData,
        analyticsData
      ] = await Promise.all([
        api.getClinic(),
        api.getDoctors(),
        api.getServices(),
        api.getPatients(),
        api.getAppointments(),
        api.getInquiries(),
        api.getAutomations(),
        api.getExecutions(),
        api.getReports(),
        api.getAnalytics()
      ]);

      setClinic(clinicData);
      setDoctors(doctorsData);
      setServices(servicesData);
      setPatients(patientsData);
      setAppointments(apptsData);
      setInquiries(inquiriesData);
      setAutomations(automationsData);
      setExecutions(executionsData);
      setReports(reportsData);
      setAnalytics(analyticsData);
    } catch (err: any) {
      console.error('Initial data fetch error:', err);
      showToast('Could not reach backend API. Checking local fallback state.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle portal selection from gateway
  const handleSelectPortal = (portal: PortalType) => {
    if (portal === 'admin') {
      setCurrentPortal('admin');
      setCurrentRole('admin');
    } else if (portal === 'receptionist') {
      setCurrentPortal('receptionist');
      setCurrentRole('receptionist');
      setActiveTab('overview');
      showToast('Welcome to the Receptionist Desk.', 'info');
    } else if (portal === 'user') {
      setCurrentPortal('user');
      setCurrentRole('patient');
      showToast('Welcome to the Patient Self-Service Portal.', 'info');
    }
  };

  // Handle Admin Login Success
  const handleAdminLoginSuccess = () => {
    setIsAdminAuthenticated(true);
    sessionStorage.setItem('mediflow_admin_auth', 'true');
    setCurrentPortal('admin');
    setCurrentRole('admin');
    setActiveTab('overview');
    showToast('Administrator session authenticated successfully.', 'success');
  };

  // Handle Admin Logout
  const handleAdminLogout = () => {
    setIsAdminAuthenticated(false);
    sessionStorage.removeItem('mediflow_admin_auth');
    setCurrentPortal('portal-select');
    showToast('Logged out of Admin Portal.', 'info');
  };

  // Handle Receptionist Logout
  const handleReceptionistLogout = () => {
    setCurrentPortal('portal-select');
    showToast('Logged out of Receptionist Portal.', 'info');
  };

  // Handle role switch from header dropdown (for demo purposes within dashboard)
  const handleRoleChange = (role: UserRole) => {
    setCurrentRole(role);
    if (role === 'patient') {
      setCurrentPortal('user');
    } else if (role === 'receptionist') {
      setCurrentPortal('receptionist');
    } else if (role === 'admin') {
      if (!isAdminAuthenticated) {
        setCurrentPortal('admin');
      } else {
        setCurrentPortal('admin');
      }
    }
  };

  // Handle appointment status change
  const handleUpdateAppointmentStatus = async (id: string, status: Appointment['status']) => {
    try {
      await api.updateAppointment(id, { status });
      showToast(`Appointment status updated to ${status}.`, 'success');
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Status update failed', 'error');
    }
  };

  // Clear all data
  const handleResetData = async () => {
    try {
      await api.resetData();
      showToast('All patient, appointment, inquiry and report data was cleared.', 'success');
      setShowResetConfirm(false);
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Reset failed', 'error');
    }
  };

  if (isLoading || !clinic) {
    return (
      <div className="min-h-screen bg-[#F7F9FC] flex flex-col items-center justify-center p-6 text-slate-600">
        <div className="w-12 h-12 rounded-2xl bg-[#142D4E] text-teal-400 flex items-center justify-center font-bold text-xl mb-4 animate-pulse">
          M
        </div>
        <p className="text-sm font-semibold text-slate-800">Loading MediFlow AI Platform...</p>
        <p className="text-xs text-slate-400 mt-1">Connecting to clinic database and Gemini models</p>
      </div>
    );
  }

  // 1. PORTAL SELECTOR GATEWAY (Shown when opening the app)
  if (currentPortal === 'portal-select') {
    return (
      <PortalGateway
        clinic={clinic}
        onSelectPortal={handleSelectPortal}
        isAdminAuthenticated={isAdminAuthenticated}
      />
    );
  }

  // 1. PATIENT PORTAL (self-service booking + AI assistant; patients have no logout)
  if (currentPortal === 'user') {
    return (
      <div className="min-h-screen bg-[#F7F9FC]">
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#142D4E] text-teal-400 flex items-center justify-center font-bold text-sm">
              <HeartPulse className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <span className="font-bold text-slate-900 tracking-tight text-sm sm:text-base">{clinic.name}</span>
              <span className="ml-2 text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200 hidden sm:inline-block">
                User / Patient Portal
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setCurrentPortal('portal-select')}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Switch Portal
            </button>
          </div>
        </header>

        <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          <PatientPortal
            clinic={clinic}
            doctors={doctors}
            services={services}
            existingAppointments={appointments}
            onAppointmentBooked={fetchData}
          />
        </main>
        <FloatingChatWidget onBooked={fetchData} />
      </div>
    );
  }

  // 4. ADMIN LOGIN SCREEN (If user selects Admin and is not yet authenticated with username and password)
  if (currentPortal === 'admin' && !isAdminAuthenticated) {
    return (
      <AdminLoginView
        clinic={clinic}
        onLoginSuccess={handleAdminLoginSuccess}
        onBackToGateway={() => setCurrentPortal('portal-select')}
      />
    );
  }

  // 5. AUTHENTICATED ADMIN PORTAL OR RECEPTIONIST PORTAL
  const isReceptionistPortal = currentPortal === 'receptionist';
  const portalLogoutHandler = isReceptionistPortal ? handleReceptionistLogout : handleAdminLogout;

  return (
    <div className="min-h-screen bg-[#F7F9FC] flex">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        currentRole={isReceptionistPortal ? 'receptionist' : 'admin'}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        onLogout={portalLogoutHandler}
        onSwitchPortal={() => setCurrentPortal('user')}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <Header
          currentRole={isReceptionistPortal ? 'receptionist' : 'admin'}
          onRoleChange={handleRoleChange}
          onResetDemo={() => setShowResetConfirm(true)}
          onNavigate={setActiveTab}
          appointments={appointments}
          inquiries={inquiries}
          onLogout={portalLogoutHandler}
          onSwitchPortal={() => setCurrentPortal('user')}
          onSelectAppointment={(appt) => {
            setAppointmentToEdit(appt);
            setIsAppointmentModalOpen(true);
          }}
        />

        {/* Mobile menu trigger */}
        <div className="lg:hidden px-4 py-2 bg-white border-b border-slate-200 flex items-center justify-between">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 flex items-center gap-2 text-xs font-medium"
          >
            <Menu className="w-5 h-5" />
            <span>Menu</span>
          </button>
          <span className="text-xs font-semibold text-slate-700 capitalize">
            {isReceptionistPortal ? 'Reception Desk' : 'Admin Console'} · {activeTab}
          </span>
        </div>

        {/* Page Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto overflow-y-auto">
          {activeTab === 'overview' && (
            <OverviewDashboard
              analytics={analytics}
              appointments={appointments}
              inquiries={inquiries}
              executions={executions}
              onOpenAddAppointment={() => {
                setAppointmentToEdit(null);
                setIsAppointmentModalOpen(true);
              }}
              onOpenAddPatient={() => setActiveTab('patients')}
              onOpenReceptionist={() => setActiveTab('receptionist')}
              onOpenGenerateReport={() => setActiveTab('reports')}
              onNavigate={setActiveTab}
              onUpdateAppointmentStatus={handleUpdateAppointmentStatus}
            />
          )}

          {activeTab === 'appointments' && (
            <AppointmentManager
              appointments={appointments}
              doctors={doctors}
              services={services}
              onOpenAddModal={() => {
                setAppointmentToEdit(null);
                setIsAppointmentModalOpen(true);
              }}
              onEditAppointment={(appt) => {
                setAppointmentToEdit(appt);
                setIsAppointmentModalOpen(true);
              }}
              onRefresh={fetchData}
            />
          )}

          {activeTab === 'patients' && (
            <PatientDirectory
              patients={patients}
              appointments={appointments}
              onRefresh={fetchData}
            />
          )}

          {activeTab === 'inquiries' && (
            <InquiryManager
              inquiries={inquiries}
              onRefresh={fetchData}
            />
          )}

          {activeTab === 'receptionist' && (
            <AIReceptionistView
              onOpenBookAppointment={() => {
                setAppointmentToEdit(null);
                setIsAppointmentModalOpen(true);
              }}
            />
          )}

          {activeTab === 'automations' && !isReceptionistPortal && (
            <AutomationCenter
              automations={automations}
              executions={executions}
              onRefresh={fetchData}
            />
          )}

          {activeTab === 'analytics' && !isReceptionistPortal && (
            <AnalyticsDashboard
              analytics={analytics}
              appointments={appointments}
              doctors={doctors}
              services={services}
              onRefresh={fetchData}
            />
          )}

          {activeTab === 'reports' && !isReceptionistPortal && (
            <ReportGenerator
              reports={reports}
              onRefresh={fetchData}
            />
          )}

          {activeTab === 'settings' && !isReceptionistPortal && (
            <ClinicSettings
              clinic={clinic}
              doctors={doctors}
              services={services}
              automations={automations}
              onRefresh={fetchData}
            />
          )}
        </main>

        {/* Add/Edit Appointment Modal */}
        <AppointmentModal
          isOpen={isAppointmentModalOpen}
          onClose={() => setIsAppointmentModalOpen(false)}
          onSuccess={fetchData}
          doctors={doctors}
          services={services}
          patients={patients}
          appointmentToEdit={appointmentToEdit}
        />

        {/* Reset Demo Data Confirmation Dialog */}
        <ConfirmDialog
          isOpen={showResetConfirm}
          title="Clear all clinic data"
          message="This permanently deletes every patient, appointment, inquiry, report and activity log so the system starts completely clean. Doctors, services and clinic settings are kept."
          confirmLabel="Clear all data"
          isDestructive={true}
          onConfirm={handleResetData}
          onCancel={() => setShowResetConfirm(false)}
        />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <MediFlowApp />
    </ToastProvider>
  );
}
