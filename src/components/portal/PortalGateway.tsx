import React from 'react';
import {
  User,
  Headphones,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Lock,
  Stethoscope,
  Clock,
  HeartPulse
} from 'lucide-react';
import { PortalType, ClinicProfile } from '../../types/index.ts';

interface PortalGatewayProps {
  clinic: ClinicProfile;
  onSelectPortal: (portal: PortalType) => void;
  isAdminAuthenticated: boolean;
}

export const PortalGateway: React.FC<PortalGatewayProps> = ({
  clinic,
  onSelectPortal,
  isAdminAuthenticated
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100/80 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Top Clinic Branding */}
      <header className="max-w-6xl mx-auto w-full flex items-center justify-between pb-6 border-b border-slate-200/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#142D4E] text-teal-400 flex items-center justify-center font-bold text-lg shadow-sm">
            <HeartPulse className="w-6 h-6 text-teal-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 tracking-tight text-lg">{clinic.name}</span>
              <span className="text-[10px] font-semibold bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full border border-teal-200">
                MediFlow AI
              </span>
            </div>
            <p className="text-xs text-slate-500">{clinic.tagline}</p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-teal-600" />
            <span>Mon–Fri: {clinic.openingHours.weekdays.start}–{clinic.openingHours.weekdays.end}</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-slate-300" />
          <span>{clinic.phone}</span>
        </div>
      </header>

      {/* Main Selection Area */}
      <main className="max-w-5xl mx-auto w-full my-auto py-8">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-200/80 text-teal-800 text-xs font-semibold mb-3 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
            Healthcare Practice Management & Reception Gateway
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Select Your Portal to Continue
          </h1>
          <p className="text-sm text-slate-600 mt-2">
            Choose the portal for patient self-service with the AI assistant, front desk reception, or administrative practice control.
          </p>
        </div>

        {/* Portal cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* 1. PATIENT PORTAL (self-service + AI assistant) */}
          <div
            onClick={() => onSelectPortal('user')}
            className="group relative bg-white rounded-2xl p-6 border-2 border-slate-200/90 hover:border-blue-500 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <User className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-semibold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full border border-blue-200">
                  Patient Self-Service
                </span>
              </div>

              <h2 className="text-lg font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                User / Patient Portal
              </h2>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Chat with the MediFlow AI assistant to find open slots and book, or book yourself, and look up an existing booking by its reference code.
              </p>

              <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>AI Assistant: find slots &amp; book by chat</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Booking Reference Lookup & Cancellation</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Pre-visit Preparation & Reminders</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 flex items-center justify-between text-xs font-semibold text-blue-700 group-hover:text-blue-800">
              <span>Enter Patient Portal</span>
              <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* 2. RECEPTIONIST PORTAL (Front-Desk Staff) */}
          <div
            onClick={() => onSelectPortal('receptionist')}
            className="group relative bg-white rounded-2xl p-6 border-2 border-slate-200/90 hover:border-purple-500 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Headphones className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-semibold bg-purple-50 text-purple-700 px-2.5 py-1 rounded-full border border-purple-200">
                  Front Desk Desk
                </span>
              </div>

              <h2 className="text-lg font-bold text-slate-900 group-hover:text-purple-700 transition-colors">
                Receptionist Portal
              </h2>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Clinic front desk operations. Oversee daily appointment schedules, check in arriving patients, manage phone inquiries, and resolve urgent triage tickets.
              </p>

              <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                  <span>Real-Time Daily Calendar & Patient Check-in</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                  <span>Inquiry Triage Queue & Escalation Tickets</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                  <span>Logout option to return to Portal Gateway</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 flex items-center justify-between text-xs font-semibold text-purple-700 group-hover:text-purple-800">
              <span>Enter Reception Desk</span>
              <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* 3. ADMIN PORTAL (Requires Username & Password) */}
          <div
            onClick={() => onSelectPortal('admin')}
            className="group relative bg-[#142D4E] rounded-2xl p-6 text-white shadow-md hover:shadow-xl transition-all duration-200 cursor-pointer flex flex-col justify-between border-2 border-slate-800 hover:border-teal-400"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-semibold bg-amber-400/20 text-amber-300 px-2.5 py-1 rounded-full border border-amber-400/30 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Password Protected
                </span>
              </div>

              <h2 className="text-lg font-bold text-white group-hover:text-teal-300 transition-colors flex items-center gap-2">
                <span>Admin Portal</span>
                {isAdminAuthenticated && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    Logged In
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                Full administrative control. Configure autonomous AI workflows, monitor clinic capacity analytics, generate grounded financial reports, and manage provider rosters.
              </p>

              <div className="mt-4 pt-3 border-t border-slate-700 space-y-1.5 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                  <span>Autonomous AI Workflows & Execution Audit</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                  <span>Clinical Analytics, Revenue & Utilization Reports</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                  <span>Requires Username & Password Verification</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 flex items-center justify-between text-xs font-semibold text-teal-300 group-hover:text-white">
              <span>{isAdminAuthenticated ? 'Resume Admin Console' : 'Access Admin Login'}</span>
              <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </main>

      {/* Footer Credentials Note */}
      <footer className="max-w-5xl mx-auto w-full pt-6 border-t border-slate-200/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <div>
          <span>{clinic.name}</span> · <span>{clinic.address}</span>
        </div>
        <div className="bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 flex items-center gap-2">
          <Lock className="w-3 h-3 text-slate-400" />
          <span>Admin Demo Credentials: <strong>admin</strong> / <strong>admin123</strong></span>
        </div>
      </footer>
    </div>
  );
};
