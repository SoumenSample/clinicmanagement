'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthHeaders } from '@/lib/utils/tenant-client';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeIndianRupee,
  Bell,
  ClipboardList,
  DollarSign,
  CalendarDays,
  Clock3,
  Loader2,
  Plus,
  ShoppingCart,
  Stethoscope,
  Users,
  TrendingUp,
  UserRound,
  XCircle,
} from 'lucide-react';

interface DashboardData {
  totalStockValue: number;
  totalMedicines: number;
  lowStockCount: number;
  expiredCount: number;
  todayRevenue: number;
  monthlyRevenue: number;
  unresolvedAlerts: number;
  topSelling: Array<{ name: string; quantity: number; price: number }>;
}

type DoctorSummary = {
  _id: string;
  name: string;
  specialization: string;
  availableDays?: string[];
  availabilityNotes?: string;
  availabilitySlotMinutes?: number;
  availabilityWindows?: AvailabilityWindow[];
  availabilityExceptions?: AvailabilityException[];
};

type AvailabilityWindow = {
  title?: string;
  daysOfWeek: string[];
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  note?: string;
};

type AvailabilityException = {
  date: string;
  reason?: string;
};

type PatientSummary = {
  _id: string;
  name: string;
  phone?: string;
};

type AppointmentRecord = {
  _id: string;
  appointmentDate: string;
  timeSlot: string;
  reason?: string;
  notes?: string;
  status?: 'booked' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  doctorId?: DoctorSummary | string;
  patientId?: PatientSummary | string;
};

type StatVariant = 'default' | 'warning' | 'danger' | 'success' | 'blue';

function formatCurrency(value?: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

function StatCard({
  label,
  value,
  icon: Icon,
  variant = 'default',
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  variant?: StatVariant;
  sub?: string;
}) {
  const styles: Record<
    StatVariant,
    {
      card: string;
      iconWrap: string;
      icon: string;
      value: string;
      accent: string;
    }
  > = {
    default: {
      card: 'border-slate-200 bg-white',
      iconWrap: 'bg-slate-100',
      icon: 'text-slate-600',
      value: 'text-slate-950',
      accent: '',
    },
    blue: {
      card: 'border-blue-100 bg-blue-50/40',
      iconWrap: 'bg-blue-100',
      icon: 'text-blue-700',
      value: 'text-blue-950',
      accent: '',
    },
    warning: {
      card: 'border-amber-100 bg-amber-50/50',
      iconWrap: 'bg-amber-100',
      icon: 'text-amber-700',
      value: 'text-amber-950',
      accent: '',
    },
    danger: {
      card: 'border-red-100 bg-red-50/50',
      iconWrap: 'bg-red-100',
      icon: 'text-red-700',
      value: 'text-red-950',
      accent: '',
    },
    success: {
      card: 'border-emerald-100 bg-emerald-50/50',
      iconWrap: 'bg-emerald-100',
      icon: 'text-emerald-700',
      value: 'text-emerald-950',
      accent: '',
    },
  };

  const s = styles[variant];

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border ${s.card} p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 bg-linear-to-r ${s.accent}`} />

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className={`mt-2 text-3xl font-bold tracking-tight ${s.value}`}>{value}</p>
        </div>

        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${s.iconWrap}`}>
          <Icon className={`h-5 w-5 ${s.icon}`} />
        </div>
      </div>

      {sub && <p className="mt-4 text-xs leading-5 text-slate-500">{sub}</p>}
    </div>
  );
}

function NavCard({
  href,
  eyebrow,
  title,
  description,
  icon: Icon,
}: {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ElementType;
}) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg"
    >
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-blue-50 transition group-hover:bg-blue-100" />

      <div className="relative flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm">
            <Icon className="h-5 w-5" />
          </div>

          <ArrowRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-blue-600" />
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-950 transition group-hover:text-blue-700">
            {title}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
            {description}
          </p>
        </div>
      </div>
    </Link>
  );
}

function formatAppointmentDate(value?: string) {
  if (!value) return 'N/A';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDayList(days?: string[]) {
  if (!days || days.length === 0) return 'No days set';
  return days.map((day) => day.charAt(0).toUpperCase() + day.slice(1)).join(', ');
}

function canCancelAppointment(status?: string) {
  return !['cancelled', 'completed'].includes(status || '');
}

function createAvailabilityWindow(): AvailabilityWindow {
  return {
    title: '',
    daysOfWeek: [],
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    note: '',
  };
}

function createAvailabilityException(): AvailabilityException {
  return {
    date: '',
    reason: '',
  };
}

function formatSelectedDays(days: string[]) {
  return days.length > 0 ? formatDayList(days) : 'No days selected';
}

function normalizeAvailabilityDoctor(doctor: DoctorSummary) {
  return {
    ...doctor,
    availabilitySlotMinutes: doctor.availabilitySlotMinutes ?? 15,
    availabilityWindows: doctor.availabilityWindows ?? [],
    availabilityExceptions: doctor.availabilityExceptions ?? [],
  };
}

function buildAvailabilityPayload(
  availabilityWindows: AvailabilityWindow[],
  availabilityExceptions: AvailabilityException[],
  availabilityNotes: string,
  availabilitySlotMinutes: number
) {
  const availableDays = Array.from(
    new Set(
      availabilityWindows
        .flatMap((window) => window.daysOfWeek)
        .map((day) => day.toLowerCase())
        .filter(Boolean)
    )
  );

  return {
    availableDays,
    availabilityNotes,
    availabilitySlotMinutes,
    availabilityWindows,
    availabilityExceptions: availabilityExceptions.filter((exception) => exception.date.trim().length > 0),
  };
}

function StaffAvailabilitySection({
  doctors,
  selectedDoctorId,
  availabilityNotes,
  availabilitySlotMinutes,
  availabilityWindows,
  availabilityExceptions,
  availabilityStatus,
  savingAvailability,
  onChangeDoctor,
  onChangeNotes,
  onChangeSlotMinutes,
  onAddWindow,
  onRemoveWindow,
  onChangeWindow,
  onToggleWindowDay,
  onAddException,
  onRemoveException,
  onChangeException,
  onSubmit,
}: {
  doctors: DoctorSummary[];
  selectedDoctorId: string;
  availabilityNotes: string;
  availabilitySlotMinutes: number;
  availabilityWindows: AvailabilityWindow[];
  availabilityExceptions: AvailabilityException[];
  availabilityStatus: string;
  savingAvailability: boolean;
  onChangeDoctor: (value: string) => void;
  onChangeNotes: (value: string) => void;
  onChangeSlotMinutes: (value: number) => void;
  onAddWindow: () => void;
  onRemoveWindow: (index: number) => void;
  onChangeWindow: (index: number, field: Exclude<keyof AvailabilityWindow, 'daysOfWeek'>, value: string) => void;
  onToggleWindowDay: (index: number, day: string) => void;
  onAddException: () => void;
  onRemoveException: (index: number) => void;
  onChangeException: (index: number, field: keyof AvailabilityException, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const selectedDoctor = doctors.find((doctor) => doctor._id === selectedDoctorId) || null;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Availability</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">Set or edit doctor availability</h2>
          <p className="mt-1 text-sm text-slate-500">
            Staff and admins can update doctor schedules, availability notes, and exception dates from here.
          </p>
        </div>
        <span className="inline-flex w-fit items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
          {doctors.length} doctor{doctors.length === 1 ? '' : 's'}
        </span>
      </div>

      <form onSubmit={onSubmit} className="mt-5 space-y-5 rounded-3xl border border-slate-100 bg-slate-50/80 p-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-1.5 lg:col-span-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              <Stethoscope className="h-3.5 w-3.5" /> Doctor
            </label>
            <select
              value={selectedDoctorId}
              onChange={(e) => onChangeDoctor(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
            >
              <option value="">Select a doctor</option>
              {doctors.map((doctor) => (
                <option key={doctor._id} value={doctor._id}>
                  {doctor.name}{doctor.specialization ? ` — ${doctor.specialization}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              <Clock3 className="h-3.5 w-3.5" /> Slot length
            </label>
            <select
              value={String(availabilitySlotMinutes)}
              onChange={(e) => onChangeSlotMinutes(Number(e.target.value))}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
            >
              <option value="5">5 minutes</option>
              <option value="10">10 minutes</option>
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Availability notes</label>
            <textarea
              value={availabilityNotes}
              onChange={(e) => onChangeNotes(e.target.value)}
              rows={3}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
              placeholder="Add a short note about visiting hours, leave, or booking rules"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Availability windows</p>
              <p className="text-xs text-slate-500">Define one or more weekly windows for booking.</p>
            </div>
            <button
              type="button"
              onClick={onAddWindow}
              className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
            >
              <Plus className="h-4 w-4" /> Add window
            </button>
          </div>

          <div className="space-y-4">
            {availabilityWindows.map((window, index) => (
              <div key={`${window.title || 'window'}-${index}`} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Window {index + 1}</p>
                    <p className="text-xs text-slate-500">Set the recurring days and time range for this slot.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveWindow(index)}
                    className="inline-flex items-center gap-2 self-start rounded-2xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                  >
                    <XCircle className="h-4 w-4" /> Remove
                  </button>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="space-y-1.5 lg:col-span-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Label</label>
                    <input
                      value={window.title || ''}
                      onChange={(e) => onChangeWindow(index, 'title', e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                      placeholder="Morning clinic hours"
                    />
                  </div>

                  <div className="space-y-2 lg:col-span-2">
                    <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      <CalendarDays className="h-3.5 w-3.5" /> Days of week
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => {
                        const checked = window.daysOfWeek.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => onToggleWindowDay(index, day)}
                            className={`rounded-full px-3 py-2 text-xs font-semibold capitalize transition ${checked ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Start date</label>
                    <input
                      type="date"
                      value={window.startDate || ''}
                      onChange={(e) => onChangeWindow(index, 'startDate', e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">End date</label>
                    <input
                      type="date"
                      value={window.endDate || ''}
                      onChange={(e) => onChangeWindow(index, 'endDate', e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Start time</label>
                    <input
                      type="time"
                      value={window.startTime || ''}
                      onChange={(e) => onChangeWindow(index, 'startTime', e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">End time</label>
                    <input
                      type="time"
                      value={window.endTime || ''}
                      onChange={(e) => onChangeWindow(index, 'endTime', e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                    />
                  </div>

                  <div className="space-y-1.5 lg:col-span-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Window note</label>
                    <textarea
                      value={window.note || ''}
                      onChange={(e) => onChangeWindow(index, 'note', e.target.value)}
                      rows={2}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                      placeholder="Optional note for this slot"
                    />
                  </div>
                </div>

                <p className="mt-3 text-xs text-slate-500">
                  Selected days: <strong className="text-slate-700">{formatSelectedDays(window.daysOfWeek)}</strong>
                </p>
              </div>
            ))}

            {availabilityWindows.length === 0 && (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
                No windows added yet. Add one to define doctor availability.
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Availability exceptions</p>
              <p className="text-xs text-slate-500">Block specific dates for leave or special closures.</p>
            </div>
            <button
              type="button"
              onClick={onAddException}
              className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
            >
              <Plus className="h-4 w-4" /> Add exception
            </button>
          </div>

          <div className="space-y-3">
            {availabilityExceptions.map((exception, index) => (
              <div key={`${exception.date || 'exception'}-${index}`} className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 lg:grid-cols-[1fr_1.2fr_auto] lg:items-end">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Date</label>
                  <input
                    type="date"
                    value={exception.date}
                    onChange={(e) => onChangeException(index, 'date', e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Reason</label>
                  <input
                    value={exception.reason || ''}
                    onChange={(e) => onChangeException(index, 'reason', e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                    placeholder="Leave, conference, holiday"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => onRemoveException(index)}
                  className="inline-flex items-center justify-center rounded-2xl border border-rose-200 bg-white px-3 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                >
                  Remove
                </button>
              </div>
            ))}

            {availabilityExceptions.length === 0 && (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
                No exceptions added yet.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-500">
            {selectedDoctor ? (
              <span>
                Current profile: <strong className="text-slate-700">{selectedDoctor.name}</strong>
                {selectedDoctor.specialization ? ` · ${selectedDoctor.specialization}` : ''}
                {selectedDoctor.availableDays && selectedDoctor.availableDays.length > 0 ? ` · ${formatDayList(selectedDoctor.availableDays)}` : ''}
              </span>
            ) : (
              <span>Select a doctor to edit their schedule.</span>
            )}
          </div>

          <button
            type="submit"
            disabled={savingAvailability}
            className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {savingAvailability ? 'Saving...' : 'Save availability'}
          </button>
        </div>

        {availabilityStatus && (
          <p className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {availabilityStatus}
          </p>
        )}
      </form>
    </section>
  );
}

function StaffAppointmentsSection({
  doctors,
  patients,
  appointments,
  selectedDoctorId,
  selectedPatientId,
  appointmentDate,
  timeSlot,
  reason,
  notes,
  bookingStatus,
  cancellingAppointmentId,
  onChangeDoctor,
  onChangePatient,
  onChangeDate,
  onChangeTimeSlot,
  onChangeReason,
  onChangeNotes,
  onCancelAppointment,
  onSubmit,
}: {
  doctors: DoctorSummary[];
  patients: PatientSummary[];
  appointments: AppointmentRecord[];
  selectedDoctorId: string;
  selectedPatientId: string;
  appointmentDate: string;
  timeSlot: string;
  reason: string;
  notes: string;
  bookingStatus: string;
  cancellingAppointmentId: string;
  onChangeDoctor: (value: string) => void;
  onChangePatient: (value: string) => void;
  onChangeDate: (value: string) => void;
  onChangeTimeSlot: (value: string) => void;
  onChangeReason: (value: string) => void;
  onChangeNotes: (value: string) => void;
  onCancelAppointment: (appointmentId: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const selectedDoctor = doctors.find((doctor) => doctor._id === selectedDoctorId) || null;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-600">Front desk</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">Appointment booking</h2>
          <p className="mt-1 text-sm text-slate-500">Book a visit on behalf of a patient and keep the schedule in one place.</p>
        </div>
        <span className="inline-flex w-fit items-center rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 ring-1 ring-teal-200">
          {appointments.length} appointment{appointments.length === 1 ? '' : 's'}
        </span>
      </div>

      <form onSubmit={onSubmit} className="mt-5 grid gap-4 rounded-3xl border border-slate-100 bg-slate-50/80 p-4 lg:grid-cols-2">
        <div className="space-y-1.5 lg:col-span-2">
          <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            <UserRound className="h-3.5 w-3.5" /> Patient
          </label>
          <select
            value={selectedPatientId}
            onChange={(e) => onChangePatient(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/10"
          >
            <option value="">Select a patient</option>
            {patients.map((patient) => (
              <option key={patient._id} value={patient._id}>
                {patient.name}{patient.phone ? ` — ${patient.phone}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5 lg:col-span-2">
          <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            <Stethoscope className="h-3.5 w-3.5" /> Doctor
          </label>
          <select
            value={selectedDoctorId}
            onChange={(e) => onChangeDoctor(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/10"
          >
            <option value="">Select a doctor</option>
            {doctors.map((doctor) => (
              <option key={doctor._id} value={doctor._id}>
                {doctor.name}{doctor.specialization ? ` — ${doctor.specialization}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            <CalendarDays className="h-3.5 w-3.5" /> Date
          </label>
          <input
            type="date"
            value={appointmentDate}
            onChange={(e) => onChangeDate(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/10"
          />
        </div>

        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            <Clock3 className="h-3.5 w-3.5" /> Time slot
          </label>
          <input
            type="text"
            value={timeSlot}
            onChange={(e) => onChangeTimeSlot(e.target.value)}
            placeholder="10:00 AM - 10:30 AM"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/10"
          />
        </div>

        <div className="space-y-1.5 lg:col-span-2">
          <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Reason</label>
          <textarea
            value={reason}
            onChange={(e) => onChangeReason(e.target.value)}
            rows={3}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/10"
            placeholder="Brief reason for the visit"
          />
        </div>

        <div className="space-y-1.5 lg:col-span-2">
          <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => onChangeNotes(e.target.value)}
            rows={2}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/10"
            placeholder="Optional notes for the patient or doctor"
          />
        </div>

        <div className="lg:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-500">
            {selectedDoctor ? (
              <span>
                Available days: <strong className="text-slate-700">{formatDayList(selectedDoctor.availableDays)}</strong>
                {selectedDoctor.availabilityNotes ? ` · ${selectedDoctor.availabilityNotes}` : ''}
              </span>
            ) : (
              <span>Pick a doctor to see availability notes.</span>
            )}
          </div>
          <button type="submit" className="rounded-2xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-500">
            Book appointment
          </button>
        </div>

        {bookingStatus && (
          <p className="lg:col-span-2 rounded-2xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm text-teal-800">
            {bookingStatus}
          </p>
        )}
      </form>

      <div className="mt-6 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Schedule</h3>
        {appointments.length > 0 ? (
          <div className="space-y-3">
            {appointments.map((appointment) => {
              const patient = typeof appointment.patientId === 'object' ? appointment.patientId : null;
              const doctor = typeof appointment.doctorId === 'object' ? appointment.doctorId : null;

              return (
                <div key={appointment._id} className="rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{patient?.name || 'Patient'}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {doctor?.name || 'Doctor'} · {formatAppointmentDate(appointment.appointmentDate)} · {appointment.timeSlot}
                      </p>
                      {appointment.reason && <p className="mt-2 text-sm text-slate-700">{appointment.reason}</p>}
                    </div>
                      <div className="flex flex-col items-start gap-2 sm:items-end">
                        <span className="inline-flex w-fit rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                          {appointment.status || 'booked'}
                        </span>
                        {canCancelAppointment(appointment.status) && (
                          <button
                            type="button"
                            onClick={() => onCancelAppointment(appointment._id)}
                            disabled={cancellingAppointmentId === appointment._id}
                            className="rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {cancellingAppointmentId === appointment._id ? 'Cancelling...' : 'Cancel booking'}
                          </button>
                        )}
                      </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-sm text-slate-500">
            No appointments scheduled yet.
          </p>
        )}
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [staffDoctors, setStaffDoctors] = useState<DoctorSummary[]>([]);
  const [staffPatients, setStaffPatients] = useState<PatientSummary[]>([]);
  const [staffAppointments, setStaffAppointments] = useState<AppointmentRecord[]>([]);
  const [appointmentDoctorId, setAppointmentDoctorId] = useState('');
  const [appointmentPatientId, setAppointmentPatientId] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTimeSlot, setAppointmentTimeSlot] = useState('');
  const [appointmentReason, setAppointmentReason] = useState('');
  const [appointmentNotes, setAppointmentNotes] = useState('');
  const [appointmentStatus, setAppointmentStatus] = useState('');
  const [cancellingAppointmentId, setCancellingAppointmentId] = useState('');
  const [availabilityDoctorId, setAvailabilityDoctorId] = useState('');
  const [availabilityNotes, setAvailabilityNotes] = useState('');
  const [availabilitySlotMinutes, setAvailabilitySlotMinutes] = useState(15);
  const [availabilityWindows, setAvailabilityWindows] = useState<AvailabilityWindow[]>([]);
  const [availabilityExceptions, setAvailabilityExceptions] = useState<AvailabilityException[]>([]);
  const [availabilityStatus, setAvailabilityStatus] = useState('');
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userRaw = localStorage.getItem('user');
    const user = userRaw ? JSON.parse(userRaw) : null;

    if (!token) {
      router.push('/login');
      return;
    }

    if (user?.role === 'doctor') {
      router.push('/doctor-dashboard');
      return;
    }

    if (user?.role === 'patient') {
      router.push('/patient-dashboard');
      return;
    }

    fetchDashboardData();
  }, [router]);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');

      const response = await fetch('/api/dashboard', {
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      setData(await response.json());

      const [doctorsRes, patientsRes, appointmentsRes] = await Promise.all([
        fetch('/api/doctors', { headers: getAuthHeaders(token) }),
        fetch('/api/patients', { headers: getAuthHeaders(token) }),
        fetch('/api/appointments', { headers: getAuthHeaders(token) }),
      ]);

      if (doctorsRes.ok) {
        const doctorsData = await doctorsRes.json();
        const doctorsList = Array.isArray(doctorsData) ? doctorsData.map((doctor) => normalizeAvailabilityDoctor(doctor)) : [];
        setStaffDoctors(doctorsList);
        setAvailabilityDoctorId((current) => current || doctorsList[0]?._id || '');
      }

      if (patientsRes.ok) {
        const patientsData = await patientsRes.json();
        setStaffPatients(Array.isArray(patientsData) ? patientsData : []);
      }

      if (appointmentsRes.ok) {
        const appointmentsData = await appointmentsRes.json();
        setStaffAppointments(Array.isArray(appointmentsData) ? appointmentsData : []);
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAvailabilityForDoctor = async (doctorId: string) => {
    if (!doctorId) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/doctors/${doctorId}/availability`, {
        headers: getAuthHeaders(token),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load availability');
      }

      setAvailabilityNotes(payload.availabilityNotes || '');
      setAvailabilitySlotMinutes(Number(payload.availabilitySlotMinutes) || 15);
      setAvailabilityWindows(Array.isArray(payload.availabilityWindows) ? payload.availabilityWindows : []);
      setAvailabilityExceptions(Array.isArray(payload.availabilityExceptions) ? payload.availabilityExceptions : []);
      setStaffDoctors((current) =>
        current.map((doctor) =>
          doctor._id === doctorId
            ? {
                ...doctor,
                availableDays: Array.isArray(payload.availableDays) ? payload.availableDays : [],
                availabilityNotes: payload.availabilityNotes || '',
                availabilitySlotMinutes: Number(payload.availabilitySlotMinutes) || 15,
                availabilityWindows: Array.isArray(payload.availabilityWindows) ? payload.availabilityWindows : [],
                availabilityExceptions: Array.isArray(payload.availabilityExceptions) ? payload.availabilityExceptions : [],
              }
            : doctor
        )
      );
      setAvailabilityStatus('Availability loaded.');
    } catch (err: any) {
      setAvailabilityStatus(err.message || 'Failed to load availability');
    }
  };

  const handleAppointmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!appointmentDoctorId || !appointmentPatientId || !appointmentDate || !appointmentTimeSlot.trim()) {
      setAppointmentStatus('Choose a patient, doctor, date, and time slot first.');
      return;
    }

    setAppointmentStatus('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders(token) },
        body: JSON.stringify({
          patientId: appointmentPatientId,
          doctorId: appointmentDoctorId,
          appointmentDate,
          timeSlot: appointmentTimeSlot,
          reason: appointmentReason || undefined,
          notes: appointmentNotes || undefined,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to book appointment');
      }

      setStaffAppointments((current) => [payload, ...current]);
      setAppointmentStatus('Appointment booked successfully.');
      setAppointmentDoctorId('');
      setAppointmentPatientId('');
      setAppointmentDate('');
      setAppointmentTimeSlot('');
      setAppointmentReason('');
      setAppointmentNotes('');
    } catch (err: any) {
      setAppointmentStatus(err.message || 'Failed to book appointment');
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    const confirmed = window.confirm('Cancel this appointment?');
    if (!confirmed) return;

    setCancellingAppointmentId(appointmentId);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders(token) },
        body: JSON.stringify({ status: 'cancelled' }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to cancel appointment');
      }

      setStaffAppointments((current) => current.map((appointment) => (appointment._id === appointmentId ? { ...appointment, status: 'cancelled' } : appointment)));
      setAppointmentStatus('Appointment cancelled.');
    } catch (err: any) {
      setAppointmentStatus(err.message || 'Failed to cancel appointment');
    } finally {
      setCancellingAppointmentId('');
    }
  };

  useEffect(() => {
    if (!availabilityDoctorId && staffDoctors.length > 0) {
      setAvailabilityDoctorId(staffDoctors[0]._id);
    }
  }, [availabilityDoctorId, staffDoctors]);

  useEffect(() => {
    if (!availabilityDoctorId) return;
    loadAvailabilityForDoctor(availabilityDoctorId);
  }, [availabilityDoctorId]);

  const handleChangeAvailabilityDoctor = (doctorId: string) => {
    setAvailabilityDoctorId(doctorId);
    setAvailabilityStatus('');
  };

  const handleAddAvailabilityWindow = () => {
    setAvailabilityWindows((current) => [...current, createAvailabilityWindow()]);
  };

  const handleRemoveAvailabilityWindow = (index: number) => {
    setAvailabilityWindows((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleChangeAvailabilityWindow = (index: number, field: Exclude<keyof AvailabilityWindow, 'daysOfWeek'>, value: string) => {
    setAvailabilityWindows((current) =>
      current.map((window, currentIndex) => (currentIndex === index ? { ...window, [field]: value } : window))
    );
  };

  const handleToggleAvailabilityWindowDay = (index: number, day: string) => {
    setAvailabilityWindows((current) =>
      current.map((window, currentIndex) => {
        if (currentIndex !== index) return window;
        const nextDays = window.daysOfWeek.includes(day)
          ? window.daysOfWeek.filter((value) => value !== day)
          : [...window.daysOfWeek, day];
        return { ...window, daysOfWeek: nextDays };
      })
    );
  };

  const handleAddAvailabilityException = () => {
    setAvailabilityExceptions((current) => [...current, createAvailabilityException()]);
  };

  const handleRemoveAvailabilityException = (index: number) => {
    setAvailabilityExceptions((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleChangeAvailabilityException = (index: number, field: keyof AvailabilityException, value: string) => {
    setAvailabilityExceptions((current) =>
      current.map((exception, currentIndex) => (currentIndex === index ? { ...exception, [field]: value } : exception))
    );
  };

  const handleAvailabilitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!availabilityDoctorId) {
      setAvailabilityStatus('Select a doctor first.');
      return;
    }

    const payload = buildAvailabilityPayload(availabilityWindows, availabilityExceptions, availabilityNotes, availabilitySlotMinutes);
    setSavingAvailability(true);
    setAvailabilityStatus('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/doctors/${availabilityDoctorId}/availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders(token) },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'Failed to save availability');
      }

      setAvailabilityNotes(result.availabilityNotes || '');
      setAvailabilitySlotMinutes(Number(result.availabilitySlotMinutes) || 15);
      setAvailabilityWindows(Array.isArray(result.availabilityWindows) ? result.availabilityWindows : []);
      setAvailabilityExceptions(Array.isArray(result.availabilityExceptions) ? result.availabilityExceptions : []);
      setStaffDoctors((current) =>
        current.map((doctor) =>
          doctor._id === availabilityDoctorId
            ? {
                ...doctor,
                availableDays: Array.isArray(result.availableDays) ? result.availableDays : [],
                availabilityNotes: result.availabilityNotes || '',
                availabilitySlotMinutes: Number(result.availabilitySlotMinutes) || 15,
                availabilityWindows: Array.isArray(result.availabilityWindows) ? result.availabilityWindows : [],
                availabilityExceptions: Array.isArray(result.availabilityExceptions) ? result.availabilityExceptions : [],
              }
            : doctor
        )
      );
      setAvailabilityStatus('Availability saved successfully.');
    } catch (err: any) {
      setAvailabilityStatus(err.message || 'Failed to save availability');
    } finally {
      setSavingAvailability(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-105 items-center justify-center">
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-slate-200 bg-white px-10 py-8 shadow-sm">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-900">Loading dashboard</p>
            <p className="mt-1 text-xs text-slate-500">Fetching latest clinic insights...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-100">
            <AlertTriangle className="h-5 w-5 text-red-700" />
          </div>

          <div>
            <p className="font-semibold text-red-950">Something went wrong</p>
            <p className="mt-1 text-sm text-red-700">{error}</p>

            <button
              onClick={fetchDashboardData}
              className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 p-6 shadow-sm md:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.35),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.18),transparent_30%)]" />

        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-white/15 backdrop-blur">
              <Activity className="h-7 w-7" />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200">
                Clinic Management
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-white md:text-3xl">
                Operations Dashboard
              </h1>
              <p className="mt-2 text-sm text-slate-300">
                Monitor revenue, alerts, and clinic activity from one place.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/billing"
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 active:scale-95"
            >
              <Plus className="h-4 w-4" />
              New Billing
            </Link>

            <Link
              href="/alerts"
              className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-white/15 active:scale-95"
            >
              <Bell className="h-4 w-4" />
              View Alerts
            </Link>
          </div>
        </div>
      </section>

      {/* Navigation Cards */}
      <section className="grid gap-4 md:grid-cols-3">
        <NavCard
          href="/dashboard/doctors"
          eyebrow="Clinic"
          title="Doctors"
          description="Manage registered doctors and their profiles."
          icon={Stethoscope}
        />

        <NavCard
          href="/dashboard/patients"
          eyebrow="Clinic"
          title="Patients"
          description="View and register patients, medical history and visits."
          icon={Users}
        />

        <NavCard
          href="/dashboard/prescriptions"
          eyebrow="Clinic"
          title="Prescriptions"
          description="Upload, write and manage prescription records."
          icon={ClipboardList}
        />
      </section>

      <StaffAppointmentsSection
        doctors={staffDoctors}
        patients={staffPatients}
        appointments={staffAppointments}
        selectedDoctorId={appointmentDoctorId}
        selectedPatientId={appointmentPatientId}
        appointmentDate={appointmentDate}
        timeSlot={appointmentTimeSlot}
        reason={appointmentReason}
        notes={appointmentNotes}
        bookingStatus={appointmentStatus}
        cancellingAppointmentId={cancellingAppointmentId}
        onChangeDoctor={setAppointmentDoctorId}
        onChangePatient={setAppointmentPatientId}
        onChangeDate={setAppointmentDate}
        onChangeTimeSlot={setAppointmentTimeSlot}
        onChangeReason={setAppointmentReason}
        onChangeNotes={setAppointmentNotes}
        onCancelAppointment={handleCancelAppointment}
        onSubmit={handleAppointmentSubmit}
      />

      <StaffAvailabilitySection
        doctors={staffDoctors}
        selectedDoctorId={availabilityDoctorId}
        availabilityNotes={availabilityNotes}
        availabilitySlotMinutes={availabilitySlotMinutes}
        availabilityWindows={availabilityWindows}
        availabilityExceptions={availabilityExceptions}
        availabilityStatus={availabilityStatus}
        savingAvailability={savingAvailability}
        onChangeDoctor={handleChangeAvailabilityDoctor}
        onChangeNotes={setAvailabilityNotes}
        onChangeSlotMinutes={setAvailabilitySlotMinutes}
        onAddWindow={handleAddAvailabilityWindow}
        onRemoveWindow={handleRemoveAvailabilityWindow}
        onChangeWindow={handleChangeAvailabilityWindow}
        onToggleWindowDay={handleToggleAvailabilityWindowDay}
        onAddException={handleAddAvailabilityException}
        onRemoveException={handleRemoveAvailabilityException}
        onChangeException={handleChangeAvailabilityException}
        onSubmit={handleAvailabilitySubmit}
      />

      {/* Revenue + Alerts */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lg font-semibold text-slate-950">Revenue Summary</p>
              <p className="mt-1 text-sm text-slate-500">Track today’s and recent sales performance.</p>
            </div>

            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
              <Activity className="h-3.5 w-3.5" />
              Live Metrics
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-slate-100 bg-linear-to-br from-blue-50 via-white to-white p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Today
                </p>
                <ShoppingCart className="h-5 w-5 text-blue-600" />
              </div>

              <p className="mt-4 text-3xl font-bold tracking-tight text-slate-950">
                {formatCurrency(data?.todayRevenue)}
              </p>
              <p className="mt-2 text-xs text-slate-500">Sales generated today</p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-linear-to-br from-emerald-50 via-white to-white p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Last 30 Days
                </p>
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>

              <p className="mt-4 text-3xl font-bold tracking-tight text-slate-950">
                {formatCurrency(data?.monthlyRevenue)}
              </p>
              <p className="mt-2 text-xs text-slate-500">Rolling monthly revenue</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-red-100 bg-linear-to-br from-red-50 via-white to-white p-6 shadow-sm">
          <div className="flex h-full flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-100">
                  <Bell className="h-5 w-5 text-red-700" />
                </div>

                <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-bold text-red-700">
                  {data?.unresolvedAlerts ?? 0}
                </span>
              </div>

              <p className="mt-6 text-lg font-semibold text-slate-950">Inventory Alerts</p>
              <p className="mt-6 text-lg font-semibold text-slate-950">Alerts</p>
              <p className="mt-2 text-4xl font-bold tracking-tight text-red-700">
                {data?.unresolvedAlerts ?? 0}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Unresolved alerts need review to keep operations on track.
              </p>
            </div>

            <Link
              href="/alerts"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 active:scale-95"
            >
              Review Alerts
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}


// 'use client';

// import Link from 'next/link';
// import { useEffect, useState } from 'react';
// import { useRouter } from 'next/navigation';

// interface DashboardData {
//   totalStockValue: number;
//   totalMedicines: number;
//   lowStockCount: number;
//   expiredCount: number;
//   todayRevenue: number;
//   monthlyRevenue: number;
//   unresolvedAlerts: number;
//   topSelling: Array<{ name: string; quantity: number; price: number }>;
// }

// export default function DashboardPage() {
//   const router = useRouter();
//   const [data, setData] = useState<DashboardData | null>(null);
//   const [isLoading, setIsLoading] = useState(true);
//   const [error, setError] = useState('');

//   useEffect(() => {
//     const token = localStorage.getItem('token');
//     if (!token) {
//       router.push('/login');
//       return;
//     }

//     fetchDashboardData();
//   }, [router]);

//   const fetchDashboardData = async () => {
//     try {
//       const token = localStorage.getItem('token');
//       const response = await fetch('/api/dashboard', {
//         headers: { Authorization: `Bearer ${token}` },
//       });

//       if (!response.ok) throw new Error('Failed to fetch dashboard data');

//       const dashboardData = await response.json();
//       setData(dashboardData);
//     } catch (err: any) {
//       setError(err.message);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   if (isLoading) {
//     return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600">Loading dashboard...</div>;
//   }

//   if (error) {
//     return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>;
//   }

//   return (
//     <div className="space-y-6">
//       <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
//         <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
//           <div>
//             <p className="text-sm font-medium text-slate-500">Clinic Overview</p>
//             <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Operations Dashboard</h1>
//             <p className="mt-2 text-sm text-slate-600">Track stock, revenue, alerts, and sales from a single view.</p>
//           </div>
//           <div className="flex flex-wrap gap-2">
//             <Link href="/billing" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
//               New Billing
//             </Link>
//             <Link href="/medicines" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
//               Manage Inventory
//             </Link>
//           </div>
//         </div>
//       </section>

//       <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
//         <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
//           <p className="text-sm text-slate-500">Stock Value</p>
//           <p className="mt-2 text-3xl font-semibold text-slate-900">₹{data?.totalStockValue?.toFixed(2) || '0.00'}</p>
//         </div>
//         <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
//           <p className="text-sm text-slate-500">Total Medicines</p>
//           <p className="mt-2 text-3xl font-semibold text-slate-900">{data?.totalMedicines || 0}</p>
//         </div>
//         <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
//           <p className="text-sm text-amber-700">Low Stock</p>
//           <p className="mt-2 text-3xl font-semibold text-amber-800">{data?.lowStockCount || 0}</p>
//         </div>
//         <div className="rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm">
//           <p className="text-sm text-red-700">Expired Medicines</p>
//           <p className="mt-2 text-3xl font-semibold text-red-800">{data?.expiredCount || 0}</p>
//         </div>
//       </section>

//       <section className="grid gap-4 md:grid-cols-2">
//         <Link
//           href="/dashboard/suppliers"
//           className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
//         >
//           <p className="text-sm font-medium text-slate-500">Procurement</p>
//           <h2 className="mt-2 text-xl font-semibold text-slate-900">Suppliers & Orders</h2>
//           <p className="mt-2 text-sm text-slate-600">Manage distributors, purchase orders, invoices, and stock receiving.</p>
//         </Link>
//         <Link
//           href="/dashboard/doctors"
//           className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
//         >
//           <p className="text-sm font-medium text-slate-500">Clinic Ops</p>
//           <h2 className="mt-2 text-xl font-semibold text-slate-900">Doctors & Prescriptions</h2>
//           <p className="mt-2 text-sm text-slate-600">Track doctors, patients, prescription uploads, and sale mapping.</p>
//         </Link>
//       </section>

//       <section className="grid gap-4 lg:grid-cols-3">
//         <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
//           <p className="text-sm text-slate-500">Revenue Summary</p>
//           <div className="mt-4 grid gap-3 sm:grid-cols-2">
//             <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
//               <p className="text-xs uppercase tracking-wide text-slate-500">Today</p>
//               <p className="mt-2 text-2xl font-semibold text-slate-900">₹{data?.todayRevenue?.toFixed(2) || '0.00'}</p>
//             </div>
//             <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
//               <p className="text-xs uppercase tracking-wide text-slate-500">Last 30 Days</p>
//               <p className="mt-2 text-2xl font-semibold text-slate-900">₹{data?.monthlyRevenue?.toFixed(2) || '0.00'}</p>
//             </div>
//           </div>
//         </div>

//         <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
//           <p className="text-sm text-slate-500">Alerts</p>
//           <p className="mt-2 text-3xl font-semibold text-slate-900">{data?.unresolvedAlerts || 0}</p>
//           <p className="mt-1 text-sm text-slate-600">Unresolved inventory alerts</p>
//           <Link href="/alerts" className="mt-4 inline-block rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
//             Review Alerts
//           </Link>
//         </div>
//       </section>

//       <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
//         <div className="border-b border-slate-200 px-5 py-4">
//           <h2 className="text-lg font-semibold text-slate-900">Top Selling Medicines</h2>
//         </div>
//         {data?.topSelling && data.topSelling.length > 0 ? (
//           <div className="overflow-x-auto">
//             <table className="min-w-full divide-y divide-slate-200">
//               <thead className="bg-slate-50">
//                 <tr>
//                   <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Medicine</th>
//                   <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Quantity</th>
//                   <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Unit Price</th>
//                 </tr>
//               </thead>
//               <tbody className="divide-y divide-slate-100 bg-white">
//                 {data.topSelling.map((medicine, index) => (
//                   <tr key={`${medicine.name}-${index}`} className="hover:bg-slate-50">
//                     <td className="px-4 py-3 text-sm font-medium text-slate-900">{medicine.name}</td>
//                     <td className="px-4 py-3 text-right text-sm text-slate-700">{medicine.quantity}</td>
//                     <td className="px-4 py-3 text-right text-sm text-slate-700">₹{medicine.price.toFixed(2)}</td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         ) : (
//           <p className="px-5 py-8 text-center text-sm text-slate-500">No sales data available yet.</p>
//         )}
//       </section>
//     </div>
//   );
// }