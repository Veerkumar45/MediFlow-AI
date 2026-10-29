import React, { useState } from 'react';
import {
  FileText,
  Sparkles,
  Download,
  Printer,
  Calendar,
  CheckCircle2,
  TrendingUp,
  AlertCircle,
  Clock,
  ArrowRight
} from 'lucide-react';
import { ClinicReport } from '../../types/index.ts';
import { api } from '../../services/api.ts';
import { useToast } from '../common/Toast.tsx';

interface ReportGeneratorProps {
  reports: ClinicReport[];
  onRefresh: () => void;
}

export const ReportGenerator: React.FC<ReportGeneratorProps> = ({ reports, onRefresh }) => {
  const { showToast } = useToast();

  // Local calendar dates (toISOString() would shift the day for users outside UTC).
  const localDate = (offsetDays = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toLocaleDateString('en-CA');
  };
  const rangeFor = (type: string): [string, string] =>
    type === 'Daily Clinic Summary'
      ? [localDate(0), localDate(0)]
      : type === 'Monthly Operations Report'
        ? [localDate(-29), localDate(0)]
        : [localDate(-6), localDate(0)];

  const [reportType, setReportType] = useState<ClinicReport['reportType']>('Daily Clinic Summary');
  const [startDate, setStartDate] = useState(localDate(0));
  const [endDate, setEndDate] = useState(localDate(0));
  const [isGenerating, setIsGenerating] = useState(false);

  // Currently viewed report
  const [activeReport, setActiveReport] = useState<ClinicReport | null>(reports[0] || null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      showToast('Please select both start and end dates.', 'error');
      return;
    }

    setIsGenerating(true);
    try {
      const generated = await api.generateReport({
        reportType,
        startDate,
        endDate
      });
      setActiveReport(generated);
      showToast(`${reportType} generated.`, 'success');
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to generate report', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">AI Report Generator</h1>
          <p className="text-sm text-slate-500 mt-1">
            Produce formal executive briefings and clinical operations summaries powered by Google Gemini.
          </p>
        </div>

        {activeReport && (
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>
          </div>
        )}
      </div>

      {/* Generator Configuration Form */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
        <form onSubmit={handleGenerate} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Report Type</label>
            <select
              value={reportType}
              onChange={(e) => {
                setReportType(e.target.value as any);
                const [a, b] = rangeFor(e.target.value);
                setStartDate(a);
                setEndDate(b);
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600"
            >
              <option value="Daily Clinic Summary">Daily Clinic Summary</option>
              <option value="Weekly Appointment Report">Weekly Appointment Report</option>
              <option value="Monthly Operations Report">Monthly Operations Report</option>
              <option value="Inquiry Analysis Report">Inquiry Analysis Report</option>
              <option value="Automation Performance Report">Automation Performance Report</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={isGenerating}
              className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 shadow-xs"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>{isGenerating ? 'Synthesizing with Gemini...' : 'Generate AI Report'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Two-Column: Report Display & Report History Archive */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Report Display (Printable) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-8 border border-slate-200/80 shadow-xs print:p-0 print:border-0">
          {activeReport ? (
            <div className="space-y-6">
              {/* Document Header */}
              <div className="border-b border-slate-200 pb-5">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-teal-700 uppercase tracking-widest bg-teal-50 px-2.5 py-0.5 rounded">
                      {activeReport.reportType}
                    </span>
                    <h2 className="text-xl font-bold text-slate-900 mt-2">{activeReport.title}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Period: {activeReport.startDate} through {activeReport.endDate}
                    </p>
                  </div>
                  <div className="text-right text-[11px] text-slate-400 font-mono">
                    Generated: {new Date(activeReport.generatedAt).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Executive Summary */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Executive Briefing
                </h3>
                <p className="text-sm text-slate-800 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                  {activeReport.summary}
                </p>
              </div>

              {/* Calculated Metrics Grid */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                  Calculated Period Metrics
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.entries(activeReport.metrics).map(([k, v]) => (
                    <div key={k} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="text-[11px] text-slate-500">{k}</div>
                      <div className="text-lg font-bold text-slate-900 mt-0.5 tabular-nums">{String(v)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Operational Trends */}
              {activeReport.operationalTrends?.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Key Operational Trends
                  </h3>
                  <div className="space-y-2">
                    {activeReport.operationalTrends.map((trend, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                        <TrendingUp className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                        <span>{trend}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Key Observations */}
              {activeReport.keyObservations?.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Clinical Observations
                  </h3>
                  <div className="space-y-2">
                    {activeReport.keyObservations.map((obs, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{obs}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations & Pending Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Actionable Recommendations
                  </h3>
                  <div className="space-y-2 text-xs text-slate-700">
                    {activeReport.recommendations?.map((rec, idx) => (
                      <div key={idx} className="p-2.5 bg-teal-50/50 rounded-lg border border-teal-100">
                        {rec}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Pending Administrative Actions
                  </h3>
                  <div className="space-y-2 text-xs text-slate-700">
                    {activeReport.pendingActions?.map((act, idx) => (
                      <div key={idx} className="p-2.5 bg-amber-50/50 rounded-lg border border-amber-100">
                        {act}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center text-sm text-slate-400">
              No report selected. Use the generator above or select a historical report.
            </div>
          )}
        </div>

        {/* Report Archive List */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 mb-1">Generated Reports Archive</h2>
            <p className="text-xs text-slate-500 mb-4">Historical reports saved in database</p>

            <div className="space-y-2.5 max-h-[480px] overflow-y-auto">
              {reports.map((rep) => {
                const isSelected = activeReport?.id === rep.id;
                return (
                  <div
                    key={rep.id}
                    onClick={() => setActiveReport(rep)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-teal-50 border-teal-300 text-teal-900 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200/70 text-slate-700'
                    }`}
                  >
                    <div className="font-bold truncate">{rep.title}</div>
                    <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                      <span>{rep.reportType}</span>
                      <span className="font-mono">{new Date(rep.generatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
            Reports strictly aggregate non-identifiable clinic visit records for administrative oversight.
          </div>
        </div>
      </div>
    </div>
  );
};
