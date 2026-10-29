import React, { useState } from 'react';
import {
  MessageSquare,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  Send,
  Plus,
  User,
  Bot,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { Inquiry, InquiryCategory, InquiryPriority } from '../../types/index.ts';
import { api } from '../../services/api.ts';
import { useToast } from '../common/Toast.tsx';

interface InquiryManagerProps {
  inquiries: Inquiry[];
  onRefresh: () => void;
}

export const InquiryManager: React.FC<InquiryManagerProps> = ({ inquiries, onRefresh }) => {
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');

  // Selected inquiry for detail/response modal
  const [viewingInquiry, setViewingInquiry] = useState<Inquiry | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  // New Inquiry Modal State
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientContact, setNewPatientContact] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [isClassifying, setIsClassifying] = useState(false);

  const filteredInquiries = inquiries.filter((inq) => {
    if (selectedCategory !== 'all' && inq.category !== selectedCategory) return false;
    if (selectedStatus !== 'all' && inq.status !== selectedStatus) return false;
    if (selectedPriority !== 'all' && inq.priority !== selectedPriority) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = inq.patientName.toLowerCase().includes(q);
      const matchContact = inq.patientContact.toLowerCase().includes(q);
      const matchMsg = inq.message.toLowerCase().includes(q);
      if (!matchName && !matchContact && !matchMsg) return false;
    }

    return true;
  });

  // Handle status update
  const handleUpdateStatus = async (id: string, status: Inquiry['status']) => {
    try {
      await api.updateInquiry(id, {
        status,
        resolvedAt: status === 'Resolved' ? new Date().toISOString() : undefined
      });
      showToast(`Inquiry marked as ${status}.`, 'success');
      onRefresh();
      if (viewingInquiry?.id === id) {
        setViewingInquiry(null);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update inquiry status', 'error');
    }
  };

  // Submit reply and mark resolved
  const handleSendReply = async () => {
    if (!viewingInquiry) return;
    setIsSubmittingReply(true);
    try {
      await api.updateInquiry(viewingInquiry.id, {
        status: 'Resolved',
        aiSuggestedResponse: replyText,
        resolvedAt: new Date().toISOString()
      });
      showToast(`Reply logged and inquiry resolved for ${viewingInquiry.patientName}.`, 'success');
      setViewingInquiry(null);
      setReplyText('');
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to send reply', 'error');
    } finally {
      setIsSubmittingReply(false);
    }
  };

  // Log new inquiry (runs Gemini classifier automatically on server)
  const handleCreateInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatientName.trim() || !newMessage.trim()) {
      showToast('Patient name and message are required.', 'error');
      return;
    }

    setIsClassifying(true);
    try {
      const created = await api.createInquiry({
        patientName: newPatientName,
        patientContact: newPatientContact,
        message: newMessage
      });
      showToast(`Inquiry logged and classified as "${created.category}" (${created.priority} priority).`, 'success');
      setIsNewModalOpen(false);
      setNewPatientName('');
      setNewPatientContact('');
      setNewMessage('');
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to log inquiry', 'error');
    } finally {
      setIsClassifying(false);
    }
  };

  const getPriorityBadge = (priority: InquiryPriority) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'high':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'medium':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'low':
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getStatusBadge = (status: Inquiry['status']) => {
    switch (status) {
      case 'Resolved':
        return 'bg-emerald-50 text-emerald-700';
      case 'In Progress':
        return 'bg-blue-50 text-blue-700';
      case 'Escalated':
        return 'bg-red-50 text-red-700';
      case 'New':
      default:
        return 'bg-amber-50 text-amber-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Patient Inquiries & Triage</h1>
          <p className="text-sm text-slate-500 mt-1">
            Automated intake, semantic classification, priority scoring, and clinical nurse routing.
          </p>
        </div>

        <button
          onClick={() => setIsNewModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Log Incoming Inquiry</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search inquiries by patient name, message, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="w-44 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600"
        >
          <option value="all">All Categories</option>
          <option value="Appointment">Appointment</option>
          <option value="Clinic Information">Clinic Information</option>
          <option value="Billing">Billing</option>
          <option value="Service Inquiry">Service Inquiry</option>
          <option value="General Question">General Question</option>
          <option value="Human Assistance Required">Human Assistance</option>
        </select>

        <select
          value={selectedPriority}
          onChange={(e) => setSelectedPriority(e.target.value)}
          className="w-36 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600"
        >
          <option value="all">All Priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="w-36 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600"
        >
          <option value="all">All Statuses</option>
          <option value="New">New</option>
          <option value="In Progress">In Progress</option>
          <option value="Resolved">Resolved</option>
          <option value="Escalated">Escalated</option>
        </select>

        {(selectedCategory !== 'all' || selectedPriority !== 'all' || selectedStatus !== 'all' || searchQuery) && (
          <button
            onClick={() => {
              setSelectedCategory('all');
              setSelectedPriority('all');
              setSelectedStatus('all');
              setSearchQuery('');
            }}
            className="px-3 py-2 text-xs text-slate-500 hover:text-slate-800 font-medium"
          >
            Reset
          </button>
        )}
      </div>

      {/* Inquiries List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="divide-y divide-slate-100">
          {filteredInquiries.length > 0 ? (
            filteredInquiries.map((inq) => (
              <div
                key={inq.id}
                onClick={() => {
                  setViewingInquiry(inq);
                  setReplyText(inq.aiSuggestedResponse || '');
                }}
                className="p-4 hover:bg-slate-50/80 cursor-pointer transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1.5 flex-1 max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{inq.patientName}</span>
                    <span className="text-slate-400 font-mono">({inq.patientContact})</span>
                    <span className={`px-2 py-0.5 rounded border text-[10px] font-semibold uppercase ${getPriorityBadge(inq.priority)}`}>
                      {inq.priority}
                    </span>
                    <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                      {inq.category}
                    </span>
                    {inq.aiAssisted && (
                      <span className="flex items-center gap-1 text-[10px] text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded font-semibold">
                        <Sparkles className="w-3 h-3 text-teal-600" />
                        <span>AI Triaged</span>
                      </span>
                    )}
                  </div>

                  <p className="text-slate-700 text-sm line-clamp-2 leading-relaxed">{inq.message}</p>

                  <div className="text-[11px] text-slate-400 font-mono flex items-center gap-3">
                    <span>Assigned: {inq.assignedTo || 'Front Desk'}</span>
                    <span>·</span>
                    <span>Received: {new Date(inq.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex items-center sm:flex-col items-end gap-2 shrink-0">
                  <span className={`px-2.5 py-1 rounded text-xs font-semibold ${getStatusBadge(inq.status)}`}>
                    {inq.status}
                  </span>
                  <span className="text-teal-600 font-medium hover:underline flex items-center gap-1">
                    <span>View / Reply</span> <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="py-16 text-center text-sm text-slate-400">
              No inquiries match the current filter criteria.
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
          Showing {filteredInquiries.length} of {inquiries.length} patient inquiries
        </div>
      </div>

      {/* Inquiry Detail & Reply Modal */}
      {viewingInquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">{viewingInquiry.patientName}</h3>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${getPriorityBadge(viewingInquiry.priority)}`}>
                    {viewingInquiry.priority}
                  </span>
                </div>
                <div className="text-xs text-slate-500 font-mono mt-0.5">{viewingInquiry.patientContact}</div>
              </div>
              <button onClick={() => setViewingInquiry(null)} className="text-slate-400 hover:text-slate-600 p-1">
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              {/* Original Message */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 font-semibold uppercase tracking-wider block text-[10px] mb-1">
                  Patient Inquiry:
                </span>
                <p className="text-sm text-slate-800 leading-relaxed">{viewingInquiry.message}</p>
              </div>

              {/* AI Classification Info */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-teal-50/50 rounded-xl border border-teal-100 text-slate-700">
                <div>
                  <span className="text-teal-800 font-semibold block text-[10px] uppercase">Category</span>
                  <span className="font-medium text-slate-900">{viewingInquiry.category}</span>
                </div>
                <div>
                  <span className="text-teal-800 font-semibold block text-[10px] uppercase">Assigned Queue</span>
                  <span className="font-medium text-slate-900">{viewingInquiry.assignedTo || 'Front Desk'}</span>
                </div>
              </div>

              {/* AI Suggested Response */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                    <span>Response Drafting (Gemini Assisted)</span>
                  </label>
                  <span className="text-[10px] text-slate-400">Edit before confirming</span>
                </div>
                <textarea
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Draft response message to patient..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600 leading-relaxed"
                />
              </div>

              {/* Status Update Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <span className="text-[11px] font-semibold text-slate-500 mr-2">Quick Status:</span>
                <button
                  type="button"
                  onClick={() => handleUpdateStatus(viewingInquiry.id, 'In Progress')}
                  className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
                >
                  Mark In Progress
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateStatus(viewingInquiry.id, 'Escalated')}
                  className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded transition-colors"
                >
                  Escalate to Nurse
                </button>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setViewingInquiry(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSendReply}
                disabled={isSubmittingReply || !replyText.trim()}
                className="px-5 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmittingReply ? 'Sending...' : 'Send Reply & Resolve'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Inquiry Intake Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Log Patient Inquiry</h3>
              <button onClick={() => setIsNewModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateInquiry} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Patient Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Robert Martin"
                  value={newPatientName}
                  onChange={(e) => setNewPatientName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone or Email</label>
                <input
                  type="text"
                  placeholder="+1 (217) 555-0199 or email@example.com"
                  value={newPatientContact}
                  onChange={(e) => setNewPatientContact(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Inquiry / Patient Request *</label>
                <textarea
                  rows={3}
                  placeholder="Detail the patient question or administrative request..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600"
                />
              </div>

              <div className="p-3 bg-teal-50 border border-teal-200/80 rounded-xl text-xs text-teal-900 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                <span>
                  MediFlow AI will automatically classify this message, assign priority, and suggest a response.
                </span>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isClassifying}
                  className="px-5 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isClassifying ? 'animate-spin' : ''}`} />
                  <span>{isClassifying ? 'Analyzing with Gemini...' : 'Classify & Submit'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
