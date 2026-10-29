import React, { useState } from 'react';
import {
  Zap,
  Play,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Calendar,
  Bell,
  Sparkles,
  FileText,
  UserCheck,
  ArrowRight
} from 'lucide-react';
import { AutomationRule, AutomationExecution } from '../../types/index.ts';
import { api } from '../../services/api.ts';
import { useToast } from '../common/Toast.tsx';

interface AutomationCenterProps {
  automations: AutomationRule[];
  executions: AutomationExecution[];
  onRefresh: () => void;
}

export const AutomationCenter: React.FC<AutomationCenterProps> = ({
  automations,
  executions,
  onRefresh
}) => {
  const { showToast } = useToast();
  const [runningId, setRunningId] = useState<string | null>(null);

  // Toggle enable/disable
  const handleToggle = async (rule: AutomationRule) => {
    try {
      await api.updateAutomation(rule.id, { enabled: !rule.enabled });
      showToast(`${rule.name} is now ${!rule.enabled ? 'Enabled' : 'Disabled'}.`, 'success');
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to update rule', 'error');
    }
  };

  // Run Now
  const handleRunNow = async (rule: AutomationRule) => {
    setRunningId(rule.id);
    try {
      const exec = await api.runAutomation(rule.id);
      showToast(`Automation "${rule.name}" executed successfully.`, 'success');
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Execution failed', 'error');
    } finally {
      setRunningId(null);
    }
  };

  const getRuleIcon = (id: string) => {
    switch (id) {
      case 'auto-1':
        return Calendar;
      case 'auto-2':
        return Bell;
      case 'auto-3':
        return Sparkles;
      case 'auto-4':
        return FileText;
      case 'auto-5':
        return UserCheck;
      default:
        return Zap;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">AI Automation Center</h1>
          <p className="text-sm text-slate-500 mt-1">
            Autonomous clinic workflows: appointment verification, 24h reminders, semantic triage, and daily operational briefs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">
            {automations.filter((a) => a.enabled).length} of {automations.length} Active Rules
          </span>
        </div>
      </div>

      {/* 5 Automation Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {automations.map((rule) => {
          const Icon = getRuleIcon(rule.id);
          const isRunning = runningId === rule.id;

          return (
            <div
              key={rule.id}
              className={`bg-white rounded-2xl p-5 border transition-all flex flex-col justify-between shadow-xs ${
                rule.enabled ? 'border-slate-200/90' : 'border-slate-200/50 opacity-75'
              }`}
            >
              <div>
                {/* Top card bar: Icon + Enable Switch */}
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={() => handleToggle(rule)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600"></div>
                  </label>
                </div>

                {/* Title & Description */}
                <div className="mt-3.5">
                  <h3 className="text-base font-bold text-slate-900">{rule.name}</h3>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{rule.description}</p>
                </div>

                {/* Trigger detail */}
                <div className="mt-3 p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-[11px]">
                  <span className="font-semibold text-slate-700">Trigger:</span>{' '}
                  <span className="text-slate-600">{rule.trigger}</span>
                </div>

                {/* Action steps */}
                <div className="mt-3 space-y-1 text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-700 block mb-1">Configured Pipeline:</span>
                  {rule.actions.map((act, idx) => (
                    <div key={idx} className="flex items-start gap-1.5">
                      <span className="text-teal-600 font-bold">•</span>
                      <span>{act}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card Footer: Last Executed + Run Now */}
              <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs">
                <div>
                  <div className="text-[10px] text-slate-400">Total Runs: {rule.executionCount}</div>
                  <div className="text-[11px] text-slate-600 font-mono">
                    {rule.lastExecutedAt
                      ? new Date(rule.lastExecutedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : 'Never'}
                  </div>
                </div>

                <button
                  onClick={() => handleRunNow(rule)}
                  disabled={isRunning || !rule.enabled}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  <Play className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
                  <span>{isRunning ? 'Running...' : 'Run Now'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Execution History Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-base font-bold text-slate-900">Automation Execution Audit Log</h2>
            <p className="text-xs text-slate-500">Real-time trace of workflow events and status codes</p>
          </div>
          <span className="text-xs font-semibold text-teal-700 font-mono">
            {executions.length} Events Logged
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
              <tr>
                <th className="py-3 px-4 font-semibold">Workflow Rule</th>
                <th className="py-3 px-4 font-semibold">Trigger Event</th>
                <th className="py-3 px-4 font-semibold">Execution Details</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {executions.slice(0, 15).map((exec) => (
                <tr key={exec.id} className="hover:bg-slate-50/70 transition-colors text-xs">
                  <td className="py-3 px-4 font-semibold text-slate-800">{exec.ruleName}</td>
                  <td className="py-3 px-4 text-slate-600">{exec.triggerEvent}</td>
                  <td className="py-3 px-4 text-slate-600 max-w-md truncate">{exec.details}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        exec.status === 'Success'
                          ? 'bg-emerald-50 text-emerald-700'
                          : exec.status === 'Warning'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {exec.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-500 tabular-nums">
                    {new Date(exec.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
