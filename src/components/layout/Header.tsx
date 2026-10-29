import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Bell,
  Calendar,
  Shield,
  RotateCcw,
  User,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ExternalLink,
  LogOut,
  Globe
} from 'lucide-react';
import { UserRole, Inquiry, Appointment } from '../../types/index.ts';

interface HeaderProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  onResetDemo: () => void;
  onNavigate: (tab: string) => void;
  appointments: Appointment[];
  inquiries: Inquiry[];
  onSelectAppointment?: (appt: Appointment) => void;
  onLogout?: () => void;
  onSwitchPortal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  onRoleChange,
  onResetDemo,
  onNavigate,
  appointments,
  inquiries,
  onSelectAppointment,
  onLogout,
  onSwitchPortal
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter search results
  const matchingAppointments = searchQuery.trim()
    ? appointments.filter(
        (a) =>
          a.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.bookingReference.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.doctorName.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 5)
    : [];

  const matchingInquiries = searchQuery.trim()
    ? inquiries.filter(
        (i) =>
          i.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          i.message.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 3)
    : [];

  // Notifications: urgent inquiries + today's pending appointments
  const todayStr = new Date().toISOString().split('T')[0];
  const pendingToday = appointments.filter((a) => a.date === todayStr && a.status === 'Pending');
  const urgentInquiries = inquiries.filter((i) => i.priority === 'urgent' || i.priority === 'high');
  const notificationCount = pendingToday.length + urgentInquiries.length;

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Global Search Bar */}
      <div className="relative w-80 lg:w-96" ref={searchRef}>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search patients, doctors, bookings..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearchDropdown(true);
            }}
            onFocus={() => setShowSearchDropdown(true)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-teal-600 rounded-lg outline-none transition-colors"
          />
        </div>

        {/* Live Search Dropdown */}
        {showSearchDropdown && searchQuery.trim() && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50">
            <div className="p-3 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
              Appointments ({matchingAppointments.length})
            </div>
            {matchingAppointments.length > 0 ? (
              matchingAppointments.map((appt) => (
                <div
                  key={appt.id}
                  onClick={() => {
                    onNavigate('appointments');
                    onSelectAppointment?.(appt);
                    setShowSearchDropdown(false);
                    setSearchQuery('');
                  }}
                  className="px-4 py-2.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between text-sm"
                >
                  <div>
                    <span className="font-medium text-slate-800">{appt.patientName}</span>
                    <span className="text-xs text-slate-500 ml-2">({appt.bookingReference})</span>
                    <div className="text-xs text-slate-500">{appt.doctorName} · {appt.date} at {appt.startTime}</div>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-medium ${
                      appt.status === 'Confirmed'
                        ? 'bg-emerald-50 text-emerald-700'
                        : appt.status === 'Pending'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {appt.status}
                  </span>
                </div>
              ))
            ) : (
              <div className="px-4 py-2 text-xs text-slate-400">No matching appointments</div>
            )}

            <div className="p-3 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 border-t">
              Patient Inquiries ({matchingInquiries.length})
            </div>
            {matchingInquiries.length > 0 ? (
              matchingInquiries.map((inq) => (
                <div
                  key={inq.id}
                  onClick={() => {
                    onNavigate('inquiries');
                    setShowSearchDropdown(false);
                    setSearchQuery('');
                  }}
                  className="px-4 py-2.5 hover:bg-slate-50 cursor-pointer text-sm"
                >
                  <div className="font-medium text-slate-800">{inq.patientName}</div>
                  <div className="text-xs text-slate-500 truncate">{inq.message}</div>
                </div>
              ))
            ) : (
              <div className="px-4 py-2 text-xs text-slate-400">No matching inquiries</div>
            )}
          </div>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Date Indicator */}
        <div className="hidden md:flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg">
          <Calendar className="w-3.5 h-3.5 text-slate-500" />
          <span>{todayFormatted}</span>
        </div>

        {/* Notifications Popover */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {notificationCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-teal-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                {notificationCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50">
              <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <span className="text-xs font-semibold text-slate-900">Activity Notifications</span>
                <span className="text-xs text-slate-500">{notificationCount} action items</span>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                {pendingToday.length > 0 && (
                  <div className="p-3 hover:bg-slate-50">
                    <div className="flex items-center gap-2 text-xs font-medium text-amber-700">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{pendingToday.length} Pending Today Visits</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Review and confirm patient requests awaiting front-desk signoff.</p>
                  </div>
                )}
                {urgentInquiries.map((inq) => (
                  <div key={inq.id} className="p-3 hover:bg-slate-50">
                    <div className="flex items-center gap-2 text-xs font-medium text-red-700">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>High Priority: {inq.patientName}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2">{inq.message}</p>
                  </div>
                ))}
                {notificationCount === 0 && (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No urgent pending notifications. All queues nominal!
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Clear all data */}
        <button
          onClick={onResetDemo}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors shrink-0"
          title="Delete all patients, appointments, inquiries, reports and logs"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Clear Data</span>
        </button>

        {/* Role Switcher Pill & User Profile */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1.5 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
          >
            <div className="w-7 h-7 rounded-md bg-[#142D4E] text-white flex items-center justify-center text-xs font-semibold">
              {currentRole === 'admin' ? 'A' : currentRole === 'receptionist' ? 'R' : 'P'}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-semibold text-slate-900 capitalize leading-none">
                {currentRole === 'admin' ? 'Clinic Admin' : currentRole === 'receptionist' ? 'Front Desk Staff' : 'Patient View'}
              </div>
              <div className="text-[10px] text-teal-600 font-medium leading-tight mt-0.5">Role Switcher</div>
            </div>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50">
              <div className="p-3 bg-slate-50 border-b border-slate-100">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Switch Operational Role</p>
                <p className="text-xs text-slate-600 mt-0.5">Role-based permission switcher</p>
              </div>

              <div className="p-2 space-y-1">
                <button
                  onClick={() => {
                    onRoleChange('admin');
                    setShowUserMenu(false);
                  }}
                  className={`w-full flex items-center justify-between p-2 text-left rounded-lg text-xs transition-colors ${
                    currentRole === 'admin' ? 'bg-teal-50 text-teal-900 font-medium' : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div>
                    <div className="font-semibold">Clinic Administrator</div>
                    <div className="text-[11px] text-slate-500">Full access: analytics, reports, settings, rosters</div>
                  </div>
                  {currentRole === 'admin' && <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />}
                </button>

                <button
                  onClick={() => {
                    onRoleChange('receptionist');
                    setShowUserMenu(false);
                  }}
                  className={`w-full flex items-center justify-between p-2 text-left rounded-lg text-xs transition-colors ${
                    currentRole === 'receptionist' ? 'bg-teal-50 text-teal-900 font-medium' : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div>
                    <div className="font-semibold">Receptionist</div>
                    <div className="text-[11px] text-slate-500">Manage bookings, inquiries, daily schedule</div>
                  </div>
                  {currentRole === 'receptionist' && <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />}
                </button>

                <button
                  onClick={() => {
                    onRoleChange('patient');
                    setShowUserMenu(false);
                  }}
                  className={`w-full flex items-center justify-between p-2 text-left rounded-lg text-xs transition-colors ${
                    currentRole === 'patient' ? 'bg-teal-50 text-teal-900 font-medium' : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div>
                    <div className="font-semibold">Patient Portal View</div>
                    <div className="text-[11px] text-slate-500">Self-service booking with the AI assistant</div>
                  </div>
                  {currentRole === 'patient' && <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />}
                </button>

                {onLogout && (
                  <div className="pt-2 mt-2 border-t border-slate-100">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2 p-2 text-left rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4 text-red-500" />
                      <span>Logout from Portal</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Open the patient portal */}
        {onSwitchPortal && (
          <button
            onClick={onSwitchPortal}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200/80 rounded-lg transition-colors"
            title="Open the Patient Portal"
          >
            <Globe className="w-3.5 h-3.5 text-teal-600" />
            <span>Patient Portal</span>
          </button>
        )}

        {/* Prominent Portal Logout Button */}
        {onLogout && (
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200/80 rounded-lg transition-colors shadow-2xs"
            title="Logout from Portal"
          >
            <LogOut className="w-3.5 h-3.5 text-red-600" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        )}
      </div>
    </header>
  );
};
