import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  User,
  Sparkles,
  CalendarCheck,
  AlertTriangle,
  RefreshCw,
  Clock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Stethoscope,
  DollarSign,
  Activity
} from 'lucide-react';
import { api } from '../../services/api.ts';
import { useToast } from '../common/Toast.tsx';
import { PendingBookingProposal, ExecutedToolLog } from '../../types/index.ts';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  category?: string;
  timestamp: string;
  executedTools?: ExecutedToolLog[];
  pendingBooking?: PendingBookingProposal;
  isConfirmed?: boolean;
  isDeclined?: boolean;
}

interface AIReceptionistViewProps {
  onOpenBookAppointment?: () => void;
  onAppointmentBooked?: () => void;
}

export const AIReceptionistView: React.FC<AIReceptionistViewProps> = ({
  onOpenBookAppointment,
  onAppointmentBooked
}) => {
  const { showToast } = useToast();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init-1',
      role: 'assistant',
      content:
        'Hello! I am MediFlow AI, the healthcare receptionist for Harmony Health Clinic. I can check real-time doctor availability, assist with appointment booking, provide service fee details, and guide you through clinic policies.\n\nHow may I help you today?',
      category: 'Clinic Information',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirmingBooking, setIsConfirmingBooking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestedQuestions = [
    'Check Dr. Sarah Mitchell availability tomorrow',
    'Do you have available consultation slots tomorrow morning?',
    'Book an Annual Preventive Wellness Exam for tomorrow 10:00 AM',
    'How much does an Annual Preventive Wellness Exam cost?',
    'Who is your cardiologist and what are their clinic hours?'
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, isConfirmingBooking]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await api.chatWithReceptionist(
        newHistory.map((m) => ({ role: m.role, content: m.content }))
      );

      const aiMsg: Message = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: response.reply,
        category: response.category as string,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        executedTools: response.executedTools,
        pendingBooking: response.pendingBooking
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      showToast('Could not reach Gemini service. Using clinical fallback response.', 'error');
      const fallbackMsg: Message = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content:
          'Harmony Health Clinic is open Mon-Fri 8:30 AM to 5:30 PM and Sat 9:00 AM to 1:00 PM. For appointment booking or urgent questions, our front desk staff can be reached at +1 (217) 555-0199.',
        category: 'Clinic Information',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmBooking = async (msgId: string, proposal: PendingBookingProposal) => {
    setIsConfirmingBooking(true);
    try {
      // Create confirmed appointment in real DB
      const created = await api.createAppointment({
        patientName: proposal.patientName,
        patientPhone: proposal.patientPhone,
        patientEmail: proposal.patientEmail || '',
        doctorId: proposal.doctorId,
        doctorName: proposal.doctorName,
        serviceId: proposal.serviceId,
        serviceName: proposal.serviceName,
        date: proposal.date,
        startTime: proposal.startTime,
        durationMinutes: proposal.durationMinutes,
        status: 'Confirmed',
        notes: proposal.notes || 'Booked and confirmed via MediFlow AI Receptionist'
      });

      // Mark message as confirmed
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, isConfirmed: true } : m))
      );

      showToast(`Appointment confirmed! Booking Ref: ${created.bookingReference}`, 'success');

      // Append confirmation message to chat
      const confirmationMsg: Message = {
        id: `msg-confirm-${Date.now()}`,
        role: 'assistant',
        content: `🎉 **Appointment Confirmed!**\n\n• **Booking Reference:** \`${created.bookingReference}\`\n• **Doctor:** ${created.doctorName}\n• **Service:** ${created.serviceName} ($${proposal.consultationFee})\n• **Date & Time:** ${created.date} at ${created.startTime} (${created.durationMinutes} mins)\n• **Patient:** ${created.patientName} (${created.patientPhone})\n\nA pre-visit reminder will automatically be dispatched 24 hours prior to your consultation.`,
        category: 'Appointment',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, confirmationMsg]);
      onAppointmentBooked?.();
    } catch (err: any) {
      showToast(err.message || 'Failed to confirm booking.', 'error');
    } finally {
      setIsConfirmingBooking(false);
    }
  };

  const handleDeclineBooking = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, isDeclined: true } : m))
    );

    const cancelledMsg: Message = {
      id: `msg-declined-${Date.now()}`,
      role: 'assistant',
      content:
        'Booking proposal cancelled. No changes have been made to our appointment calendar. Let me know if you would like to select another specialist or alternate time!',
      category: 'Appointment',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages((prev) => [...prev, cancelledMsg]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto h-[calc(100vh-140px)] flex flex-col">
      {/* Header and Safety Badge */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900">MediFlow AI Receptionist</h1>
              <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                Gemini 3.8 Flash Grounded
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Real-time schedule validation, structured booking staging, inquiry classification, and triage escalation.
            </p>
          </div>
        </div>

        {/* Emergency boundary callout */}
        <div className="flex items-center gap-2 bg-amber-50/70 border border-amber-200/80 px-3 py-1.5 rounded-xl text-xs text-amber-900">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>For acute chest pain, trauma, or medical emergency, call <strong>911</strong> immediately.</span>
        </div>
      </div>

      {/* Chat Messages Container */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 overflow-y-auto space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div
              className={`max-w-2xl rounded-2xl p-4 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#142D4E] text-white rounded-tr-none'
                  : 'bg-slate-50 text-slate-800 border border-slate-200/70 rounded-tl-none'
              }`}
            >
              <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                {msg.content}
              </div>

              {/* Render Executed Tool Badges */}
              {msg.executedTools && msg.executedTools.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-slate-200/60 space-y-1.5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Activity className="w-3 h-3 text-teal-600" />
                    Automated Actions Executed:
                  </div>
                  {msg.executedTools.map((t, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 text-[11px] bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/60 text-slate-700 shadow-2xs"
                    >
                      <span className="font-mono text-[9px] font-semibold bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded">
                        {t.tool}
                      </span>
                      <span className="truncate flex-1">{t.summary}</span>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">{t.timestamp}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Render Structured Booking Confirmation Card */}
              {msg.pendingBooking && !msg.isConfirmed && !msg.isDeclined && (
                <div className="mt-4 p-4 rounded-xl bg-white border-2 border-teal-500/60 shadow-sm space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-teal-700 font-bold text-xs uppercase tracking-wider">
                      <CalendarCheck className="w-4 h-4 text-teal-600" />
                      Pending Appointment Confirmation
                    </div>
                    <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                      User Consent Required
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Doctor & Specialty</div>
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5 mt-0.5">
                        <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
                        {msg.pendingBooking.doctorName}
                      </div>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Service & Fee</div>
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5 mt-0.5">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                        {msg.pendingBooking.serviceName} (${msg.pendingBooking.consultationFee})
                      </div>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Date & Time</div>
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5 mt-0.5">
                        <Clock className="w-3.5 h-3.5 text-blue-600" />
                        {msg.pendingBooking.date} at {msg.pendingBooking.startTime} ({msg.pendingBooking.durationMinutes}m)
                      </div>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Patient Information</div>
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5 mt-0.5">
                        <User className="w-3.5 h-3.5 text-purple-600" />
                        {msg.pendingBooking.patientName} ({msg.pendingBooking.patientPhone})
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 italic">
                    Note: To prevent unauthorized schedule changes, MediFlow AI requires your explicit confirmation before adding this appointment to the clinic calendar.
                  </p>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleConfirmBooking(msg.id, msg.pendingBooking!)}
                      disabled={isConfirmingBooking}
                      className="flex-1 py-2 px-3 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      {isConfirmingBooking ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      <span>Confirm & Book Appointment</span>
                    </button>

                    <button
                      onClick={() => handleDeclineBooking(msg.id)}
                      disabled={isConfirmingBooking}
                      className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <XCircle className="w-4 h-4 text-slate-500" />
                      <span>Decline</span>
                    </button>
                  </div>
                </div>
              )}

              {msg.isConfirmed && (
                <div className="mt-3 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>This booking was successfully confirmed and added to the clinic calendar.</span>
                </div>
              )}

              {msg.isDeclined && (
                <div className="mt-3 p-2.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 text-xs flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>This booking proposal was declined by the user.</span>
                </div>
              )}

              <div className="mt-2 flex items-center justify-between text-[10px] opacity-75">
                <span className="font-mono">{msg.timestamp}</span>
                {msg.category && (
                  <span className="font-semibold uppercase tracking-wider text-[9px] bg-slate-200/50 px-1.5 py-0.5 rounded">
                    {msg.category}
                  </span>
                )}
              </div>
            </div>

            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-lg bg-slate-800 text-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-start gap-3 justify-start">
            <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-slate-50 text-slate-600 border border-slate-200/70 rounded-2xl rounded-tl-none p-4 text-xs flex items-center gap-2 shadow-2xs">
              <RefreshCw className="w-4 h-4 animate-spin text-teal-600" />
              <span>MediFlow AI is validating real schedule availability and executing clinic tools...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested prompts strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 shrink-0">
        <span className="text-[11px] font-semibold text-slate-400 shrink-0 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-teal-600" /> Suggested:
        </span>
        {suggestedQuestions.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(q)}
            disabled={isLoading}
            className="px-3 py-1.5 text-xs text-slate-600 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-lg whitespace-nowrap transition-colors shrink-0"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input box */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-xs flex items-end gap-3 shrink-0">
        <textarea
          rows={2}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask MediFlow AI about doctor schedules, book an appointment, or check clinic policies... (Press Enter to send)"
          className="flex-1 bg-transparent border-0 outline-none resize-none text-sm text-slate-800 placeholder-slate-400 p-1"
        />
        <div className="flex items-center gap-2">
          {onOpenBookAppointment && (
            <button
              onClick={onOpenBookAppointment}
              className="px-3 py-2 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors flex items-center gap-1.5"
              title="Open full booking form"
            >
              <CalendarCheck className="w-4 h-4" />
              <span className="hidden sm:inline">Book Portal</span>
            </button>
          )}

          <button
            onClick={() => handleSendMessage()}
            disabled={!inputValue.trim() || isLoading}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <span>Send</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
