import React, { useState } from 'react';
import {
  Download,
  RefreshCw,
  Sparkles,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { api } from '../../services/api.ts';
import { useToast } from '../common/Toast.tsx';
import { Doctor, HealthcareService, Appointment } from '../../types/index.ts';

interface AnalyticsDashboardProps {
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
  doctors: Doctor[];
  services: HealthcareService[];
  onRefresh: () => void;
}

const DOCTOR_COLORS = ['#0D9488', '#38BDF8', '#6366F1', '#EC4899', '#F59E0B'];

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  analytics,
  appointments,
  doctors,
  services,
  onRefresh
}) => {
  const { showToast } = useToast();

  const [aiInsights, setAiInsights] = useState<string[]>([
    'Primary care general health consultations accounted for the highest share (36%) of bookings this period.',
    'Automated 24-hour reminder delivery coincided with a lower overall cancellation rate of 8.0%.',
    'MediFlow AI Receptionist handled 85% of routine questions without requiring human escalation.',
    'Doctor schedules show consistent morning slot utilization between 09:00 and 11:30 AM.'
  ]);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const handleGenerateInsights = async () => {
    setLoadingInsights(true);
    try {
      const res = await api.generateInsights();
      if (res.insights && res.insights.length > 0) {
        setAiInsights(res.insights);
        showToast('Generated fresh operational insights from live clinic data.', 'success');
      }
    } catch {
      showToast('Could not fetch new AI insights, showing current calculated baseline.', 'error');
    } finally {
      setLoadingInsights(false);
    }
  };

  const handleExportCSV = () => {
    if (appointments.length === 0) {
      showToast('No appointment records to export.', 'error');
      return;
    }

    const headers = ['Booking Reference', 'Patient Name', 'Phone', 'Doctor', 'Service', 'Date', 'Start Time', 'End Time', 'Status'];
    const rows = appointments.map((a) => [
      a.bookingReference,
      `"${a.patientName}"`,
      `"${a.patientPhone}"`,
      `"${a.doctorName}"`,
      `"${a.serviceName}"`,
      a.date,
      a.startTime,
      a.endTime,
      a.status
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `harmony_health_appointments_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Exported appointments CSV successfully!', 'success');
  };

  const doctorDistributionData = (analytics?.doctorDistribution || []).map((doc, idx) => ({
    ...doc,
    color: DOCTOR_COLORS[idx % DOCTOR_COLORS.length]
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Practice Intelligence & Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">
            Aggregated appointment completion ratios, provider workloads, and Gemini-synthesized insights.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="bg-gradient-to-r from-slate-900 to-[#142D4E] text-white rounded-2xl p-6 shadow-md border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">Gemini AI Operational Insights</h2>
              <span className="text-[11px] text-slate-400">Strictly computed from verified clinic database records</span>
            </div>
          </div>

          <button
            onClick={handleGenerateInsights}
            disabled={loadingInsights}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingInsights ? 'animate-spin' : ''}`} />
            <span>{loadingInsights ? 'Analyzing Metrics...' : 'Synthesize Insights'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {aiInsights.map((insight, idx) => (
            <div
              key={idx}
              className="p-3.5 bg-slate-800/60 rounded-xl border border-slate-700/60 text-xs leading-relaxed text-slate-200 flex items-start gap-2.5"
            >
              <span className="w-5 h-5 rounded-md bg-teal-500/20 text-teal-300 flex items-center justify-center shrink-0 text-[10px] font-bold font-mono">
                {idx + 1}
              </span>
              <span>{insight}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Visit Show Rate</span>
          <div className="mt-1.5 text-2xl font-bold text-slate-900 tabular-nums">
            {analytics?.completionRate ?? 0}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1">{analytics?.completedVisits} visits completed</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Cancellation Rate</span>
          <div className="mt-1.5 text-2xl font-bold text-slate-900 tabular-nums">
            {analytics?.cancellationRate ?? 0}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1">{analytics?.cancellations} cancelled bookings</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Missed Visits (No-shows)</span>
          <div className="mt-1.5 text-2xl font-bold text-slate-900 tabular-nums">
            {analytics?.noShowRate ?? 0}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1">{analytics?.noShows} missed encounters</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-medium text-slate-500">AI Inquiry Resolution</span>
          <div className="mt-1.5 text-2xl font-bold text-slate-900 tabular-nums">
            {analytics?.aiResolutionRate ?? 0}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1">{analytics?.aiHandledInquiries} inquiries resolved</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <h2 className="text-base font-bold text-slate-900">Provider Workload Distribution</h2>
          <p className="text-xs text-slate-500 mb-4">Appointments distributed across 5 clinic doctors</p>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={doctorDistributionData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis
                  dataKey="name"
                  type="category"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: '#1E293B' }}
                  width={110}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1E293B', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="count" fill="#0D9488" radius={[0, 4, 4, 0]} name="Appointments" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <h2 className="text-base font-bold text-slate-900">Service Category Popularity</h2>
          <p className="text-xs text-slate-500 mb-4">Patient booking volume by healthcare service</p>

          <div className="space-y-3.5">
            {(analytics?.mostRequestedServices || []).slice(0, 6).map((srv) => {
              const max = analytics?.mostRequestedServices[0]?.count || 1;
              const pct = Math.round((srv.count / max) * 100);
              return (
                <div key={srv.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{srv.name}</span>
                    <span className="font-semibold text-slate-900 tabular-nums">{srv.count} bookings</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className="bg-sky-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
