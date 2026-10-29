import React, { useState } from 'react';
import {
  CalendarCheck2,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Bot,
  Plus,
  UserPlus,
  FileText,
  Sparkles,
  ArrowUpRight,
  TrendingUp,
  Activity,
  ArrowRight
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';
import { Appointment, Inquiry, AutomationExecution } from '../../types/index.ts';

interface OverviewDashboardProps {
  analytics: {
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
  } | null;
  appointments: Appointment[];
  inquiries: Inquiry[];
  executions: AutomationExecution[];
  onOpenAddAppointment: () => void;
  onOpenAddPatient: () => void;
  onOpenReceptionist: () => void;
  onOpenGenerateReport: () => void;
  onNavigate: (tab: string) => void;
  onUpdateAppointmentStatus: (id: string, status: Appointment['status']) => void;
}

const STATUS_COLORS = {
  Confirmed: '#0D9488', // Teal
  Completed: '#10B981', // Emerald
  Pending: '#F59E0B',   // Amber
  Cancelled: '#EF4444', // Red
  'No-show': '#64748B'   // Slate
};

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  analytics,
  appointments,
  inquiries,
  executions,
  onOpenAddAppointment,
  onOpenAddPatient,
  onOpenReceptionist,
  onOpenGenerateReport,
  onNavigate,
  onUpdateAppointmentStatus
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const todayAppointments = appointments.filter((a) => a.date === todayStr);

  // Status donut data
  const statusData = [
    { name: 'Confirmed', value: analytics?.confirmed || 0, color: STATUS_COLORS.Confirmed },
    { name: 'Completed', value: analytics?.completedVisits || 0, color: STATUS_COLORS.Completed },
    { name: 'Pending', value: analytics?.pendingRequests || 0, color: STATUS_COLORS.Pending },
    { name: 'Cancelled', value: analytics?.cancellations || 0, color: STATUS_COLORS.Cancelled },
    { name: 'No-show', value: analytics?.noShows || 0, color: STATUS_COLORS['No-show'] }
  ].filter((d) => d.value > 0);

  // Top services for horizontal bar chart
  const topServicesData = (analytics?.mostRequestedServices || []).slice(0, 5);

  // Inquiry categories
  const inquiryCategoriesData = analytics?.inquiryCategoryBreakdown || [];

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Practice Operations Overview</h1>
            <span className="text-xs font-semibold px-2 py-0.5 bg-teal-50 text-teal-700 rounded-md">Live</span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Harmony Health Clinic real-time appointment flow, AI receptionist triaging, and automated workflows.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={onOpenAddAppointment}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Appointment</span>
          </button>
          <button
            onClick={onOpenAddPatient}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Patient</span>
          </button>
          <button
            onClick={onOpenReceptionist}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <Bot className="w-4 h-4 text-teal-600" />
            <span>AI Receptionist</span>
          </button>
          <button
            onClick={onOpenGenerateReport}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <FileText className="w-4 h-4" />
            <span>Daily Report</span>
          </button>
        </div>
      </div>

      {/* 6 Top Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Appointments */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Visits</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <CalendarCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {analytics?.totalAppointments ?? appointments.length}
          </div>
          <div className="mt-1 text-xs text-slate-500 flex items-center gap-1">
            <span className="text-emerald-600 font-medium">+12%</span>
            <span>vs last period</span>
          </div>
        </div>

        {/* Today's Appointments */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Today's Visits</span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {todayAppointments.length}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            <span>{todayAppointments.filter((a) => a.status === 'Confirmed').length} confirmed today</span>
          </div>
        </div>

        {/* Pending Requests */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Pending Requests</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {analytics?.pendingRequests ?? 0}
          </div>
          <div className="mt-1 text-xs text-amber-600 font-medium">
            <span>Awaiting confirmation</span>
          </div>
        </div>

        {/* Completed Visits */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Completed Visits</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {analytics?.completedVisits ?? 0}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            <span className="text-emerald-600 font-medium">{analytics?.completionRate}%</span> completion rate
          </div>
        </div>

        {/* Cancellation Rate */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Cancellation Rate</span>
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {analytics?.cancellationRate ?? 0}%
          </div>
          <div className="mt-1 text-xs text-slate-500">
            <span>{analytics?.cancellations} cancelled</span>
          </div>
        </div>

        {/* AI-Handled Inquiries */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">AI Inquiries</span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {analytics?.aiHandledInquiries ?? 0}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            <span className="text-teal-600 font-medium">{analytics?.aiResolutionRate}%</span> automated resolution
          </div>
        </div>
      </div>

      {/* Visualizations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Appointment Trends Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Weekly Appointment Trends</h2>
              <p className="text-xs text-slate-500">Scheduled visits, completions, and cancellations over time</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-600" /> Total
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Completed
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400" /> Cancelled
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics?.weeklyTrends || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="trendTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0D9488" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#0D9488" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="trendCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickFormatter={(val) => val.slice(5)}
                />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1E293B', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="total" stroke="#0D9488" strokeWidth={2} fillOpacity={1} fill="url(#trendTotal)" name="Total" />
                <Area type="monotone" dataKey="completed" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#trendCompleted)" name="Completed" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Appointment Status Distribution Donut */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Status Distribution</h2>
            <p className="text-xs text-slate-500">Breakdown of all 50 recorded appointments</p>
          </div>

          <div className="h-52 w-full flex items-center justify-center my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1E293B', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {statusData.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="truncate">{item.name}:</span>
                <span className="font-semibold text-slate-900 tabular-nums">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Services & Inquiries Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Requested Services */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Most Requested Healthcare Services</h2>
              <p className="text-xs text-slate-500">Patient demand across clinical offerings</p>
            </div>
            <button
              onClick={() => onNavigate('appointments')}
              className="text-xs font-medium text-teal-600 hover:text-teal-700 flex items-center gap-1"
            >
              View bookings <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {topServicesData.map((srv, idx) => {
              const maxCount = topServicesData[0]?.count || 1;
              const pct = Math.round((srv.count / maxCount) * 100);
              return (
                <div key={srv.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 truncate">{srv.name}</span>
                    <span className="font-semibold text-slate-900 tabular-nums">{srv.count} visits</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-teal-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI Inquiry Categories */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">AI Receptionist Inquiries</h2>
              <p className="text-xs text-slate-500">Automated classification categories</p>
            </div>
            <button
              onClick={() => onNavigate('receptionist')}
              className="text-xs font-medium text-teal-600 hover:text-teal-700 flex items-center gap-1"
            >
              Open Receptionist <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={inquiryCategoriesData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey="category"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: '#64748B' }}
                  angle={-20}
                  textAnchor="end"
                />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1E293B', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="count" fill="#38BDF8" radius={[4, 4, 0, 0]} name="Inquiries" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Today's Schedule & Automation Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Appointment Schedule */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Today's Appointment Schedule</h2>
              <p className="text-xs text-slate-500">{todayAppointments.length} patient visits scheduled for today</p>
            </div>
            <button
              onClick={() => onNavigate('appointments')}
              className="text-xs font-semibold text-teal-600 hover:text-teal-700"
            >
              Full Calendar
            </button>
          </div>

          {todayAppointments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                    <th className="pb-3 font-semibold">Time</th>
                    <th className="pb-3 font-semibold">Patient</th>
                    <th className="pb-3 font-semibold">Doctor</th>
                    <th className="pb-3 font-semibold">Service</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold text-right">Quick Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {todayAppointments.map((appt) => (
                    <tr key={appt.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 font-mono text-xs font-medium text-slate-900 tabular-nums">
                        {appt.startTime} - {appt.endTime}
                      </td>
                      <td className="py-3 font-medium text-slate-800">
                        {appt.patientName}
                        <div className="text-[11px] text-slate-400 font-mono">{appt.bookingReference}</div>
                      </td>
                      <td className="py-3 text-xs text-slate-600">{appt.doctorName}</td>
                      <td className="py-3 text-xs text-slate-600 truncate max-w-[140px]">{appt.serviceName}</td>
                      <td className="py-3">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-md font-medium inline-block ${
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
                      </td>
                      <td className="py-3 text-right">
                        {appt.status === 'Pending' ? (
                          <button
                            onClick={() => onUpdateAppointmentStatus(appt.id, 'Confirmed')}
                            className="px-2.5 py-1 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded transition-colors"
                          >
                            Confirm
                          </button>
                        ) : appt.status === 'Confirmed' ? (
                          <button
                            onClick={() => onUpdateAppointmentStatus(appt.id, 'Completed')}
                            className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                          >
                            Complete
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-slate-400">
              No appointments scheduled for today.
            </div>
          )}
        </div>

        {/* AI Automation Activity Log Feed */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Automation Activity</h2>
                <p className="text-xs text-slate-500">Live background workflow executions</p>
              </div>
              <button
                onClick={() => onNavigate('automations')}
                className="text-xs font-semibold text-teal-600 hover:text-teal-700"
              >
                Center
              </button>
            </div>

            <div className="space-y-3">
              {executions.slice(0, 5).map((exec) => (
                <div key={exec.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                  <div className="flex items-center justify-between font-medium">
                    <span className="text-slate-900">{exec.ruleName}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        exec.status === 'Success'
                          ? 'bg-emerald-100 text-emerald-800'
                          : exec.status === 'Warning'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {exec.status}
                    </span>
                  </div>
                  <p className="text-slate-600 mt-1 line-clamp-2">{exec.details}</p>
                  <div className="mt-1.5 text-[10px] text-slate-400 font-mono">
                    {new Date(exec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => onNavigate('automations')}
            className="w-full mt-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center justify-center gap-1.5"
          >
            <span>View All Automation Rules</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
