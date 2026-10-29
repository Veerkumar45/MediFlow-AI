import React from 'react';
import {
  LayoutDashboard,
  CalendarCheck2,
  Users,
  Bot,
  Zap,
  BarChart3,
  FileText,
  Settings,
  Activity,
  HeartHandshake,
  MessageSquare,
  LogOut,
  Globe
} from 'lucide-react';
import { UserRole } from '../../types/index.ts';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  currentRole: UserRole;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onLogout?: () => void;
  onSwitchPortal?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  currentRole,
  isMobileOpen,
  onCloseMobile,
  onLogout,
  onSwitchPortal
}) => {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, roles: ['admin', 'receptionist'] },
    { id: 'appointments', label: 'Appointments', icon: CalendarCheck2, roles: ['admin', 'receptionist'] },
    { id: 'patients', label: 'Patients', icon: Users, roles: ['admin', 'receptionist'] },
    { id: 'inquiries', label: 'Inquiries', icon: MessageSquare, roles: ['admin', 'receptionist'] },
    { id: 'receptionist', label: 'AI Receptionist', icon: Bot, roles: ['admin', 'receptionist'] },
    { id: 'automations', label: 'Automation Center', icon: Zap, roles: ['admin'] },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, roles: ['admin'] },
    { id: 'reports', label: 'AI Reports', icon: FileText, roles: ['admin'] },
    { id: 'settings', label: 'Clinic Settings', icon: Settings, roles: ['admin'] }
  ];

  // Filter allowed items for current role
  const visibleItems = navItems.filter((item) => item.roles.includes(currentRole));

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-40 w-64 bg-[#142D4E] text-slate-300 flex flex-col transition-transform duration-200 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-800/80">
          <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
              <span>MediFlow</span>
              <span className="text-xs px-1.5 py-0.2 bg-teal-500/20 text-teal-300 rounded font-semibold">AI</span>
            </div>
            <div className="text-[11px] text-slate-400">
              {currentRole === 'admin' ? 'Clinic Admin Console' : 'Receptionist Portal'}
            </div>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}

          <div className="pt-4 mt-4 border-t border-slate-800/80 space-y-1">
            {onSwitchPortal && (
              <button
                onClick={() => {
                  onSwitchPortal();
                  onCloseMobile();
                }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium text-teal-300 hover:text-white hover:bg-slate-800/60 transition-all"
              >
                <Globe className="w-4 h-4 shrink-0 text-teal-400" />
                <span className="truncate">Patient Portal</span>
              </button>
            )}

            {/* Logout button (rendered for Admin and Receptionist) */}
            {onLogout && (
              <button
                onClick={() => {
                  onLogout();
                  onCloseMobile();
                }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold text-red-300 hover:text-white hover:bg-red-500/20 border border-red-500/30 transition-all mt-2"
              >
                <LogOut className="w-4 h-4 shrink-0 text-red-400" />
                <span>Logout</span>
              </button>
            )}
          </div>
        </nav>

        {/* Footer info badge */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/40">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="truncate">Harmony Health Clinic</span>
            <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono">v1.0</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 truncate">
            {currentRole === 'admin'
              ? 'Administrator Mode'
              : 'Front Desk Mode'}
          </div>
        </div>
      </aside>
    </>
  );
};
