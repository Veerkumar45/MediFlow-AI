import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  X,
  Send,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  CalendarCheck,
  Activity,
  Sparkles
} from 'lucide-react';
import { api } from '../../services/api.ts';
import { PendingBookingProposal, ExecutedToolLog } from '../../types/index.ts';

/** Event the patient portal dispatches to open the assistant from anywhere on the page. */
export const OPEN_ASSISTANT_EVENT = 'mediflow:open-assistant';

interface WidgetMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  category?: string;
  timestamp: string;
  executedTools?: ExecutedToolLog[];
  pendingBooking?: PendingBookingProposal;
  isConfirmed?: boolean;
  isDeclined?: boolean;
  isError?: boolean;
}

interface FloatingChatWidgetProps {
  /** Called after the assistant creates an appointment so the dashboards refresh. */
  onBooked?: () => void;
}

const stamp = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** Minimal, safe renderer for **bold** and "- " bullet lines (no HTML injection). */
const RichText: React.FC<{ text: string }> = ({ text }) => (
  <div className="space-y-1">
    {text.split('\n').map((line, i) => {
      const bullet = /^\s*[-•]\s+/.test(line);
      const clean = line.replace(/^\s*[-•]\s+/, '');
      const parts = clean.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
        p.startsWith('**') && p.endsWith('**') ? (
          <strong key={j}>{p.slice(2, -2)}</strong>
        ) : (
          <React.Fragment key={j}>{p}</React.Fragment>
        )
      );
      if (!line.trim()) return <div key={i} className="h-1" />;
      return bullet ? (
        <div key={i} className="flex gap-1.5 pl-1">
          <span className="text-teal-600">•</span>
          <span>{parts}</span>
        </div>
      ) : (
        <div key={i}>{parts}</div>
      );
    })}
  </div>
);

export const FloatingChatWidget: React.FC<FloatingChatWidgetProps> = ({ onBooked }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [engine, setEngine] = useState<'gemini' | 'offline' | null>(null);
  const [messages, setMessages] = useState<WidgetMessage[]>([
    {
      id: 'init-widget',
      role: 'assistant',
      content:
        'Hi! I am the MediFlow AI assistant. I can find open appointment times and book a visit for you. Try: "Do you have any dermatology appointments tomorrow?"',
      timestamp: stamp()
    }
  ]);

  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirmingBooking, setIsConfirmingBooking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const open = () => setIsOpen(true);
    window.addEventListener(OPEN_ASSISTANT_EVENT, open);
    return () => window.removeEventListener(OPEN_ASSISTANT_EVENT, open);
  }, []);

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen, isLoading]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    const userMsg: WidgetMessage = { id: `wmsg-${Date.now()}`, role: 'user', content: text, timestamp: stamp() };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInputValue('');
    setIsLoading(true);

    try {
      // Only real conversation turns go to the model (skip UI-only error bubbles).
      const res = await api.chatWithReceptionist(
        newHistory.filter((m) => !m.isError).map((m) => ({ role: m.role, content: m.content }))
      );
      if (res.engine) setEngine(res.engine);
      setMessages((prev) => [
        ...prev,
        {
          id: `wmsg-${Date.now() + 1}`,
          role: 'assistant',
          content: res.reply,
          category: res.category as string,
          timestamp: stamp(),
          executedTools: res.executedTools,
          pendingBooking: res.pendingBooking
        }
      ]);
      // Emergency escalations create an inquiry for staff.
      if (res.actionRequired === 'escalate_emergency') onBooked?.();
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `wmsg-err-${Date.now()}`,
          role: 'assistant',
          isError: true,
          content: 'I could not reach the clinic system just now. Please try again in a moment or call the front desk.',
          timestamp: stamp()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmBooking = async (msgId: string, proposal: PendingBookingProposal) => {
    setIsConfirmingBooking(true);
    try {
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
        status: 'Pending',
        notes: proposal.notes || 'Booked via MediFlow AI assistant'
      });

      setMessages((prev) => [
        ...prev.map((m) => (m.id === msgId ? { ...m, isConfirmed: true } : m)),
        {
          id: `wmsg-conf-${Date.now()}`,
          role: 'assistant',
          content: `Your request is submitted. Booking reference: **${created.bookingReference}** with ${created.doctorName} on ${created.date} at ${created.startTime}. The clinic will confirm it shortly. Keep this reference to look up your booking.`,
          timestamp: stamp()
        }
      ]);
      onBooked?.();
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `wmsg-fail-${Date.now()}`,
          role: 'assistant',
          isError: true,
          content: `That slot could not be booked: ${err.message || 'unknown error'}. Ask me for other available times.`,
          timestamp: stamp()
        }
      ]);
    } finally {
      setIsConfirmingBooking(false);
    }
  };

  const handleDeclineBooking = (msgId: string) => {
    setMessages((prev) => [
      ...prev.map((m) => (m.id === msgId ? { ...m, isDeclined: true } : m)),
      {
        id: `wmsg-dec-${Date.now()}`,
        role: 'assistant',
        content: 'No problem, I have not booked anything. Tell me if you would like another time.',
        timestamp: stamp()
      }
    ]);
  };

  const suggestions = ['Any skin appointments tomorrow?', 'What are your opening hours?', 'How much is a general consultation?'];

  return (
    <div className="fixed bottom-5 right-5 z-40">
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2.5 px-4 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-full shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-0.5"
          aria-label="Open MediFlow AI Assistant"
          data-testid="open-assistant"
        >
          <Bot className="w-5 h-5" />
          <span className="text-xs font-semibold pr-1">AI Assistant</span>
        </button>
      )}

      {isOpen && (
        <div
          className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-[min(26rem,calc(100vw-2.5rem))] h-[min(36rem,calc(100vh-3rem))] flex flex-col overflow-hidden"
          data-testid="assistant-panel"
        >
          <div className="bg-[#142D4E] text-white p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold leading-tight">MediFlow AI Assistant</h3>
                <span className="text-[10px] text-teal-300 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />
                  {engine === 'gemini' ? 'Powered by Google Gemini' : engine === 'offline' ? 'Offline mode (Gemini not connected)' : 'Harmony Health Clinic'}
                </span>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-slate-300 hover:text-white p-1 rounded-md" aria-label="Close assistant">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-3 py-1.5 bg-amber-50 border-b border-amber-100 text-[11px] text-amber-800 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Emergency? Call 911 immediately. This assistant gives no medical advice.</span>
          </div>

          <div className="flex-1 p-3.5 overflow-y-auto space-y-3 text-xs">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[90%] p-3 rounded-xl leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-teal-600 text-white rounded-br-none'
                      : m.isError
                        ? 'bg-red-50 text-red-800 border border-red-100 rounded-bl-none'
                        : 'bg-slate-100 text-slate-800 rounded-bl-none'
                  }`}
                >
                  <RichText text={m.content} />

                  {m.executedTools && m.executedTools.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-200/60 text-[10px] space-y-1">
                      {m.executedTools.map((t, idx) => (
                        <div key={idx} className="flex items-start gap-1 text-slate-500 font-mono">
                          <Activity className="w-2.5 h-2.5 text-teal-600 mt-0.5 shrink-0" />
                          <span>{t.summary}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {m.pendingBooking && !m.isConfirmed && !m.isDeclined && (
                    <div className="mt-2.5 p-3 rounded-lg bg-white border border-teal-500/50 shadow-xs space-y-2 text-slate-800">
                      <div className="flex items-center gap-1.5 text-teal-700 font-bold text-[11px]">
                        <CalendarCheck className="w-3.5 h-3.5" />
                        <span>Confirm your appointment request</span>
                      </div>
                      <div className="text-[11px] text-slate-700 space-y-0.5">
                        <div><strong>Patient:</strong> {m.pendingBooking.patientName}</div>
                        <div><strong>Doctor:</strong> {m.pendingBooking.doctorName}</div>
                        <div><strong>Service:</strong> {m.pendingBooking.serviceName} (${m.pendingBooking.consultationFee})</div>
                        <div><strong>When:</strong> {m.pendingBooking.date} at {m.pendingBooking.startTime}</div>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleConfirmBooking(m.id, m.pendingBooking!)}
                          disabled={isConfirmingBooking}
                          data-testid="confirm-booking"
                          className="flex-1 py-1.5 px-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-semibold text-[11px] rounded flex items-center justify-center gap-1"
                        >
                          {isConfirmingBooking ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                          <span>Confirm</span>
                        </button>
                        <button
                          onClick={() => handleDeclineBooking(m.id)}
                          disabled={isConfirmingBooking}
                          className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-[11px] rounded flex items-center gap-1"
                        >
                          <XCircle className="w-3 h-3 text-slate-400" />
                          <span>Decline</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {m.isConfirmed && (
                    <div className="mt-2 p-1.5 rounded bg-emerald-50 text-emerald-800 text-[10px] flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span>Request submitted to the clinic.</span>
                    </div>
                  )}
                  {m.isDeclined && (
                    <div className="mt-2 p-1.5 rounded bg-slate-200/60 text-slate-600 text-[10px] flex items-center gap-1">
                      <XCircle className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>Booking proposal declined.</span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {messages.length === 1 && (
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSend(s)}
                    className="px-2.5 py-1.5 text-[11px] text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-full"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {isLoading && (
              <div className="flex items-center gap-1.5 text-slate-400 text-xs italic">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-600" />
                <span>Checking the live schedule...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-2.5 border-t border-slate-100 bg-slate-50 flex items-center gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask about slots, doctors, prices..."
              data-testid="assistant-input"
              className="flex-1 px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-teal-600"
            />
            <button
              onClick={() => handleSend()}
              disabled={!inputValue.trim() || isLoading}
              data-testid="assistant-send"
              className="p-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 text-white rounded-lg transition-colors"
              aria-label="Send"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
