import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  Table as TableIcon,
  Filter,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  MoreVertical,
  Eye,
  Edit2,
  Trash2,
  Send,
  AlertTriangle,
  UserCheck
} from 'lucide-react';
import { Appointment, Doctor, HealthcareService } from '../../types/index.ts';
import { useToast } from '../common/Toast.tsx';
import { ConfirmDialog } from '../common/ConfirmDialog.tsx';
import { api } from '../../services/api.ts';

interface AppointmentManagerProps {
  appointments: Appointment[];
  doctors: Doctor[];
  services: HealthcareService[];
  onOpenAddModal: () => void;
  onEditAppointment: (appt: Appointment) => void;
  onRefresh: () => void;
}

export const AppointmentManager: React.FC<AppointmentManagerProps> = ({
  appointments,
  doctors,
  services,
  onOpenAddModal,
  onEditAppointment,
  onRefresh
}) => {
  const { showToast } = useToast();

  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState('all');
  const [selectedService, setSelectedService] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedDate, setSelectedDate] = useState('');

  // Selected appointment for detail modal
  const [viewingAppointment, setViewingAppointment] = useState<Appointment | null>(null);

  // Cancellation confirm dialog state
  const [cancellingAppt, setCancellingAppt] = useState<Appointment | null>(null);
  const [cancellationReason, setCancellationReason] = useState('Patient schedule conflict');

  // Deletion confirm dialog state
  const [deletingAppt, setDeletingAppt] = useState<Appointment | null>(null);

  // Filtered appointments
  const filteredAppointments = appointments.filter((appt) => {
    if (selectedDoctor !== 'all' && appt.doctorId !== selectedDoctor) return false;
    if (selectedService !== 'all' && appt.serviceId !== selectedService) return false;
    if (selectedStatus !== 'all' && appt.status !== selectedStatus) return false;
    if (selectedDate && appt.date !== selectedDate) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = appt.patientName.toLowerCase().includes(q);
      const matchRef = appt.bookingReference.toLowerCase().includes(q);
      const matchPhone = appt.patientPhone.includes(q);
      const matchDoc = appt.doctorName.toLowerCase().includes(q);
      if (!matchName && !matchRef && !matchPhone && !matchDoc) return false;
    }

    return true;
  });

  // Handle status update
  const handleUpdateStatus = async (id: string, status: Appointment['status'], reason?: string) => {
    try {
      await api.updateAppointment(id, { status, cancellationReason: reason });
      showToast(`Appointment status updated to ${status}.`, 'success');
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to update status', 'error');
    }
  };

  // Handle reminder resend
  const handleResendReminder = async (appt: Appointment) => {
    try {
      await api.updateAppointment(appt.id, { reminderSent: true });
      showToast(`24-hour reminder queued for ${appt.patientName} (${appt.patientPhone}).`, 'success');
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to send reminder', 'error');
    }
  };

  // Handle delete
  const handleDeleteAppointment = async () => {
    if (!deletingAppt) return;
    try {
      await api.deleteAppointment(deletingAppt.id);
      showToast(`Appointment ${deletingAppt.bookingReference} removed.`, 'success');
      setDeletingAppt(null);
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete appointment', 'error');
    }
  };

  // Dates for calendar view (next 7 days starting from selected date or today)
  const baseDate = selectedDate ? new Date(selectedDate) : new Date();
  const calendarDates = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  });

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Appointment Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Browse, schedule, filter, and modify patient appointments with automatic conflict validation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center bg-slate-200/80 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                viewMode === 'calendar' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Calendar</span>
            </button>
          </div>

          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>New Appointment</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Filter by patient name, phone, ref..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600"
          />
        </div>

        {/* Doctor Filter */}
        <div className="w-44">
          <select
            value={selectedDoctor}
            onChange={(e) => setSelectedDoctor(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600"
          >
            <option value="all">All Doctors</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        {/* Service Filter */}
        <div className="w-48">
          <select
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600"
          >
            <option value="all">All Services</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="w-36">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600"
          >
            <option value="all">All Statuses</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Pending">Pending</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
            <option value="No-show">No-show</option>
          </select>
        </div>

        {/* Date Filter */}
        <div className="w-40">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600"
          />
        </div>

        {/* Clear Filters */}
        {(selectedDoctor !== 'all' || selectedService !== 'all' || selectedStatus !== 'all' || selectedDate || searchQuery) && (
          <button
            onClick={() => {
              setSelectedDoctor('all');
              setSelectedService('all');
              setSelectedStatus('all');
              setSelectedDate('');
              setSearchQuery('');
            }}
            className="px-3 py-2 text-xs text-slate-500 hover:text-slate-800 font-medium"
          >
            Reset
          </button>
        )}
      </div>

      {/* Main Content: Table or Calendar */}
      {viewMode === 'table' ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                <tr>
                  <th className="py-3 px-4 font-semibold">Reference</th>
                  <th className="py-3 px-4 font-semibold">Patient</th>
                  <th className="py-3 px-4 font-semibold">Doctor</th>
                  <th className="py-3 px-4 font-semibold">Service</th>
                  <th className="py-3 px-4 font-semibold">Date & Time</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAppointments.length > 0 ? (
                  filteredAppointments.map((appt) => (
                    <tr key={appt.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs font-bold text-teal-700">
                        {appt.bookingReference}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{appt.patientName}</div>
                        <div className="text-xs text-slate-500 font-mono">{appt.patientPhone}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-sm text-slate-800">{appt.doctorName}</div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        <span className="font-medium text-slate-700">{appt.serviceName}</span>
                        <div className="text-[11px] text-slate-400">{appt.durationMinutes} min</div>
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <div className="font-medium text-slate-900">{appt.date}</div>
                        <div className="font-mono text-slate-500 tabular-nums">
                          {appt.startTime} - {appt.endTime}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-md font-medium inline-block ${
                            appt.status === 'Confirmed'
                              ? 'bg-emerald-50 text-emerald-700'
                              : appt.status === 'Completed'
                              ? 'bg-teal-50 text-teal-700'
                              : appt.status === 'Pending'
                              ? 'bg-amber-50 text-amber-700'
                              : appt.status === 'Cancelled'
                              ? 'bg-red-50 text-red-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {appt.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick Action based on status */}
                          {appt.status === 'Pending' && (
                            <button
                              onClick={() => handleUpdateStatus(appt.id, 'Confirmed')}
                              className="px-2.5 py-1 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded transition-colors"
                              title="Confirm booking request"
                            >
                              Confirm
                            </button>
                          )}
                          {appt.status === 'Confirmed' && (
                            <button
                              onClick={() => handleUpdateStatus(appt.id, 'Completed')}
                              className="px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded transition-colors"
                              title="Mark visit as completed"
                            >
                              Complete
                            </button>
                          )}

                          {/* Detail button */}
                          <button
                            onClick={() => setViewingAppointment(appt)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Edit button */}
                          <button
                            onClick={() => onEditAppointment(appt)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded"
                            title="Edit / Reschedule"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Cancellation button */}
                          {appt.status !== 'Cancelled' && appt.status !== 'Completed' && (
                            <button
                              onClick={() => setCancellingAppt(appt)}
                              className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                              title="Cancel appointment"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}

                          {/* Delete button */}
                          <button
                            onClick={() => setDeletingAppt(appt)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded"
                            title="Delete record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-sm text-slate-400">
                      No appointments match the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
            <span>Showing {filteredAppointments.length} of {appointments.length} appointments</span>
            <span>All times in America/Chicago (CST)</span>
          </div>
        </div>
      ) : (
        /* Calendar View */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {calendarDates.map((dateStr) => {
              const d = new Date(dateStr + 'T00:00:00');
              const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
              const monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              const dayAppts = filteredAppointments.filter((a) => a.date === dateStr);

              return (
                <div
                  key={dateStr}
                  className="bg-slate-50 rounded-xl p-3 border border-slate-200/60 flex flex-col min-h-[300px]"
                >
                  <div className="pb-2 border-b border-slate-200">
                    <div className="text-xs font-bold text-slate-800">{dayName}</div>
                    <div className="text-[11px] text-slate-500">{monthDay}</div>
                    <span className="mt-1 text-[10px] text-slate-400 font-medium">
                      {dayAppts.length} appointments
                    </span>
                  </div>

                  <div className="mt-2.5 space-y-2 flex-1 overflow-y-auto max-h-[420px]">
                    {dayAppts.map((appt) => (
                      <div
                        key={appt.id}
                        onClick={() => setViewingAppointment(appt)}
                        className={`p-2.5 rounded-lg text-xs cursor-pointer border transition-all ${
                          appt.status === 'Confirmed'
                            ? 'bg-teal-50 border-teal-200 text-teal-900 hover:bg-teal-100'
                            : appt.status === 'Pending'
                            ? 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100'
                            : appt.status === 'Completed'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <div className="font-bold text-[11px] flex items-center justify-between">
                          <span className="font-mono tabular-nums">{appt.startTime}</span>
                          <span className="text-[9px] uppercase font-semibold">{appt.status}</span>
                        </div>
                        <div className="font-medium text-slate-900 truncate mt-1">{appt.patientName}</div>
                        <div className="text-[11px] text-slate-600 truncate">{appt.doctorName}</div>
                      </div>
                    ))}
                    {dayAppts.length === 0 && (
                      <div className="h-24 flex items-center justify-center text-[11px] text-slate-400 italic">
                        No bookings
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Appointment Detail Drawer / Modal */}
      {viewingAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <span className="text-xs font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
                  {viewingAppointment.bookingReference}
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-1">Appointment Details</h3>
              </div>
              <button
                onClick={() => setViewingAppointment(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs text-slate-600">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl">
                <div>
                  <span className="text-slate-400 font-medium">Patient:</span>
                  <div className="font-semibold text-slate-900 text-sm">{viewingAppointment.patientName}</div>
                  <div className="font-mono">{viewingAppointment.patientPhone}</div>
                  <div>{viewingAppointment.patientEmail || 'No email provided'}</div>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Doctor:</span>
                  <div className="font-semibold text-slate-900 text-sm">{viewingAppointment.doctorName}</div>
                  <div>{viewingAppointment.serviceName}</div>
                  <div className="font-mono text-slate-500">Duration: {viewingAppointment.durationMinutes} mins</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 border border-slate-200 rounded-xl">
                  <span className="text-slate-400 font-medium">Schedule:</span>
                  <div className="font-semibold text-slate-900 mt-1">{viewingAppointment.date}</div>
                  <div className="font-mono text-slate-700">{viewingAppointment.startTime} to {viewingAppointment.endTime}</div>
                </div>

                <div className="p-3 border border-slate-200 rounded-xl">
                  <span className="text-slate-400 font-medium">Current Status:</span>
                  <div className="mt-1">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        viewingAppointment.status === 'Confirmed'
                          ? 'bg-emerald-50 text-emerald-700'
                          : viewingAppointment.status === 'Completed'
                          ? 'bg-teal-50 text-teal-700'
                          : viewingAppointment.status === 'Pending'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {viewingAppointment.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {viewingAppointment.reminderSent ? '✓ 24h SMS reminder queued' : 'Reminder pending'}
                  </div>
                </div>
              </div>

              {viewingAppointment.notes && (
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-400 font-medium">Administrative Notes:</span>
                  <p className="text-slate-800 mt-0.5">{viewingAppointment.notes}</p>
                </div>
              )}

              {viewingAppointment.cancellationReason && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800">
                  <span className="font-semibold">Cancellation Reason:</span>
                  <p className="mt-0.5">{viewingAppointment.cancellationReason}</p>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => handleResendReminder(viewingAppointment)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send SMS Reminder</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setViewingAppointment(null);
                    onEditAppointment(viewingAppointment);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors"
                >
                  Edit Booking
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Dialog */}
      {cancellingAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">Cancel Appointment</h3>
            <p className="text-xs text-slate-500 mt-1">
              Cancel booking {cancellingAppt.bookingReference} for {cancellingAppt.patientName}.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Cancellation Reason</label>
              <select
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-teal-600"
              >
                <option value="Patient schedule conflict">Patient schedule conflict</option>
                <option value="Illness or unexpected emergency">Illness or unexpected emergency</option>
                <option value="Doctor emergency coverage">Doctor emergency coverage</option>
                <option value="Booking error / duplicate request">Booking error / duplicate request</option>
              </select>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setCancellingAppt(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                Back
              </button>
              <button
                onClick={() => {
                  handleUpdateStatus(cancellingAppt.id, 'Cancelled', cancellationReason);
                  setCancellingAppt(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingAppt)}
        title="Delete Appointment Record"
        message={`Are you sure you want to permanently delete appointment ${deletingAppt?.bookingReference}? This action cannot be undone.`}
        confirmLabel="Delete Record"
        isDestructive={true}
        onConfirm={handleDeleteAppointment}
        onCancel={() => setDeletingAppt(null)}
      />
    </div>
  );
};
