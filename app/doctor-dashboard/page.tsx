'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAuthHeaders } from '@/lib/utils/tenant-client';
import { normalizeReportFileUrl } from '@/lib/utils/report-file';
import {
  CalendarDays, ChevronLeft, ChevronRight, Loader2, Mail, Phone, Pill,
  Stethoscope, Trash2, FileText, FileImage, Eye, MessageSquare, Clock3,
  ChevronDown, FileCheck2, Send, User, Search, ClipboardList, Activity,
  Hash, ChevronUp, UserCheck,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type DoctorProfile = {
  _id: string;
  name: string;
  specialization: string;
  degree?: string;
  clinicName?: string;
  clinicAddress?: string;
  phone?: string;
  email?: string;
  consultationFee?: string | number;
  registrationNumber?: string;
  notes?: string;
  availableDays?: string[];
  availabilityNotes?: string;
  availabilitySlotMinutes?: number;
  availabilityWindows?: AvailabilityWindow[];
  availabilityExceptions?: AvailabilityException[];
};

type AvailabilityWindow = {
  title: string;
  daysOfWeek: string[];
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  note: string;
};

type AvailabilityException = {
  date: string;
  reason: string;
};

type CalendarMode = 'window' | 'exception';

type AppointmentRecord = {
  _id: string;
  appointmentDate: string;
  timeSlot: string;
  reason?: string;
  notes?: string;
  status?: 'booked' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  source?: string;
  patientId?: { _id: string; name?: string; phone?: string } | string;
  doctorId?: { _id: string; name?: string; specialization?: string } | string;
};

type AppointmentRescheduleForm = {
  appointmentDate: string;
  timeSlot: string;
};

type Prescription = {
  _id: string;
  issuedAt: string;
  doctorId?: { _id: string; name?: string; specialization?: string } | string;
  patientId?: { _id: string; name?: string; phone?: string } | string;
  prescriptionType?: 'image' | 'pdf' | 'manual';
  source?: 'clinic' | 'walk-in' | 'upload';
  status?: string;
  previousHistory?: string;
  investigationsGiven?: string;
  medicinesGiven?: string;
  rawText?: string;
  notes?: string;
  expiryAt?: string;
};

type PrescriptionWriteForm = {
  previousHistory: string;
  investigationsGiven: string;
  medicinesGiven: string;
  rawText: string;
  notes: string;
  issuedAt: string;
  expiryAt: string;
  source: 'clinic' | 'walk-in' | 'upload';
};

type MedicineEntry = {
  name: string;
  quantity: string;
  time: string;
};

type MedicineOption = {
  _id: string;
  name: string;
  brand?: string;
};

type PrescriptionFormState = {
  doctorId: string;
  patientId: string;
  prescriptionType: 'image' | 'pdf' | 'manual';
  source: 'clinic' | 'walk-in' | 'upload';
  previousHistory: string;
  investigationsGiven: string;
  medicinesGiven: string;
  rawText: string;
  notes: string;
  issuedAt: string;
  expiryAt: string;
  status: 'draft' | 'reviewed' | 'linked' | 'closed';
};

// ─── Form factories ───────────────────────────────────────────────────────────

const createEmptyPrescriptionWriteForm = (): PrescriptionWriteForm => ({
  previousHistory: '',
  investigationsGiven: '',
  medicinesGiven: '',
  rawText: '',
  notes: '',
  issuedAt: new Date().toISOString().slice(0, 10),
  expiryAt: '',
  source: 'clinic',
});

const createPrescriptionForm = (prescription?: Partial<Prescription>): PrescriptionFormState => ({
  doctorId: typeof prescription?.doctorId === 'string' ? prescription.doctorId : prescription?.doctorId?._id || '',
  patientId: typeof prescription?.patientId === 'string' ? prescription.patientId : prescription?.patientId?._id || '',
  prescriptionType: prescription?.prescriptionType || 'manual',
  source: prescription?.source || 'walk-in',
  previousHistory: prescription?.previousHistory || '',
  investigationsGiven: prescription?.investigationsGiven || '',
  medicinesGiven: prescription?.medicinesGiven || '',
  rawText: prescription?.rawText || '',
  notes: prescription?.notes || '',
  issuedAt: prescription?.issuedAt ? new Date(prescription.issuedAt).toISOString().slice(0, 10) : '',
  expiryAt: prescription?.expiryAt ? new Date(prescription.expiryAt).toISOString().slice(0, 10) : '',
  status: (prescription?.status as any) || 'draft',
});

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function parseMedicineEntries(value?: string) {
  if (!value) return [] as Array<{ name: string; quantity: string; time: string }>;
  return value
    .split(/\r?\n/)
    .map((line) => {
      const parts = line.split('|').map((part) => part.trim());
      if (parts.length >= 3) return { name: parts[0], quantity: parts[1], time: parts[2] };
      if (parts.length === 2) return { name: parts[0], quantity: parts[1], time: '' };
      if (parts[0]) return { name: parts[0], quantity: '', time: '' };
      return null;
    })
    .filter((entry): entry is { name: string; quantity: string; time: string } => entry !== null);
}

function formatIssuedDate(value?: string) {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN');
}

function formatRelativeDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
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

function formatFriendlyDate(value?: string) {
  if (!value) return 'No date set';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function normalizeAvailabilityDay(value: string) {
  return value.toLowerCase();
}

function normalizeAvailabilitySlotInterval(value?: number) {
  return value === 5 || value === 10 || value === 15 || value === 30 ? value : 15;
}

function getWeekdaysBetweenDates(startDate: string, endDate: string) {
  if (!startDate) return [];
  const start = parseDateKey(startDate);
  const end = parseDateKey(endDate || startDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  const rangeStart = start <= end ? start : end;
  const rangeEnd = start <= end ? end : start;
  const days = new Set<string>();
  const cursor = new Date(rangeStart);
  while (cursor <= rangeEnd) {
    days.add(normalizeAvailabilityDay(cursor.toLocaleDateString('en-US', { weekday: 'long' })));
    cursor.setDate(cursor.getDate() + 1);
  }
  return Array.from(days);
}

function formatDateRange(startDate: string, endDate: string) {
  if (!startDate && !endDate) return 'No date range set';
  if (!startDate) return endDate;
  if (!endDate) return startDate;
  return `${startDate} to ${endDate}`;
}

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function buildCalendarGrid(month: Date) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      key: formatDateKey(date),
      day: date.getDate(),
      inMonth: date.getMonth() === month.getMonth(),
      isToday: formatDateKey(date) === formatDateKey(new Date()),
    };
  });
}

function appointmentDayName(dateKey: string) {
  const date = parseDateKey(dateKey);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
}

function toMinutes(value?: string) {
  if (!value) return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (!meridiem && hours > 23) return null;

  return hours * 60 + minutes;
}

function formatMinutesAsTime(minutes: number) {
  const totalMinutes = ((minutes % 1440) + 1440) % 1440;
  const hours24 = Math.floor(totalMinutes / 60);
  const minutesPart = totalMinutes % 60;
  const meridiem = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${String(minutesPart).padStart(2, '0')} ${meridiem}`;
}

function buildTimeSlotLabel(startMinutes: number, intervalMinutes: number) {
  return `${formatMinutesAsTime(startMinutes)} - ${formatMinutesAsTime(startMinutes + intervalMinutes)}`;
}

function buildTimeSlotsForWindow(window: { startTime?: string; endTime?: string }, intervalMinutes: number) {
  const windowStart = toMinutes(window.startTime);
  const windowEnd = toMinutes(window.endTime);

  if (windowStart === null || windowEnd === null || windowEnd <= windowStart) {
    return [] as string[];
  }

  const slots: string[] = [];
  for (let current = windowStart; current + intervalMinutes <= windowEnd; current += intervalMinutes) {
    slots.push(buildTimeSlotLabel(current, intervalMinutes));
  }

  return slots;
}

function isWithinRange(dateKey: string, startDate?: string, endDate?: string) {
  if (startDate && dateKey < startDate) return false;
  if (endDate && dateKey > endDate) return false;
  return true;
}

function getDoctorSlotIntervalMinutes(doctor: DoctorProfile | null) {
  return normalizeAvailabilitySlotInterval(doctor?.availabilitySlotMinutes);
}

function getAvailableTimeSlotsForDoctor(doctor: DoctorProfile | null, dateKey: string) {
  if (!doctor) return [] as string[];

  const windows = doctor.availabilityWindows || [];
  if (windows.length === 0) return [] as string[];

  const intervalMinutes = getDoctorSlotIntervalMinutes(doctor);
  const slots = new Set<string>();

  windows.forEach((window) => {
    const matchesDays = !window.daysOfWeek || window.daysOfWeek.length === 0
      ? true
      : window.daysOfWeek.map(normalizeAvailabilityDay).includes(appointmentDayName(dateKey));
    const withinDateRange = isWithinRange(dateKey, window.startDate, window.endDate);

    if (!matchesDays || !withinDateRange) return;

    buildTimeSlotsForWindow(window, intervalMinutes).forEach((slot) => slots.add(slot));
  });

  return Array.from(slots);
}

function isDoctorAvailableOnDate(doctor: DoctorProfile | null, dateKey: string) {
  if (!doctor) return false;

  if ((doctor.availabilityExceptions || []).some((exception) => exception?.date === dateKey)) {
    return false;
  }

  const windows = doctor.availabilityWindows || [];
  if (windows.length > 0) {
    return windows.some((window) => {
      const matchesDays = !window.daysOfWeek || window.daysOfWeek.length === 0
        ? true
        : window.daysOfWeek.map(normalizeAvailabilityDay).includes(appointmentDayName(dateKey));

      return matchesDays && isWithinRange(dateKey, window.startDate, window.endDate);
    });
  }

  const availableDays = (doctor.availableDays || []).map(normalizeAvailabilityDay);
  if (availableDays.length === 0) return true;

  return availableDays.includes(appointmentDayName(dateKey));
}

function isDoctorAvailableAtTime(doctor: DoctorProfile | null, dateKey: string, timeSlot: string) {
  if (!doctor) return false;

  const availableSlots = getAvailableTimeSlotsForDoctor(doctor, dateKey);
  if (availableSlots.length === 0) {
    return isDoctorAvailableOnDate(doctor, dateKey);
  }

  return availableSlots.includes(timeSlot.trim());
}

function isWithinSelectedRange(dateKey: string, startDate: string, endDate: string) {
  if (!startDate) return false;
  if (!endDate) return dateKey === startDate;
  return dateKey >= startDate && dateKey <= endDate;
}

function createAvailabilityWindow(): AvailabilityWindow {
  return { title: '', daysOfWeek: [], startDate: '', endDate: '', startTime: '', endTime: '', note: '' };
}

function createAvailabilityException(): AvailabilityException {
  return { date: '', reason: '' };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getDoctorIdList(patient: any) {
  const assignedDoctorIds = Array.isArray(patient?.doctorIds) ? patient.doctorIds : [];
  const normalizedAssigned = assignedDoctorIds
    .map((item: any) => {
      if (typeof item === 'string') return item;
      return item?._id || item?.id || '';
    })
    .filter(Boolean);
  if (patient?.doctorId) {
    const primaryDoctorId = typeof patient.doctorId === 'string' ? patient.doctorId : patient.doctorId?._id;
    if (primaryDoctorId) normalizedAssigned.push(primaryDoctorId);
  }
  return Array.from(new Set(normalizedAssigned));
}

function buildMedicineSuggestions(medicines: MedicineOption[], value: string) {
  const query = value.trim().toLowerCase();
  if (!query) return medicines.slice(0, 8);
  return medicines
    .filter((medicine) => {
      const name = medicine.name?.toLowerCase?.() || '';
      const brand = medicine.brand?.toLowerCase?.() || '';
      return name.includes(query) || brand.includes(query);
    })
    .slice(0, 8);
}

function deriveAvailabilityDays(windows?: AvailabilityWindow[]) {
  return Array.from(
    new Set(
      (windows || [])
        .flatMap((window) =>
          window.daysOfWeek && window.daysOfWeek.length > 0
            ? window.daysOfWeek
            : getWeekdaysBetweenDates(window.startDate, window.endDate)
        )
        .map(normalizeAvailabilityDay)
        .filter(Boolean)
    )
  );
}

function canCancelAppointment(status?: string) {
  return !['cancelled', 'completed'].includes(status || '');
}

// ─── Report file helpers ──────────────────────────────────────────────────────

function getFileExtension(filename?: string) {
  return (filename ?? '').split('.').pop()?.toLowerCase() ?? '';
}

function isPdfFile(filename?: string) {
  return getFileExtension(filename) === 'pdf';
}

function isImageFile(filename?: string) {
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(getFileExtension(filename));
}

// ─── Patient avatar helpers ───────────────────────────────────────────────────

const PATIENT_PALETTES = [
  { bg: 'bg-violet-100', text: 'text-violet-700', ring: 'ring-violet-200', accent: 'bg-violet-600', light: 'bg-violet-50', border: 'border-violet-200' },
  { bg: 'bg-sky-100',    text: 'text-sky-700',    ring: 'ring-sky-200',    accent: 'bg-sky-600',    light: 'bg-sky-50',    border: 'border-sky-200'    },
  { bg: 'bg-amber-100',  text: 'text-amber-700',  ring: 'ring-amber-200',  accent: 'bg-amber-600',  light: 'bg-amber-50',  border: 'border-amber-200'  },
  { bg: 'bg-rose-100',   text: 'text-rose-700',   ring: 'ring-rose-200',   accent: 'bg-rose-600',   light: 'bg-rose-50',   border: 'border-rose-200'   },
  { bg: 'bg-emerald-100',text: 'text-emerald-700',ring: 'ring-emerald-200',accent: 'bg-emerald-600',light: 'bg-emerald-50',border: 'border-emerald-200'},
  { bg: 'bg-orange-100', text: 'text-orange-700', ring: 'ring-orange-200', accent: 'bg-orange-600', light: 'bg-orange-50', border: 'border-orange-200' },
];

function getPatientPalette(name?: string) {
  if (!name) return PATIENT_PALETTES[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PATIENT_PALETTES[Math.abs(hash) % PATIENT_PALETTES.length];
}

function getPatientInitials(name?: string) {
  if (!name) return 'P';
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

const SLOT_INTERVAL_OPTIONS = [5, 10, 15, 30] as const;

// ─── Shared sub-components ────────────────────────────────────────────────────

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-1 font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function PrescriptionSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        {icon}
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{title}</p>
        <div className="h-px flex-1 bg-slate-200" />
      </div>
      <div className="pt-4">{children}</div>
    </section>
  );
}

function PrescriptionPrintView({ prescription }: { prescription: Prescription }) {
  const doctor: any = typeof prescription.doctorId === 'object' ? prescription.doctorId : {};
  const patient: any = typeof prescription.patientId === 'object' ? prescription.patientId : {};
  const medicineEntries = parseMedicineEntries(prescription.medicinesGiven);
  const issuedDate = formatIssuedDate(prescription.issuedAt);
  const expiryDate = prescription.expiryAt ? formatIssuedDate(prescription.expiryAt) : null;

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="relative overflow-hidden bg-slate-950 px-7 py-6 text-white">
        <div className="absolute right-0 top-0 h-36 w-36 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-16 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-950">
              <Stethoscope className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight">{doctor?.name || 'Doctor'}</p>
              <p className="mt-1 text-sm text-slate-300">
                {[doctor?.degree, doctor?.specialization].filter(Boolean).join(' · ') || 'Medical Practitioner'}
              </p>
              {doctor?.registrationNumber && (
                <p className="mt-2 inline-flex rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-slate-200">
                  Reg. No: {doctor.registrationNumber}
                </p>
              )}
            </div>
          </div>
          <div className="text-sm text-slate-300 md:text-right">
            {doctor?.clinicName && <p className="font-semibold text-white">{doctor.clinicName}</p>}
            <div className="mt-2 space-y-1">
              {doctor?.phone && (
                <p className="inline-flex items-center gap-2 md:justify-end">
                  <Phone className="h-3.5 w-3.5" />
                  {doctor.phone}
                </p>
              )}
              {doctor?.email && (
                <p className="inline-flex items-center gap-2 md:justify-end">
                  <Mail className="h-3.5 w-3.5" />
                  {doctor.email}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-slate-200 bg-slate-50 px-7 py-5">
        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <div className="grid gap-3 sm:grid-cols-4">
            <InfoItem label="Patient" value={patient?.name || 'N/A'} />
            <InfoItem label="Age" value={patient?.age !== undefined ? `${patient.age} yrs` : 'N/A'} />
            <InfoItem label="Gender" value={patient?.gender || 'N/A'} />
            <InfoItem label="Phone" value={patient?.phone || 'N/A'} />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Issued Date</p>
            <p className="mt-1 font-semibold text-slate-900">{issuedDate}</p>
            {expiryDate && <p className="mt-1 text-xs text-slate-500">Valid until {expiryDate}</p>}
          </div>
        </div>
      </div>

      <div className="space-y-6 px-7 py-6">
        {prescription.previousHistory && (
          <PrescriptionSection title="History">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{prescription.previousHistory}</p>
          </PrescriptionSection>
        )}
        {prescription.investigationsGiven && (
          <PrescriptionSection title="Investigations">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{prescription.investigationsGiven}</p>
          </PrescriptionSection>
        )}
        <PrescriptionSection title="Medicines Prescribed" icon={<Pill className="h-4 w-4" />}>
          {medicineEntries.length > 0 ? (
            <div className="space-y-3">
              {medicineEntries.map((entry, idx) => (
                <div key={idx} className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-xs font-bold text-white">
                    {idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-950">{entry.name}</p>
                    <div className="mt-1.5 flex flex-wrap gap-2 text-xs">
                      {entry.quantity && (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
                          Qty: {entry.quantity}
                        </span>
                      )}
                      {entry.time && (
                        <span className="rounded-full bg-teal-50 px-2.5 py-1 font-medium text-teal-700">
                          {entry.time}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No medicines recorded.</p>
          )}
        </PrescriptionSection>
        {prescription.notes && (
          <PrescriptionSection title="Clinical Notes">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{prescription.notes}</p>
          </PrescriptionSection>
        )}
        {prescription.rawText && (
          <PrescriptionSection title="Raw Text">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{prescription.rawText}</p>
          </PrescriptionSection>
        )}
      </div>
    </div>
  );
}

// ─── Reports UI components ────────────────────────────────────────────────────

function ReportViewerModal({ report, onClose }: { report: any; onClose: () => void }) {
  const reportUrl = normalizeReportFileUrl(report?.fileUrl, report?.filename);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Report Preview</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">{report?.filename || 'Report'}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 bg-slate-100">
          {reportUrl ? (
            <iframe
              title={report?.filename || 'Report preview'}
              src={reportUrl}
              className="h-full min-h-[70vh] w-full bg-white"
            />
          ) : (
            <div className="flex h-[70vh] items-center justify-center text-sm text-slate-500">
              No report URL available.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DocumentChip({ report, onView }: { report: any; onView: () => void }) {
  const ext = getFileExtension(report.filename).toUpperCase() || 'FILE';
  const pdf = isPdfFile(report.filename);
  const img = isImageFile(report.filename);

  return (
    <button
      type="button"
      onClick={onView}
      className={[
        'group flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all duration-150 hover:shadow-sm',
        pdf
          ? 'border-red-100 bg-red-50/60 hover:border-red-200 hover:bg-red-50'
          : img
          ? 'border-sky-100 bg-sky-50/60 hover:border-sky-200 hover:bg-sky-50'
          : 'border-slate-200 bg-slate-50 hover:border-slate-300',
      ].join(' ')}
    >
      <div
        className={[
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          pdf ? 'bg-red-100 text-red-500' : img ? 'bg-sky-100 text-sky-500' : 'bg-slate-200 text-slate-500',
        ].join(' ')}
      >
        {img ? <FileImage className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-800 group-hover:text-slate-950">
          {report.filename || 'Document'}
        </p>
        <p className="text-xs text-slate-400">{ext} · click to open</p>
      </div>
      <div
        className={[
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-xl transition-colors',
          pdf
            ? 'bg-red-100 text-red-500 group-hover:bg-red-200'
            : img
            ? 'bg-sky-100 text-sky-500 group-hover:bg-sky-200'
            : 'bg-slate-200 text-slate-500 group-hover:bg-slate-300',
        ].join(' ')}
      >
        <Eye className="h-3.5 w-3.5" />
      </div>
    </button>
  );
}

function CommentBubble({ comment }: { comment: any }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 ring-2 ring-white">
        <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
      </div>
      <div className="flex-1">
        <div className="rounded-2xl rounded-tl-sm bg-blue-50 px-4 py-3 ring-1 ring-blue-100">
          <p className="text-sm leading-relaxed text-slate-800">{comment.comment}</p>
        </div>
        <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
          <Clock3 className="h-3 w-3" />
          {new Date(comment.createdAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}{' '}
          ·{' '}
          {new Date(comment.createdAt).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}

function ReportPost({
  report,
  patients,
  commentText,
  onView,
  onCommentChange,
  onCommentSubmit,
  onIssuePrescription,
  submittingComment,
  canComment,
  canIssuePrescription,
}: {
  report: any;
  patients: any[];
  commentText: string;
  onView: () => void;
  onCommentChange: (val: string) => void;
  onCommentSubmit: () => void;
  onIssuePrescription: () => void;
  submittingComment: boolean;
  canComment: boolean;
  canIssuePrescription: boolean;
}) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [showCommentBox, setShowCommentBox] = useState(false);

  const patientRaw = report?.patientId;
  const patient: any =
    typeof patientRaw === 'object' && patientRaw
      ? patientRaw
      : patients.find((p) => p._id === patientRaw) || null;
  const patientName: string = patient?.name || 'Unknown Patient';
  const patientPhone: string = patient?.phone || '';
  const palette = getPatientPalette(patientName);
  const initials = getPatientInitials(patientName);
  const hasComments = report.comments && report.comments.length > 0;

  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md">
      <div className="flex items-center gap-3 px-5 pb-4 pt-5">
        <div
          className={[
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-bold ring-2',
            palette.bg,
            palette.text,
            palette.ring,
          ].join(' ')}
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-900">{patientName}</p>
          <p className="truncate text-xs text-slate-400">
            {patientPhone ? `${patientPhone} · ` : ''}
            {formatRelativeDate(report.createdAt)}
          </p>
        </div>
        <div className="shrink-0 rounded-xl bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-500">
          {new Date(report.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
        </div>
      </div>

      <div className="mx-5 h-px bg-slate-100" />

      <div className="space-y-3 px-5 py-4">
        <div className="flex items-center gap-2">
          <FileCheck2 className="h-4 w-4 text-slate-400" />
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Uploaded Report</p>
        </div>
        <DocumentChip report={report} onView={onView} />
        <p className="flex items-center gap-1.5 text-xs text-slate-400">
          <CalendarDays className="h-3.5 w-3.5" />
          {new Date(report.createdAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </div>

      {hasComments && (
        <>
          <div className="mx-5 h-px bg-slate-100" />
          <div className="px-5 py-3">
            <button
              type="button"
              onClick={() => setCommentsOpen((v) => !v)}
              className="flex w-full items-center gap-2 text-left"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <MessageSquare className="h-4 w-4 shrink-0 text-blue-500" />
                <p className="truncate text-xs font-semibold text-blue-700">
                  {report.comments.length} comment{report.comments.length !== 1 ? 's' : ''}
                </p>
              </div>
              <ChevronDown
                className={[
                  'h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200',
                  commentsOpen ? 'rotate-180' : '',
                ].join(' ')}
              />
            </button>
            {commentsOpen && (
              <div className="mt-4 space-y-3">
                {report.comments.map((c: any, idx: number) => (
                  <CommentBubble key={idx} comment={c} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {showCommentBox && canComment && (
        <>
          <div className="mx-5 h-px bg-slate-100" />
          <div className="space-y-3 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Add a comment</p>
            <div className="relative">
              <textarea
                rows={3}
                value={commentText}
                onChange={(e) => onCommentChange(e.target.value)}
                placeholder="Write your clinical observation or instructions…"
                className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-400/10"
              />
              <button
                type="button"
                disabled={!commentText.trim() || submittingComment}
                onClick={onCommentSubmit}
                className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submittingComment ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
        {canComment && (
          <button
            type="button"
            onClick={() => setShowCommentBox((v) => !v)}
            className={[
              'inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold shadow-sm transition',
              showCommentBox
                ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700',
            ].join(' ')}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {showCommentBox ? 'Hide comment' : 'Add comment'}
          </button>
        )}
        {canIssuePrescription && (
          <button
            type="button"
            onClick={onIssuePrescription}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100"
          >
            <Pill className="h-3.5 w-3.5" />
            Issue Prescription
          </button>
        )}
        {hasComments && (
          <button
            type="button"
            onClick={() => setCommentsOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-blue-100 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-700 shadow-sm transition hover:bg-blue-100"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {commentsOpen ? 'Hide' : 'View'} comments
          </button>
        )}
      </div>
    </article>
  );
}

function ReportsSection({
  reports,
  reportsLoading,
  patients,
  commentText,
  onView,
  viewingReport,
  onCloseViewingReport,
  onCommentChange,
  onCommentSubmit,
  onIssuePrescription,
  submittingCommentId,
  canComment,
  canIssuePrescription,
}: {
  reports: any[];
  reportsLoading: boolean;
  patients: any[];
  commentText: Record<string, string>;
  onView: (report: any) => void;
  viewingReport: any | null;
  onCloseViewingReport: () => void;
  onCommentChange: (reportId: string, val: string) => void;
  onCommentSubmit: (reportId: string) => void;
  onIssuePrescription: (report: any) => void;
  submittingCommentId: string;
  canComment: boolean;
  canIssuePrescription: boolean;
}) {
  if (reportsLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-3xl border border-slate-200 bg-white py-14 shadow-sm">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        <p className="text-sm text-slate-500">Loading reports…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Patient Reports</p>
        <div className="h-px flex-1 bg-slate-200" />
        {reports.length > 0 && (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
            {reports.length}
          </span>
        )}
      </div>

      {reports.length > 0 ? (
        <div className="space-y-4">
          {reports.map((r) => (
            <ReportPost
              key={r._id}
              report={r}
              patients={patients}
              commentText={commentText[r._id] || ''}
              onView={() => onView(r)}
              onCommentChange={(val) => onCommentChange(r._id, val)}
              onCommentSubmit={() => onCommentSubmit(r._id)}
              onIssuePrescription={() => onIssuePrescription(r)}
              submittingComment={submittingCommentId === r._id}
              canComment={canComment}
              canIssuePrescription={canIssuePrescription}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-slate-200 bg-slate-50 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-300 shadow-sm ring-1 ring-slate-200">
            <FileCheck2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500">No reports yet</p>
            <p className="mt-1 text-xs text-slate-400">Patient-uploaded reports will appear here</p>
          </div>
        </div>
      )}

      {viewingReport && <ReportViewerModal report={viewingReport} onClose={onCloseViewingReport} />}
    </div>
  );
}

// ─── Patient Card Component ───────────────────────────────────────────────────

function PatientCard({
  patient,
  prescriptionCount,
  onWritePrescription,
  onViewPrescriptions,
}: {
  patient: any;
  prescriptionCount: number;
  onWritePrescription: () => void;
  onViewPrescriptions: () => void;
}) {
  const palette = getPatientPalette(patient.name);
  const initials = getPatientInitials(patient.name);
  const doctorCount = getDoctorIdList(patient).length;

  return (
    <div className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md">
      {/* Colored top accent strip */}
      {/* <div className={`h-1 w-full ${palette.accent}`} /> */}

      <div className="p-5">
        {/* Header: avatar + name + phone */}
        <div className="flex items-start gap-4">
          <div
            className={[
              'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold ring-2',
              palette.bg,
              palette.text,
              palette.ring,
            ].join(' ')}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-bold text-slate-900">{patient.name}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              {patient.phone ? (
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Phone className="h-3 w-3" />
                  {patient.phone}
                </span>
              ) : (
                <span className="text-xs text-slate-400 italic">No phone</span>
              )}
              {patient.email && (
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Mail className="h-3 w-3" />
                  {patient.email}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-4 grid grid-cols-3 divide-x divide-slate-100 rounded-2xl border border-slate-100 bg-slate-50">
          <div className="flex flex-col items-center py-3">
            <span className="text-lg font-bold text-slate-900">{prescriptionCount}</span>
            <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Rx</span>
          </div>
          <div className="flex flex-col items-center py-3">
            <span className="text-lg font-bold text-slate-900">{doctorCount}</span>
            <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Doctors</span>
          </div>
          <div className="flex flex-col items-center py-3">
            <span className={`text-lg font-bold ${patient.gender ? 'text-slate-900' : 'text-slate-300'}`}>
              {patient.gender ? patient.gender.charAt(0).toUpperCase() : '—'}
            </span>
            <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Gender</span>
          </div>
        </div>

        {/* Extra info chips */}
        <div className="mt-3 flex flex-wrap gap-2">
          {patient.age !== undefined && (
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
              <Activity className="h-3 w-3 text-slate-400" />
              {patient.age} yrs
            </span>
          )}
          {patient.bloodGroup && (
            <span className="inline-flex items-center gap-1 rounded-full border border-red-100 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
              <Hash className="h-3 w-3" />
              {patient.bloodGroup}
            </span>
          )}
          {patient.address && (
            <span className="max-w-[180px] truncate rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500">
              {patient.address}
            </span>
          )}
        </div>

        {/* Divider */}
        <div className="my-4 h-px bg-slate-100" />

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onWritePrescription}
            className={[
              'flex flex-1 items-center justify-center gap-2 rounded-2xl border py-2.5 text-sm font-semibold transition-all duration-150',
              'border-teal-200 bg-teal-50 text-teal-700 hover:border-teal-300 hover:bg-teal-100',
            ].join(' ')}
          >
            <Pill className="h-4 w-4" />
            Write Rx
          </button>
          <button
            onClick={onViewPrescriptions}
            className={[
              'flex flex-1 items-center justify-center gap-2 rounded-2xl border py-2.5 text-sm font-semibold transition-all duration-150',
              'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white',
            ].join(' ')}
          >
            <ClipboardList className="h-4 w-4" />
            {prescriptionCount > 0 ? `View ${prescriptionCount} Rx` : 'Prescriptions'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DoctorDashboardPage() {
  const router = useRouter();

  // Core data
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<'doctor' | 'staff' | 'admin' | 'owner' | 'patient' | 'super_admin'>('doctor');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [medicines, setMedicines] = useState<MedicineOption[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [viewingReport, setViewingReport] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Patient search
  const [patientSearch, setPatientSearch] = useState('');

  // Reports
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [submittingCommentId, setSubmittingCommentId] = useState('');

  // Prescription write modal
  const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState(false);
  const [activePrescriptionPatientId, setActivePrescriptionPatientId] = useState('');
  const [patientPrescriptionDraft, setPatientPrescriptionDraft] = useState<PrescriptionWriteForm>(
    createEmptyPrescriptionWriteForm()
  );
  const [medicineEntries, setMedicineEntries] = useState<MedicineEntry[]>([]);
  const [newMedicineEntry, setNewMedicineEntry] = useState<MedicineEntry>({ name: '', quantity: '', time: '' });
  const [medicineSuggestions, setMedicineSuggestions] = useState<MedicineOption[]>([]);
  const [showMedicineSuggestions, setShowMedicineSuggestions] = useState(false);
  const [patientPrescriptionStatus, setPatientPrescriptionStatus] = useState('');

  // Saved prescriptions modal
  const [isPatientPrescriptionsModalOpen, setIsPatientPrescriptionsModalOpen] = useState(false);
  const [activePatientPrescriptionsId, setActivePatientPrescriptionsId] = useState('');
  const [selectedSavedPrescription, setSelectedSavedPrescription] = useState<Prescription | null>(null);
  const [isSavedPrescriptionEditing, setIsSavedPrescriptionEditing] = useState(false);
  const [isSavedPrescriptionViewOpen, setIsSavedPrescriptionViewOpen] = useState(false);
  const [savedPrescriptionForm, setSavedPrescriptionForm] = useState<PrescriptionFormState | null>(null);
  const [savedPrescriptionStatus, setSavedPrescriptionStatus] = useState('');

  // Availability
  const [availabilityDays, setAvailabilityDays] = useState<string[]>([]);
  const [availabilityWindows, setAvailabilityWindows] = useState<AvailabilityWindow[]>([createAvailabilityWindow()]);
  const [availabilityExceptions, setAvailabilityExceptions] = useState<AvailabilityException[]>([
    createAvailabilityException(),
  ]);
  const [availabilityNotes, setAvailabilityNotes] = useState('');
  const [availabilitySlotMinutes, setAvailabilitySlotMinutes] = useState(15);
  const [availabilityStatus, setAvailabilityStatus] = useState('');
  const [cancellingAppointmentId, setCancellingAppointmentId] = useState('');
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [activeRescheduleAppointment, setActiveRescheduleAppointment] = useState<AppointmentRecord | null>(null);
  const [rescheduleForm, setRescheduleForm] = useState<AppointmentRescheduleForm>({
    appointmentDate: '',
    timeSlot: '',
  });
  const [rescheduleStatus, setRescheduleStatus] = useState('');
  const [rescheduleMonth, setRescheduleMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

  // Calendar
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('window');
  const [calendarMonth, setCalendarMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [calendarRangeStart, setCalendarRangeStart] = useState('');
  const [calendarRangeEnd, setCalendarRangeEnd] = useState('');
  const [calendarWindowTitle, setCalendarWindowTitle] = useState('');
  const [calendarExceptionDates, setCalendarExceptionDates] = useState<string[]>([]);

  const searchParams = useSearchParams();
  const activeSection = searchParams.get('section') || 'profile';

  const dayOptions = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const inputCls =
    'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400';
  const labelCls = 'mb-1.5 block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500';
  const canManageAnyDoctor = ['staff', 'admin', 'owner', 'super_admin'].includes(currentUserRole);

  const resolvedDoctorId =
    currentUserRole === 'doctor' ? profile?._id || selectedDoctorId : selectedDoctorId;

  const visibleAppointments = resolvedDoctorId
    ? appointments.filter((appointment) => {
        const doctorId = typeof appointment.doctorId === 'string' ? appointment.doctorId : appointment.doctorId?._id;
        return doctorId === resolvedDoctorId;
      })
    : appointments;

  const visibleReports = resolvedDoctorId
    ? reports.filter((report) => {
        const doctorId = typeof report.doctorId === 'string' ? report.doctorId : report.doctorId?._id;
        return doctorId === resolvedDoctorId;
      })
    : reports;

  const currentRescheduleDoctor = profile;
  const rescheduleCalendarGrid = buildCalendarGrid(rescheduleMonth);
  const rescheduleAvailableTimeSlots =
    currentRescheduleDoctor && rescheduleForm.appointmentDate
      ? getAvailableTimeSlotsForDoctor(currentRescheduleDoctor, rescheduleForm.appointmentDate)
      : [];
  const rescheduleSelectedDateLabel = rescheduleForm.appointmentDate
    ? formatAppointmentDate(rescheduleForm.appointmentDate)
    : 'No date selected';
  const rescheduleSelectedTimeAvailable =
    !rescheduleForm.appointmentDate || !rescheduleForm.timeSlot
      ? true
      : isDoctorAvailableAtTime(currentRescheduleDoctor, rescheduleForm.appointmentDate, rescheduleForm.timeSlot);

  const currentCalendarGrid = buildCalendarGrid(calendarMonth);
  const selectedCalendarRangeLabel = formatDateRange(calendarRangeStart, calendarRangeEnd);

  // ── Calendar helpers ────────────────────────────────────────────────────────

  const moveCalendarMonth = (offset: number) => {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  const handleCalendarDayClick = (dateKey: string) => {
    if (calendarMode === 'exception') {
      setCalendarExceptionDates((current) =>
        current.includes(dateKey) ? current.filter((item) => item !== dateKey) : [...current, dateKey]
      );
      return;
    }
    if (!calendarRangeStart || (calendarRangeStart && calendarRangeEnd)) {
      setCalendarRangeStart(dateKey);
      setCalendarRangeEnd('');
      return;
    }
    if (dateKey < calendarRangeStart) {
      setCalendarRangeEnd(calendarRangeStart);
      setCalendarRangeStart(dateKey);
      return;
    }
    setCalendarRangeEnd(dateKey);
  };

  const addCalendarWindowToDraft = () => {
    if (!calendarRangeStart) return;
    const nextWindow: AvailabilityWindow = {
      ...createAvailabilityWindow(),
      title: calendarWindowTitle.trim(),
      startDate: calendarRangeStart,
      endDate: calendarRangeEnd || calendarRangeStart,
      daysOfWeek: getWeekdaysBetweenDates(calendarRangeStart, calendarRangeEnd || calendarRangeStart),
    };
    setAvailabilityWindows((current) => {
      const blankIndex = current.findIndex((window) => isWindowEmpty(window));
      if (blankIndex >= 0) {
        const next = [...current];
        next[blankIndex] = nextWindow;
        return next;
      }
      return [...current, nextWindow];
    });
    setAvailabilityStatus('Calendar range added to availability windows.');
    setCalendarWindowTitle('');
    setCalendarRangeStart('');
    setCalendarRangeEnd('');
  };

  const addCalendarExceptionsToDraft = () => {
    if (calendarExceptionDates.length === 0) return;
    setAvailabilityExceptions((current) => {
      const existing = new Set(current.map((item) => item.date));
      const additions = calendarExceptionDates
        .filter((dateKey) => !existing.has(dateKey))
        .map((date) => ({ date, reason: '' }));
      return [...current, ...additions];
    });
    setAvailabilityStatus('Calendar exceptions added.');
    setCalendarExceptionDates([]);
  };

  // ── Availability helpers ────────────────────────────────────────────────────

  const updateAvailabilityWindow = (index: number, updates: Partial<AvailabilityWindow>) => {
    setAvailabilityWindows((current) =>
      current.map((window, windowIndex) => (windowIndex === index ? { ...window, ...updates } : window))
    );
  };

  const toggleAvailabilityWindowDay = (index: number, day: string) => {
    setAvailabilityWindows((current) =>
      current.map((window, windowIndex) => {
        if (windowIndex !== index) return window;
        return {
          ...window,
          daysOfWeek: window.daysOfWeek.includes(day)
            ? window.daysOfWeek.filter((item) => item !== day)
            : [...window.daysOfWeek, day],
        };
      })
    );
  };

  const addAvailabilityWindow = () => {
    setAvailabilityWindows((current) => [...current, createAvailabilityWindow()]);
  };

  const removeAvailabilityWindow = (index: number) => {
    setAvailabilityWindows((current) =>
      current.length > 1 ? current.filter((_, windowIndex) => windowIndex !== index) : current
    );
  };

  const updateAvailabilityException = (index: number, updates: Partial<AvailabilityException>) => {
    setAvailabilityExceptions((current) =>
      current.map((exception, exceptionIndex) =>
        exceptionIndex === index ? { ...exception, ...updates } : exception
      )
    );
  };

  const addAvailabilityException = () => {
    setAvailabilityExceptions((current) => [...current, createAvailabilityException()]);
  };

  const removeAvailabilityException = (index: number) => {
    setAvailabilityExceptions((current) =>
      current.length > 1 ? current.filter((_, exceptionIndex) => exceptionIndex !== index) : current
    );
  };

  const collectAvailabilityDays = () => deriveAvailabilityDays(availabilityWindows);

  const isWindowEmpty = (window: AvailabilityWindow) =>
    !window.title.trim() &&
    window.daysOfWeek.length === 0 &&
    !window.startDate.trim() &&
    !window.endDate.trim() &&
    !window.startTime.trim() &&
    !window.endTime.trim() &&
    !window.note.trim();

  const isExceptionEmpty = (exception: AvailabilityException) =>
    !exception.date.trim() && !exception.reason.trim();

  const filteredAvailabilityWindows = availabilityWindows.filter((window) => !isWindowEmpty(window));
  const filteredAvailabilityExceptions = availabilityExceptions.filter(
    (exception) => !isExceptionEmpty(exception)
  );
  const serializedAvailabilityDays = collectAvailabilityDays();

  const resetAvailabilityDrafts = (payload: any) => {
    const nextWindows =
      Array.isArray(payload.availabilityWindows) && payload.availabilityWindows.length > 0
        ? payload.availabilityWindows.map((window: any) => ({
            title: window.title || '',
            daysOfWeek:
              Array.isArray(window.daysOfWeek) && window.daysOfWeek.length > 0
                ? window.daysOfWeek
                : getWeekdaysBetweenDates(window.startDate || '', window.endDate || ''),
            startDate: window.startDate || '',
            endDate: window.endDate || '',
            startTime: window.startTime || '',
            endTime: window.endTime || '',
            note: window.note || '',
          }))
        : [createAvailabilityWindow()];
    const nextExceptions =
      Array.isArray(payload.availabilityExceptions) && payload.availabilityExceptions.length > 0
        ? payload.availabilityExceptions.map((exception: any) => ({
            date: exception.date || '',
            reason: exception.reason || '',
          }))
        : [createAvailabilityException()];
    setAvailabilityDays(
      Array.isArray(payload.availableDays) && payload.availableDays.length > 0
        ? payload.availableDays
        : deriveAvailabilityDays(nextWindows)
    );
    setAvailabilityNotes(payload.availabilityNotes || availabilityNotes);
    setAvailabilitySlotMinutes(normalizeAvailabilitySlotInterval(Number(payload.availabilitySlotMinutes)));
    setAvailabilityWindows(nextWindows);
    setAvailabilityExceptions(nextExceptions);
  };

  const handleAvailabilitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAvailabilityStatus('');

    if (!resolvedDoctorId) {
      setAvailabilityStatus('Select a doctor first.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/doctors/${resolvedDoctorId}/availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders(token) },
        body: JSON.stringify({
          availableDays: serializedAvailabilityDays,
          availabilityNotes,
          availabilitySlotMinutes,
          availabilityWindows: filteredAvailabilityWindows,
          availabilityExceptions: filteredAvailabilityExceptions,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to save availability');
      resetAvailabilityDrafts(payload);
      setAvailabilityStatus('Availability updated.');
    } catch (err: any) {
      setAvailabilityStatus(err.message || 'Failed to save availability');
    }
  };

  const openRescheduleModal = (appointment: AppointmentRecord) => {
    setActiveRescheduleAppointment(appointment);
    setRescheduleForm({
      appointmentDate: appointment.appointmentDate,
      timeSlot: appointment.timeSlot,
    });
    setRescheduleMonth(() => {
      const date = parseDateKey(appointment.appointmentDate);
      return Number.isNaN(date.getTime()) ? new Date(new Date().getFullYear(), new Date().getMonth(), 1) : new Date(date.getFullYear(), date.getMonth(), 1);
    });
    setRescheduleStatus('');
    setIsRescheduleModalOpen(true);
  };

  const closeRescheduleModal = () => {
    setIsRescheduleModalOpen(false);
    setActiveRescheduleAppointment(null);
    setRescheduleForm({ appointmentDate: '', timeSlot: '' });
    setRescheduleStatus('');
  };

  const moveRescheduleMonth = (offset: number) => {
    setRescheduleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  const handleRescheduleDateClick = (dateKey: string) => {
    if (!currentRescheduleDoctor) return;
    if (!isDoctorAvailableOnDate(currentRescheduleDoctor, dateKey)) return;
    setRescheduleForm((current) => ({ ...current, appointmentDate: dateKey }));
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRescheduleAppointment) return;
    if (!rescheduleForm.appointmentDate.trim() || !rescheduleForm.timeSlot.trim()) {
      setRescheduleStatus('Please enter both the date and time slot.');
      return;
    }
    if (!isDoctorAvailableAtTime(currentRescheduleDoctor, rescheduleForm.appointmentDate, rescheduleForm.timeSlot)) {
      setRescheduleStatus('Please choose an available date and slot.');
      return;
    }

    setRescheduleStatus('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/appointments/${activeRescheduleAppointment._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders(token) },
        body: JSON.stringify({
          appointmentDate: rescheduleForm.appointmentDate.trim(),
          timeSlot: rescheduleForm.timeSlot.trim(),
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to reschedule appointment');
      }

      setAppointments((current) =>
        current.map((item) => (item._id === activeRescheduleAppointment._id ? { ...item, ...payload } : item))
      );
      setAvailabilityStatus('Appointment rescheduled.');
      closeRescheduleModal();
    } catch (err: any) {
      setRescheduleStatus(err.message || 'Failed to reschedule appointment');
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
      if (!response.ok) throw new Error(payload.error || 'Failed to cancel appointment');
      setAppointments((current) =>
        current.map((appointment) =>
          appointment._id === appointmentId ? { ...appointment, status: 'cancelled' } : appointment
        )
      );
      setAvailabilityStatus('Appointment cancelled.');
    } catch (err: any) {
      setAvailabilityStatus(err.message || 'Failed to cancel appointment');
    } finally {
      setCancellingAppointmentId('');
    }
  };

  // ── Data loading ────────────────────────────────────────────────────────────

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userRaw = localStorage.getItem('user');
    const user = userRaw ? JSON.parse(userRaw) : null;
    setCurrentUserRole(user?.role || 'doctor');

    if (!token) {
      router.push('/login');
      return;
    }
    void loadData();
  }, [router]);

  const loadData = async () => {
    try {
      const token = localStorage.getItem('token');
      const userRaw = localStorage.getItem('user');
      const user = userRaw ? JSON.parse(userRaw) : null;

      const [doctorsRes, profileRes, prescriptionsRes] = await Promise.all([
        fetch('/api/doctors', { headers: getAuthHeaders(token) }),
        fetch('/api/doctors/me', { headers: getAuthHeaders(token) }),
        fetch('/api/prescriptions', { headers: getAuthHeaders(token) }),
        fetch('/api/patients', { headers: getAuthHeaders(token) }),
        fetch('/api/medicines', { headers: getAuthHeaders(token) }),
      ]);
      if (!doctorsRes.ok || !profileRes.ok || !prescriptionsRes.ok) throw new Error('Failed to load doctor dashboard');

      const doctorsData = await doctorsRes.json();
      const profileData = await profileRes.json();
      const prescriptionData = await prescriptionsRes.json();
      const patientsData = await (
        await fetch('/api/patients', { headers: getAuthHeaders(token) })
      ).json();
      const medicinesData = await (
        await fetch('/api/medicines', { headers: getAuthHeaders(token) })
      ).json();
      const appointmentsRes = await fetch('/api/appointments', { headers: getAuthHeaders(token) });
      const appointmentsData = appointmentsRes.ok ? await appointmentsRes.json() : [];

      const nextWindows =
        Array.isArray(profileData?.availabilityWindows) && profileData.availabilityWindows.length > 0
          ? profileData.availabilityWindows.map((window: any) => ({
              title: window.title || '',
              daysOfWeek:
                Array.isArray(window.daysOfWeek) && window.daysOfWeek.length > 0
                  ? window.daysOfWeek
                  : getWeekdaysBetweenDates(window.startDate || '', window.endDate || ''),
              startDate: window.startDate || '',
              endDate: window.endDate || '',
              startTime: window.startTime || '',
              endTime: window.endTime || '',
              note: window.note || '',
            }))
          : [createAvailabilityWindow()];
      const nextAvailabilityDays =
        Array.isArray(profileData?.availableDays) && profileData.availableDays.length > 0
          ? profileData.availableDays
          : deriveAvailabilityDays(nextWindows);
      const nextExceptions =
        Array.isArray(profileData?.availabilityExceptions) &&
        profileData.availabilityExceptions.length > 0
          ? profileData.availabilityExceptions.map((exception: any) => ({
              date: exception.date || '',
              reason: exception.reason || '',
            }))
          : [createAvailabilityException()];

      const nextDoctors = Array.isArray(doctorsData) ? doctorsData : [];
      const nextSelectedDoctorId =
        currentUserRole === 'doctor'
          ? profileData?._id || ''
          : searchParams.get('doctorId') || nextDoctors[0]?._id || '';
      const selectedDoctor =
        currentUserRole === 'doctor'
          ? profileData
          : nextDoctors.find((doctor: DoctorProfile) => doctor._id === nextSelectedDoctorId) || nextDoctors[0] || profileData;

      setDoctors(nextDoctors);
      setSelectedDoctorId(nextSelectedDoctorId);
      setProfile(selectedDoctor || null);
      setAvailabilityDays(
        Array.isArray(selectedDoctor?.availableDays) && selectedDoctor.availableDays.length > 0
          ? selectedDoctor.availableDays
          : deriveAvailabilityDays(nextWindows)
      );
      setAvailabilityNotes(selectedDoctor?.availabilityNotes || '');
      setAvailabilitySlotMinutes(
        normalizeAvailabilitySlotInterval(Number(selectedDoctor?.availabilitySlotMinutes))
      );
      setAvailabilityWindows(
        Array.isArray(selectedDoctor?.availabilityWindows) && selectedDoctor.availabilityWindows.length > 0
          ? selectedDoctor.availabilityWindows.map((window: any) => ({
              title: window.title || '',
              daysOfWeek:
                Array.isArray(window.daysOfWeek) && window.daysOfWeek.length > 0
                  ? window.daysOfWeek
                  : getWeekdaysBetweenDates(window.startDate || '', window.endDate || ''),
              startDate: window.startDate || '',
              endDate: window.endDate || '',
              startTime: window.startTime || '',
              endTime: window.endTime || '',
              note: window.note || '',
            }))
          : nextWindows
      );
      setAvailabilityExceptions(
        Array.isArray(selectedDoctor?.availabilityExceptions) && selectedDoctor.availabilityExceptions.length > 0
          ? selectedDoctor.availabilityExceptions.map((exception: any) => ({
              date: exception.date || '',
              reason: exception.reason || '',
            }))
          : nextExceptions
      );
      setPrescriptions(
        profileData?._id
          ? prescriptionData.filter((item: Prescription) => {
              if (typeof item.doctorId === 'string') return item.doctorId === profileData._id;
              return item.doctorId?._id === profileData._id;
            })
          : []
      );
      setPatients(Array.isArray(patientsData) ? patientsData : []);
      setMedicines(Array.isArray(medicinesData) ? medicinesData : []);
      setAppointments(Array.isArray(appointmentsData) ? appointmentsData : []);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const selectDoctor = (doctorId: string) => {
    setSelectedDoctorId(doctorId);

    const nextDoctor = doctors.find((doctor) => doctor._id === doctorId) || null;
    if (!nextDoctor) return;

    setProfile(nextDoctor);
    resetAvailabilityDrafts(nextDoctor);
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    let mounted = true;
    setReportsLoading(true);
    fetch('/api/reports', { headers: getAuthHeaders(token) })
      .then((res) => res.json())
      .then((data) => {
        if (!mounted) return;
        setReports(Array.isArray(data) ? data : []);
      })
      .catch(() => {})
      .finally(() => setReportsLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  // ── Report handlers ─────────────────────────────────────────────────────────

  const handleCommentChange = (reportId: string, val: string) => {
    setCommentText((c) => ({ ...c, [reportId]: val }));
  };

  const handleCommentSubmit = async (reportId: string) => {
    const comment = commentText[reportId]?.trim();
    if (!comment) return;
    setSubmittingCommentId(reportId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders(token) },
        body: JSON.stringify({ reportId, comment }),
      });
      if (res.ok) {
        const updated = await res.json();
        setReports((all) => all.map((item) => (item._id === updated._id ? updated : item)));
        setCommentText((c) => ({ ...c, [reportId]: '' }));
      }
    } catch (err) {
      /* ignore */
    } finally {
      setSubmittingCommentId('');
    }
  };

  // ── Derived values ──────────────────────────────────────────────────────────

  const activePatientPrescriptions =
    patients.find((p) => p._id === activePatientPrescriptionsId) || null;
  const patientSavedPrescriptions = activePatientPrescriptionsId
    ? prescriptions.filter((item) => {
        const patientId =
          typeof item.patientId === 'string' ? item.patientId : item.patientId?._id;
        return patientId === activePatientPrescriptionsId;
      })
    : [];
  const activePrescriptionPatient =
    patients.find((p) => p._id === activePrescriptionPatientId) || null;

  // Filtered patients for this doctor
  const myPatients = patients.filter((p) =>
    getDoctorIdList(p).includes(profile?._id || '')
  );

  // Search-filtered patients
  const searchedPatients = patientSearch.trim()
    ? myPatients.filter(
        (p) =>
          p.name?.toLowerCase().includes(patientSearch.toLowerCase()) ||
          p.phone?.includes(patientSearch) ||
          p.email?.toLowerCase().includes(patientSearch.toLowerCase())
      )
    : myPatients;

  // ── Modal handlers ──────────────────────────────────────────────────────────

  const openPrescriptionModal = (patient: any) => {
    setActivePrescriptionPatientId(patient._id);
    setPatientPrescriptionDraft(createEmptyPrescriptionWriteForm());
    setMedicineEntries([]);
    setNewMedicineEntry({ name: '', quantity: '', time: '' });
    setMedicineSuggestions([]);
    setShowMedicineSuggestions(false);
    setPatientPrescriptionStatus('');
    setIsPrescriptionModalOpen(true);
  };

  const openReportPrescriptionModal = (report: any) => {
    const reportPatient =
      (typeof report?.patientId === 'object' && report.patientId) ||
      patients.find((patient) => patient._id === report?.patientId) ||
      null;
    if (!reportPatient?._id) {
      setError('Patient profile not found for this report');
      return;
    }
    openPrescriptionModal(reportPatient);
  };

  const closePrescriptionModal = () => {
    setIsPrescriptionModalOpen(false);
    setActivePrescriptionPatientId('');
    setPatientPrescriptionDraft(createEmptyPrescriptionWriteForm());
    setMedicineEntries([]);
    setNewMedicineEntry({ name: '', quantity: '', time: '' });
    setMedicineSuggestions([]);
    setShowMedicineSuggestions(false);
    setPatientPrescriptionStatus('');
  };

  const openPatientPrescriptionsModal = (patient: any) => {
    setActivePatientPrescriptionsId(patient._id);
    setSelectedSavedPrescription(null);
    setIsSavedPrescriptionEditing(false);
    setSavedPrescriptionForm(null);
    setSavedPrescriptionStatus('');
    setIsPatientPrescriptionsModalOpen(true);
  };

  const closePatientPrescriptionsModal = () => {
    setIsPatientPrescriptionsModalOpen(false);
    setActivePatientPrescriptionsId('');
    setSelectedSavedPrescription(null);
    setIsSavedPrescriptionEditing(false);
    setSavedPrescriptionForm(null);
    setSavedPrescriptionStatus('');
  };

  const openSavedPrescription = (prescription: Prescription, mode: 'view' | 'edit' = 'view') => {
    setSelectedSavedPrescription(prescription);
    setSavedPrescriptionForm(createPrescriptionForm(prescription));
    setIsSavedPrescriptionEditing(mode === 'edit');
    setIsSavedPrescriptionViewOpen(mode === 'view');
    setSavedPrescriptionStatus('');
  };

  const closeSavedPrescription = () => {
    setSelectedSavedPrescription(null);
    setSavedPrescriptionForm(null);
    setIsSavedPrescriptionEditing(false);
    setIsSavedPrescriptionViewOpen(false);
    setSavedPrescriptionStatus('');
  };

  const handleSavedPrescriptionUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSavedPrescription || !savedPrescriptionForm) return;
    setError('');
    setSavedPrescriptionStatus('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/prescriptions/${selectedSavedPrescription._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders(token) },
        body: JSON.stringify({
          ...savedPrescriptionForm,
          issuedAt: savedPrescriptionForm.issuedAt || undefined,
          expiryAt: savedPrescriptionForm.expiryAt || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update prescription');
      }
      const updated = await res.json();
      setPrescriptions((current) => current.map((item) => (item._id === updated._id ? updated : item)));
      setSelectedSavedPrescription(updated);
      setSavedPrescriptionForm(createPrescriptionForm(updated));
      setIsSavedPrescriptionEditing(false);
      setIsSavedPrescriptionViewOpen(true);
      setSavedPrescriptionStatus('Prescription updated.');
    } catch (err: any) {
      setSavedPrescriptionStatus(err.message || 'Failed to update prescription');
    }
  };

  const printSavedPrescription = (prescription: Prescription) => {
    const printWindow = window.open('', '_blank', 'width=900,height=1100');
    if (!printWindow) {
      setSavedPrescriptionStatus('Please allow pop-ups to print the prescription.');
      return;
    }
    const medicineRows = parseMedicineEntries(prescription.medicinesGiven)
      .map(
        (entry, index) =>
          `<tr><td>${index + 1}</td><td>${escapeHtml(entry.name)}</td><td>${escapeHtml(entry.quantity || '')}</td><td>${escapeHtml(entry.time || '')}</td></tr>`
      )
      .join('');
    const doctor: any = typeof prescription.doctorId === 'object' ? prescription.doctorId : null;
    const patient = typeof prescription.patientId === 'object' ? prescription.patientId : null;
    const doctorTitle =
      [doctor?.degree, doctor?.specialization].filter(Boolean).join(' · ') || 'Medical Practitioner';
    const statusLabel = prescription.status || 'draft';
    const signatureName = doctor?.name || 'Doctor';
    const issuedDate = formatIssuedDate(prescription.issuedAt);
    const expiryDate = prescription.expiryAt ? formatIssuedDate(prescription.expiryAt) : 'N/A';

    const html = `
      <!doctype html>
      <html>
        <head>
          <title>Prescription ${prescription._id}</title>
          <style>
            :root { color-scheme: light; }
            * { box-sizing: border-box; }
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #0f172a; background: #f8fafc; }
            @page { size: A4; margin: 12mm; }
            .sheet { max-width: 820px; margin: 0 auto; border: 1px solid #dbe4ee; border-radius: 24px; overflow: hidden; background: #fff; box-shadow: 0 20px 60px rgba(15, 23, 42, 0.08); }
            .topbar { background: linear-gradient(135deg, #0f172a, #0f766e); color: #fff; padding: 24px 28px; position: relative; overflow: hidden; }
            .topbar::after { content: ''; position: absolute; inset: auto -40px -60px auto; width: 180px; height: 180px; border-radius: 999px; background: rgba(255,255,255,0.08); filter: blur(4px); }
            .brand { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; position: relative; z-index: 1; }
            .brand h1 { margin: 0; font-size: 28px; line-height: 1.1; letter-spacing: -0.03em; }
            .brand p { margin: 4px 0 0; color: rgba(226,232,240,0.92); font-size: 13px; }
            .pill { display: inline-flex; align-items: center; border: 1px solid rgba(255,255,255,0.22); background: rgba(255,255,255,0.08); padding: 7px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
            .subhead { padding: 18px 28px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
            .meta-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
            .meta-card { background: #fff; border: 1px solid #dbe4ee; border-radius: 16px; padding: 14px 14px 12px; min-height: 72px; box-shadow: 0 8px 24px rgba(15,23,42,0.04); }
            .meta-label { margin: 0; font-size: 10px; font-weight: 800; letter-spacing: .16em; color: #64748b; text-transform: uppercase; }
            .meta-value { margin: 8px 0 0; font-size: 14px; font-weight: 700; color: #0f172a; }
            .meta-sub { margin: 4px 0 0; font-size: 11px; color: #64748b; }
            .block { padding: 24px 28px 22px; }
            h2,h3,p { margin: 0; }
            .section { border: 1px solid #dbe4ee; border-radius: 18px; padding: 16px 18px; margin-bottom: 14px; background: #fff; }
            .section-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
            .section-title { font-size: 11px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; color: #0f766e; }
            .section-bar { flex: 1; height: 1px; background: linear-gradient(90deg, rgba(15,118,110,0.45), rgba(148,163,184,0.15)); }
            .section-copy { white-space: pre-wrap; line-height: 1.65; font-size: 13px; color: #334155; }
            table { width: 100%; border-collapse: collapse; }
            th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid #e2e8f0; font-size: 13px; vertical-align: top; }
            th { font-size: 10px; text-transform: uppercase; letter-spacing: .14em; color: #64748b; }
            tbody tr:nth-child(even) td { background: #f8fafc; }
            .footer { display: grid; grid-template-columns: 1fr 220px; gap: 18px; margin-top: 24px; }
            .note-box { border: 1px dashed #cbd5e1; border-radius: 16px; padding: 14px 16px; color: #475569; font-size: 12px; line-height: 1.55; }
            .signature { border-top: 1px solid #cbd5e1; padding-top: 14px; text-align: center; color: #0f172a; }
            .signature .line { height: 1px; background: #94a3b8; margin-bottom: 10px; }
            .signature .name { font-weight: 700; }
            .signature .role { margin-top: 2px; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: #64748b; }
            @media print { body { padding: 0; background: #fff; } .sheet { border: 0; border-radius: 0; box-shadow: none; } .topbar::after { display: none; } }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="topbar">
              <div class="brand">
                <div>
                  <div class="pill">Prescription</div>
                  <h1>${escapeHtml(doctor?.name || 'Doctor')}</h1>
                  <p>${escapeHtml(doctorTitle)}</p>
                  ${doctor?.clinicName ? `<p>${escapeHtml(doctor.clinicName)}</p>` : ''}
                </div>
                <div style="text-align:right;">
                  <div class="pill">${escapeHtml(statusLabel)}</div>
                  <p style="margin-top:12px; font-size:12px; color: rgba(226,232,240,0.9);">Prescription ID</p>
                  <p style="font-size:14px; font-weight:700; letter-spacing:.02em;">${escapeHtml(prescription._id)}</p>
                </div>
              </div>
            </div>
            <div class="subhead">
              <div class="meta-grid">
                <div class="meta-card"><p class="meta-label">Patient</p><p class="meta-value">${escapeHtml((patient as any)?.name || 'N/A')}</p><p class="meta-sub">${escapeHtml((patient as any)?.phone || 'No phone')}</p></div>
                <div class="meta-card"><p class="meta-label">Issued</p><p class="meta-value">${escapeHtml(issuedDate)}</p><p class="meta-sub">${expiryDate !== 'N/A' ? `Valid until ${escapeHtml(expiryDate)}` : 'No expiry date'}</p></div>
                <div class="meta-card"><p class="meta-label">Source</p><p class="meta-value">${escapeHtml(prescription.source || 'walk-in')}</p><p class="meta-sub">${escapeHtml(prescription.prescriptionType || 'manual')}</p></div>
                <div class="meta-card"><p class="meta-label">Status</p><p class="meta-value">${escapeHtml(statusLabel)}</p><p class="meta-sub">Doctor dashboard print view</p></div>
              </div>
            </div>
            <div class="block">
              ${prescription.previousHistory ? `<div class="section"><div class="section-head"><div class="section-title">History</div><div class="section-bar"></div></div><div class="section-copy">${escapeHtml(prescription.previousHistory).replace(/\n/g, '<br/>')}</div></div>` : ''}
              ${prescription.investigationsGiven ? `<div class="section"><div class="section-head"><div class="section-title">Investigations</div><div class="section-bar"></div></div><div class="section-copy">${escapeHtml(prescription.investigationsGiven).replace(/\n/g, '<br/>')}</div></div>` : ''}
              <div class="section"><div class="section-head"><div class="section-title">Medicines Prescribed</div><div class="section-bar"></div></div><table><thead><tr><th>#</th><th>Name</th><th>Qty</th><th>Time</th></tr></thead><tbody>${medicineRows || '<tr><td colspan="4">No medicines recorded.</td></tr>'}</tbody></table></div>
              ${prescription.notes ? `<div class="section"><div class="section-head"><div class="section-title">Clinical Notes</div><div class="section-bar"></div></div><div class="section-copy">${escapeHtml(prescription.notes).replace(/\n/g, '<br/>')}</div></div>` : ''}
              ${prescription.rawText ? `<div class="section"><div class="section-head"><div class="section-title">Raw Text</div><div class="section-bar"></div></div><div class="section-copy">${escapeHtml(prescription.rawText).replace(/\n/g, '<br/>')}</div></div>` : ''}
              <div class="footer">
                <div class="note-box">Instructions: print on A4 paper for best results. This prescription copy is generated from the patient record in the dashboard.</div>
                <div class="signature"><div class="line"></div><div class="name">${escapeHtml(signatureName)}</div><div class="role">Signature / Stamp</div></div>
              </div>
            </div>
          </div>
          <script>window.onload = function () { window.print(); window.onafterprint = function () { window.close(); }; };</script>
        </body>
      </html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // ── Medicine helpers ────────────────────────────────────────────────────────

  const addMedicineEntry = () => {
    if (!newMedicineEntry.name.trim()) return;
    setMedicineEntries((current) => [...current, { ...newMedicineEntry }]);
    setNewMedicineEntry({ name: '', quantity: '', time: '' });
    setMedicineSuggestions([]);
    setShowMedicineSuggestions(false);
  };

  const removeMedicineEntry = (index: number) => {
    setMedicineEntries((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleMedicineNameChange = (value: string) => {
    setNewMedicineEntry((current) => ({ ...current, name: value }));
    setMedicineSuggestions(buildMedicineSuggestions(medicines, value));
    setShowMedicineSuggestions(true);
  };

  const selectMedicineSuggestion = (medicine: MedicineOption) => {
    setNewMedicineEntry((current) => ({ ...current, name: medicine.name }));
    setMedicineSuggestions([]);
    setShowMedicineSuggestions(false);
  };

  const handlePrescriptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePrescriptionPatientId || !profile?._id) return;
    setPatientPrescriptionStatus('');
    setError('');
    try {
      const token = localStorage.getItem('token');
      const formattedMedicines = [
        ...medicineEntries,
        ...(newMedicineEntry.name.trim() ? [{ ...newMedicineEntry }] : []),
      ]
        .filter((entry) => entry.name.trim())
        .map((entry) => `${entry.name}|${entry.quantity}|${entry.time}`)
        .join('\n');

      const res = await fetch('/api/prescriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders(token) },
        body: JSON.stringify({
          doctorId: profile._id,
          patientId: activePrescriptionPatientId,
          previousHistory: patientPrescriptionDraft.previousHistory || undefined,
          investigationsGiven: patientPrescriptionDraft.investigationsGiven || undefined,
          medicinesGiven: formattedMedicines || patientPrescriptionDraft.medicinesGiven || undefined,
          rawText: patientPrescriptionDraft.rawText || undefined,
          notes: patientPrescriptionDraft.notes || undefined,
          issuedAt: patientPrescriptionDraft.issuedAt || undefined,
          expiryAt: patientPrescriptionDraft.expiryAt || undefined,
          source: patientPrescriptionDraft.source,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create prescription');
      }
      const created = await res.json();
      setPrescriptions((current) => [created, ...current]);
      setPatientPrescriptionStatus('Prescription saved.');
      closePrescriptionModal();
    } catch (err: any) {
      setPatientPrescriptionStatus(err.message || 'Failed to create prescription');
    }
  };

  // ── Section renderer ────────────────────────────────────────────────────────

  const renderSection = () => {
    switch (activeSection) {
      case 'availability':
        return (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Availability</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Define date ranges, time ranges, and exception dates for bookings.
                </p>
              </div>
              <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 ring-1 ring-teal-200">
                {filteredAvailabilityWindows.length} window
                {filteredAvailabilityWindows.length === 1 ? '' : 's'}
              </span>
            </div>

            {canManageAnyDoctor && doctors.length > 0 && (
              <div className="mt-4 rounded-3xl border border-slate-100 bg-slate-50/80 p-4">
                <label className={labelCls}>Doctor</label>
                <select
                  value={selectedDoctorId}
                  onChange={(e) => selectDoctor(e.target.value)}
                  className={inputCls}
                >
                  {doctors.map((doctor) => (
                    <option key={doctor._id} value={doctor._id}>
                      {doctor.name} · {doctor.specialization}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-slate-500">
                  Update availability for the selected doctor profile.
                </p>
              </div>
            )}

            <div className="mt-4 rounded-3xl border border-slate-100 bg-slate-50/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Saved availability ranges
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Slot interval:{' '}
                <strong className="text-slate-700">{availabilitySlotMinutes} minutes</strong>
              </p>
              <div className="mt-3 space-y-2">
                {filteredAvailabilityWindows.length > 0 ? (
                  filteredAvailabilityWindows.map((window, index) => (
                    <div
                      key={`${window.title || 'window'}-${index}`}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-slate-900">
                          {window.title || `Window ${index + 1}`}
                        </p>
                        <span className="text-xs font-semibold text-teal-700">
                          {formatFriendlyDate(window.startDate)} -{' '}
                          {formatFriendlyDate(window.endDate || window.startDate)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Days:{' '}
                        {formatDayList(
                          window.daysOfWeek.length > 0
                            ? window.daysOfWeek
                            : getWeekdaysBetweenDates(window.startDate, window.endDate)
                        )}
                      </p>
                    </div>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">No availability windows saved yet.</span>
                )}
              </div>
            </div>

            <form
              onSubmit={handleAvailabilitySubmit}
              className="mt-5 space-y-4 rounded-3xl border border-slate-100 bg-slate-50/80 p-4"
            >
              <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Calendar editor
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Click a date range to build a window, or switch to exceptions and mark blocked days.
                    </p>
                  </div>
                  <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                    <button
                      type="button"
                      onClick={() => setCalendarMode('window')}
                      className={[
                        'rounded-xl px-3 py-1.5 text-xs font-semibold transition',
                        calendarMode === 'window'
                          ? 'bg-slate-950 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-900',
                      ].join(' ')}
                    >
                      Availability window
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalendarMode('exception')}
                      className={[
                        'rounded-xl px-3 py-1.5 text-xs font-semibold transition',
                        calendarMode === 'exception'
                          ? 'bg-slate-950 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-900',
                      ].join(' ')}
                    >
                      Exception dates
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => moveCalendarMonth(-1)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                      aria-label="Previous month"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {formatMonthLabel(calendarMonth)}
                      </p>
                      <p className="text-xs text-slate-500">Selected: {selectedCalendarRangeLabel}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => moveCalendarMonth(1)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                      aria-label="Next month"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-semibold">
                    {calendarMode === 'window' ? (
                      <span className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1.5 text-teal-700 ring-1 ring-teal-200">
                        <CalendarDays className="h-3.5 w-3.5" />
                        Pick a start and end date
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-amber-700 ring-1 ring-amber-200">
                        <Trash2 className="h-3.5 w-3.5" />
                        Tap dates to block them
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-7 gap-2 text-center text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div key={day}>{day}</div>
                  ))}
                </div>

                <div className="mt-2 grid grid-cols-7 gap-2">
                  {currentCalendarGrid.map((cell) => {
                    const isRangeStart = cell.key === calendarRangeStart;
                    const isRangeEnd = cell.key === calendarRangeEnd;
                    const isInRange = isWithinSelectedRange(cell.key, calendarRangeStart, calendarRangeEnd);
                    const isException = calendarExceptionDates.includes(cell.key);
                    return (
                      <button
                        key={cell.key}
                        type="button"
                        onClick={() => handleCalendarDayClick(cell.key)}
                        className={[
                          'relative flex h-12 items-center justify-center rounded-2xl border text-sm font-semibold transition',
                          cell.inMonth ? 'border-slate-200' : 'border-dashed border-slate-100 text-slate-300',
                          isException
                            ? 'bg-amber-100 text-amber-900 ring-2 ring-amber-300'
                            : isRangeStart || isRangeEnd
                            ? 'bg-slate-950 text-white ring-2 ring-slate-950/10'
                            : isInRange
                            ? 'bg-teal-50 text-teal-900 ring-1 ring-teal-200'
                            : 'bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
                          cell.isToday
                            ? 'after:absolute after:bottom-1 after:h-1.5 after:w-1.5 after:rounded-full after:bg-teal-500'
                            : '',
                        ].join(' ')}
                      >
                        {cell.day}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                  {calendarMode === 'window' ? (
                    <>
                      <div>
                        <label className={labelCls}>Window title</label>
                        <input
                          value={calendarWindowTitle}
                          onChange={(e) => setCalendarWindowTitle(e.target.value)}
                          className={inputCls}
                          placeholder="Example: June OPD block"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={addCalendarWindowToDraft}
                        disabled={!calendarRangeStart}
                        className="h-12 rounded-2xl bg-teal-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        Add range to windows
                      </button>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className={labelCls}>Selected exception dates</label>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                          {calendarExceptionDates.length > 0
                            ? calendarExceptionDates.join(', ')
                            : 'No dates selected yet'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={addCalendarExceptionsToDraft}
                        disabled={calendarExceptionDates.length === 0}
                        className="h-12 rounded-2xl bg-amber-500 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        Add exceptions
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Availability windows
                  </p>
                  <button
                    type="button"
                    onClick={addAvailabilityWindow}
                    className="rounded-full border border-teal-200 bg-white px-3 py-1.5 text-xs font-semibold text-teal-700 transition hover:bg-teal-50"
                  >
                    Add window
                  </button>
                </div>
                <div className="space-y-4">
                  {availabilityWindows.map((window, index) => (
                    <div key={index} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Window {index + 1}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Use a date span plus time range for a booking block.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAvailabilityWindow(index)}
                          className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-50"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div>
                          <label className={labelCls}>Title</label>
                          <input
                            value={window.title}
                            onChange={(e) => updateAvailabilityWindow(index, { title: e.target.value })}
                            className={inputCls}
                            placeholder="Example: OPD afternoons"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Note</label>
                          <input
                            value={window.note}
                            onChange={(e) => updateAvailabilityWindow(index, { note: e.target.value })}
                            className={inputCls}
                            placeholder="Example: By appointment only"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Start date</label>
                          <input
                            type="date"
                            value={window.startDate}
                            onChange={(e) => updateAvailabilityWindow(index, { startDate: e.target.value })}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>End date</label>
                          <input
                            type="date"
                            value={window.endDate}
                            onChange={(e) => updateAvailabilityWindow(index, { endDate: e.target.value })}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Start time</label>
                          <input
                            type="time"
                            value={window.startTime}
                            onChange={(e) => updateAvailabilityWindow(index, { startTime: e.target.value })}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>End time</label>
                          <input
                            type="time"
                            value={window.endTime}
                            onChange={(e) => updateAvailabilityWindow(index, { endTime: e.target.value })}
                            className={inputCls}
                          />
                        </div>
                      </div>
                      <div className="mt-4">
                        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                          Days of week
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {dayOptions.map((day) => (
                            <label
                              key={day}
                              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                            >
                              <input
                                type="checkbox"
                                checked={window.daysOfWeek.includes(day)}
                                onChange={() => toggleAvailabilityWindowDay(index, day)}
                                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                              />
                              <span className="capitalize">{day}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Notes for patients
                </label>
                <textarea
                  value={availabilityNotes}
                  onChange={(e) => setAvailabilityNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/10"
                  placeholder="Example: Morning slots only, call before 9 AM"
                />
              </div>

              <div className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_14rem] sm:items-end">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Time slot interval
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Patient booking slots are generated in this step size.
                  </p>
                </div>
                <div>
                  <label className={labelCls}>Interval</label>
                  <select
                    value={availabilitySlotMinutes}
                    onChange={(e) => setAvailabilitySlotMinutes(Number(e.target.value))}
                    className={inputCls}
                  >
                    {SLOT_INTERVAL_OPTIONS.map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes} minutes
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-3 rounded-3xl border border-amber-100 bg-amber-50/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                    Exceptions
                  </p>
                  <button
                    type="button"
                    onClick={addAvailabilityException}
                    className="rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                  >
                    Add exception
                  </button>
                </div>
                <div className="space-y-3">
                  {availabilityExceptions.map((exception, index) => (
                    <div
                      key={index}
                      className="grid gap-3 rounded-2xl border border-amber-100 bg-white p-3 md:grid-cols-[1fr_1fr_auto] md:items-end"
                    >
                      <div>
                        <label className={labelCls}>Date</label>
                        <input
                          type="date"
                          value={exception.date}
                          onChange={(e) => updateAvailabilityException(index, { date: e.target.value })}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Reason</label>
                        <input
                          value={exception.reason}
                          onChange={(e) => updateAvailabilityException(index, { reason: e.target.value })}
                          className={inputCls}
                          placeholder="Example: Holiday leave"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAvailabilityException(index)}
                        className="h-12 rounded-2xl border border-amber-200 px-4 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {availabilityStatus && (
                <p className="rounded-2xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm text-teal-800">
                  {availabilityStatus}
                </p>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="rounded-2xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-500"
                >
                  Save availability
                </button>
              </div>
            </form>
          </section>
        );

      case 'appointments':
        return (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Appointments</h2>
                <p className="mt-1 text-sm text-slate-500">Review what patients have already booked.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                {visibleAppointments.length} total
              </span>
            </div>
            <div className="mt-5 space-y-3">
              {visibleAppointments.length > 0 ? (
                visibleAppointments.map((appointment) => {
                  const patient =
                    typeof appointment.patientId === 'object' ? appointment.patientId : null;
                  return (
                    <div key={appointment._id} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">{patient?.name || 'Patient'}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatAppointmentDate(appointment.appointmentDate)} · {appointment.timeSlot}
                          </p>
                          {appointment.reason && (
                            <p className="mt-2 text-sm text-slate-700">{appointment.reason}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-start gap-2 sm:items-end">
                          <span className="inline-flex w-fit rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                            {appointment.status || 'booked'}
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {canCancelAppointment(appointment.status) && (
                              <button
                                type="button"
                                onClick={() => handleCancelAppointment(appointment._id)}
                                disabled={cancellingAppointmentId === appointment._id}
                                className="rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {cancellingAppointmentId === appointment._id
                                  ? 'Cancelling...'
                                  : 'Cancel booking'}
                              </button>
                            )}
                            {canCancelAppointment(appointment.status) && (
                              <button
                                type="button"
                                onClick={() => openRescheduleModal(appointment)}
                                className="rounded-full border border-teal-200 bg-white px-3 py-1.5 text-xs font-semibold text-teal-700 transition hover:bg-teal-50"
                              >
                                Reschedule
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-sm text-slate-500">
                  No appointments booked yet.
                </p>
              )}
            </div>
          </section>
        );

      // ─── IMPROVED PATIENTS SECTION ────────────────────────────────────────
      case 'patients':
        return (
          <section className="space-y-5">
            {/* Section header */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
                      <UserCheck className="h-5 w-5" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-950">My Patients</h2>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {myPatients.length > 0
                      ? `${myPatients.length} patient${myPatients.length !== 1 ? 's' : ''} assigned to your profile`
                      : 'No patients assigned yet'}
                  </p>
                </div>
                {/* Summary stats */}
                {myPatients.length > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-2.5 text-center">
                      <p className="text-xl font-bold text-blue-700">{myPatients.length}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500">Patients</p>
                    </div>
                    <div className="rounded-2xl border border-teal-100 bg-teal-50 px-4 py-2.5 text-center">
                      <p className="text-xl font-bold text-teal-700">{prescriptions.length}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-teal-500">Total Rx</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Search bar */}
              {myPatients.length > 0 && (
                <div className="relative mt-4">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    placeholder="Search by name, phone, or email…"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-400/10"
                  />
                  {patientSearch && (
                    <button
                      type="button"
                      onClick={() => setPatientSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-medium text-slate-400 hover:text-slate-600"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Patient grid */}
            {myPatients.length === 0 ? (
              <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-slate-200 bg-white py-20 text-center shadow-sm">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-300">
                  <User className="h-8 w-8" />
                </div>
                <div>
                  <p className="text-base font-semibold text-slate-500">No patients yet</p>
                  <p className="mt-1 text-sm text-slate-400">Patients assigned to you will appear here</p>
                </div>
              </div>
            ) : searchedPatients.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-slate-200 bg-white py-14 text-center shadow-sm">
                <Search className="h-8 w-8 text-slate-300" />
                <p className="text-sm font-semibold text-slate-500">No patients match your search</p>
                <button
                  type="button"
                  onClick={() => setPatientSearch('')}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Clear search
                </button>
              </div>
            ) : (
              <>
                {patientSearch && (
                  <p className="px-1 text-xs text-slate-400">
                    Showing {searchedPatients.length} of {myPatients.length} patients
                  </p>
                )}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {searchedPatients.map((p) => {
                    const patientRxCount = prescriptions.filter((rx) => {
                      const rxPatientId = typeof rx.patientId === 'string' ? rx.patientId : rx.patientId?._id;
                      return rxPatientId === p._id;
                    }).length;

                    return (
                      <PatientCard
                        key={p._id}
                        patient={p}
                        prescriptionCount={patientRxCount}
                        onWritePrescription={() => openPrescriptionModal(p)}
                        onViewPrescriptions={() => openPatientPrescriptionsModal(p)}
                      />
                    );
                  })}
                </div>
              </>
            )}
          </section>
        );

      case 'prescriptions':
        return (
          <section id="prescriptions" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Prescriptions</h2>
            <div className="mt-4 space-y-3">
              {prescriptions && prescriptions.length > 0 ? (
                prescriptions.map((item) => (
                  <div
                    key={item._id}
                    className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">
                          {(typeof item.patientId === 'object' && item.patientId?.name) || 'Patient'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {new Date(item.issuedAt).toLocaleString('en-IN')}
                        </p>
                        <p className="mt-2 line-clamp-2 text-slate-600">
                          {item.medicinesGiven || item.rawText || 'No details available.'}
                        </p>
                      </div>
                      <div className="ml-4 flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openSavedPrescription(item, 'view')}
                          className="rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => printSavedPrescription(item)}
                          className="rounded-2xl bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                        >
                          Print
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No prescriptions found yet.</p>
              )}
            </div>
          </section>
        );

      case 'reports':
        return (
          <ReportsSection
            reports={visibleReports}
            reportsLoading={reportsLoading}
            patients={patients}
            commentText={commentText}
            onView={(report) => setViewingReport(report)}
            onCommentChange={handleCommentChange}
            onCommentSubmit={handleCommentSubmit}
            onIssuePrescription={openReportPrescriptionModal}
            submittingCommentId={submittingCommentId}
            canComment={currentUserRole === 'doctor'}
            canIssuePrescription={currentUserRole === 'doctor'}
            viewingReport={viewingReport}
            onCloseViewingReport={() => setViewingReport(null)}
          />
        );

      case 'profile':
      default:
        return (
          <section id="profile" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Profile</h2>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <p>
                <span className="font-medium text-slate-900">Specialization:</span>{' '}
                {profile?.specialization || 'N/A'}
              </p>
              <p>
                <span className="font-medium text-slate-900">Degree:</span> {profile?.degree || 'N/A'}
              </p>
              <p>
                <span className="font-medium text-slate-900">Clinic:</span>{' '}
                {profile?.clinicName || 'N/A'}
              </p>
              <p>
                <span className="font-medium text-slate-900">Email:</span> {profile?.email || 'N/A'}
              </p>
              <p>
                <span className="font-medium text-slate-900">Phone:</span> {profile?.phone || 'N/A'}
              </p>
              <p>
                <span className="font-medium text-slate-900">Fees:</span> {profile?.consultationFee || 'N/A'}
              </p>
            </div>
          </section>
        );
    }
  };

  // ── Guard renders ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-[60vh] px-6 py-10 text-slate-600">Loading doctor dashboard...</div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-red-700">{error}</div>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Doctor Portal</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
          Welcome, {profile?.name || 'Doctor'}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {canManageAnyDoctor
            ? 'Manage doctor availability, appointments, and lab reports across the tenant.'
            : 'Your linked doctor account, availability, and patient appointments.'}
        </p>
        {canManageAnyDoctor && doctors.length > 0 && (
          <div className="mt-4 max-w-xl">
            <label className={labelCls}>Active doctor</label>
            <select
              value={selectedDoctorId}
              onChange={(e) => selectDoctor(e.target.value)}
              className={inputCls}
            >
              {doctors.map((doctor) => (
                <option key={doctor._id} value={doctor._id}>
                  {doctor.name} · {doctor.specialization}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          {[
            ['profile', 'Profile'],
            ['availability', 'Availability'],
            ['patients', 'Patients'],
            ['appointments', 'Appointments'],
            ['prescriptions', 'Prescriptions'],
            ['reports', 'Reports'],
          ].map(([section, label]) => (
            <Link
              key={section}
              href={`/doctor-dashboard?section=${section}`}
              className={[
                'rounded-full px-4 py-2 text-sm font-semibold transition',
                activeSection === section
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              ].join(' ')}
            >
              {label}
            </Link>
          ))}
        </div>
      </section>

      {renderSection()}

      {/* ── Appointment Reschedule Modal ── */}
      {isRescheduleModalOpen && activeRescheduleAppointment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm"
          onClick={closeRescheduleModal}
        >
          <div className="w-full max-w-4xl rounded-3xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
                  Reschedule Appointment
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">
                  {typeof activeRescheduleAppointment.patientId === 'object'
                    ? activeRescheduleAppointment.patientId?.name || 'Patient'
                    : 'Patient'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Update the booking date and time slot for this appointment.
                </p>
              </div>
              <button
                type="button"
                onClick={closeRescheduleModal}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleRescheduleSubmit} className="grid gap-6 px-6 py-6 lg:grid-cols-[1.4fr_0.9fr]">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Pick a date
                    </label>
                    <p className="mt-1 text-xs text-slate-500">
                      Only dates that match the doctor's availability are selectable.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => moveRescheduleMonth(-1)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                      aria-label="Previous month"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <p className="text-sm font-semibold text-slate-900">{formatMonthLabel(rescheduleMonth)}</p>
                    <button
                      type="button"
                      onClick={() => moveRescheduleMonth(1)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                      aria-label="Next month"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div key={day}>{day}</div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {rescheduleCalendarGrid.map((cell) => {
                    const isSelected = cell.key === rescheduleForm.appointmentDate;
                    const isAvailable = currentRescheduleDoctor ? isDoctorAvailableOnDate(currentRescheduleDoctor, cell.key) : false;

                    return (
                      <button
                        key={cell.key}
                        type="button"
                        onClick={() => handleRescheduleDateClick(cell.key)}
                        disabled={!currentRescheduleDoctor || !isAvailable}
                        aria-pressed={isSelected}
                        className={[
                          'relative flex h-12 items-center justify-center rounded-2xl border text-sm font-semibold transition',
                          cell.inMonth ? 'border-slate-200' : 'border-dashed border-slate-100 text-slate-300',
                          isSelected
                            ? 'bg-teal-600 text-white ring-2 ring-teal-200'
                            : isAvailable && currentRescheduleDoctor
                              ? 'bg-white text-slate-700 hover:border-teal-300 hover:bg-teal-50'
                              : 'cursor-not-allowed border-slate-100 bg-slate-100 text-slate-300',
                          cell.isToday && !isSelected
                            ? 'after:absolute after:bottom-1 after:h-1.5 after:w-1.5 after:rounded-full after:bg-teal-500'
                            : '',
                        ].join(' ')}
                      >
                        {cell.day}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 text-xs text-slate-500 shadow-sm">
                  <span>
                    Selected date: <strong className="text-slate-700">{rescheduleSelectedDateLabel}</strong>
                  </span>
                  <span>
                    {currentRescheduleDoctor ? (
                      <>
                        {rescheduleSelectedTimeAvailable ? 'Time is available' : 'Time is outside the doctor availability'}
                        {currentRescheduleDoctor.availabilityNotes ? (
                          <span className="text-slate-400"> · {currentRescheduleDoctor.availabilityNotes}</span>
                        ) : null}
                      </>
                    ) : (
                      'Select doctor first'
                    )}
                  </span>
                </div>
              </div>

              <div className="space-y-4 rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Time slot
                  </label>
                  <select
                    value={rescheduleForm.timeSlot}
                    onChange={(e) =>
                      setRescheduleForm((current) => ({
                        ...current,
                        timeSlot: e.target.value,
                      }))
                    }
                    disabled={!currentRescheduleDoctor || !rescheduleForm.appointmentDate || rescheduleAvailableTimeSlots.length === 0}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/10 disabled:cursor-not-allowed disabled:bg-slate-50"
                  >
                    <option value="">
                      {!currentRescheduleDoctor
                        ? 'Select a doctor first'
                        : !rescheduleForm.appointmentDate
                          ? 'Select a date first'
                          : rescheduleAvailableTimeSlots.length > 0
                            ? 'Select a time slot'
                            : 'No slots available for this date'}
                    </option>
                    {rescheduleAvailableTimeSlots.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">
                    {currentRescheduleDoctor
                      ? `Generated in ${getDoctorSlotIntervalMinutes(currentRescheduleDoctor)}-minute intervals from the doctor's availability.`
                      : 'Select doctor and date to generate slots.'}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm text-slate-600">
                  Current booking: {formatAppointmentDate(activeRescheduleAppointment.appointmentDate)} ·{' '}
                  {activeRescheduleAppointment.timeSlot}
                </div>

                {rescheduleStatus && <p className="text-sm font-medium text-rose-600">{rescheduleStatus}</p>}

                <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={closeRescheduleModal}
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-2xl bg-teal-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-teal-700"
                  >
                    Save changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Prescription Write Modal ── */}
      {isPrescriptionModalOpen && activePrescriptionPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
                  Prescription Writer
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">
                  {activePrescriptionPatient.name}
                </h2>
                <p className="text-sm text-slate-500">
                  Create a structured prescription using the existing format.
                </p>
              </div>
              <button
                onClick={closePrescriptionModal}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <form onSubmit={handlePrescriptionSubmit} className="space-y-6 px-6 py-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className={labelCls}>Previous History</label>
                  <textarea
                    value={patientPrescriptionDraft.previousHistory}
                    onChange={(e) =>
                      setPatientPrescriptionDraft((current) => ({
                        ...current,
                        previousHistory: e.target.value,
                      }))
                    }
                    className={inputCls}
                    rows={3}
                    placeholder="Relevant history, allergies, or prior treatment"
                  />
                </div>
                <div>
                  <label className={labelCls}>Investigations Given</label>
                  <textarea
                    value={patientPrescriptionDraft.investigationsGiven}
                    onChange={(e) =>
                      setPatientPrescriptionDraft((current) => ({
                        ...current,
                        investigationsGiven: e.target.value,
                      }))
                    }
                    className={inputCls}
                    rows={3}
                    placeholder="Tests, labs, or investigations"
                  />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                  <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                    <div>
                      <label className={labelCls}>Medicine Name</label>
                      <input
                        value={newMedicineEntry.name}
                        onChange={(e) => handleMedicineNameChange(e.target.value)}
                        onFocus={() => {
                          setMedicineSuggestions(
                            buildMedicineSuggestions(medicines, newMedicineEntry.name)
                          );
                          setShowMedicineSuggestions(true);
                        }}
                        className={inputCls}
                        placeholder="Search medicine name or brand"
                      />
                      {showMedicineSuggestions && (
                        <div className="mt-2 max-h-56 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-lg">
                          {medicineSuggestions.length > 0 ? (
                            medicineSuggestions.map((medicine) => (
                              <button
                                key={medicine._id}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => selectMedicineSuggestion(medicine)}
                                className="flex w-full flex-col items-start gap-0.5 border-b border-slate-100 px-4 py-3 text-left text-sm last:border-b-0 hover:bg-slate-50"
                              >
                                <span className="font-medium text-slate-900">{medicine.name}</span>
                                {medicine.brand && (
                                  <span className="text-xs text-slate-500">{medicine.brand}</span>
                                )}
                              </button>
                            ))
                          ) : (
                            <p className="px-4 py-3 text-sm text-slate-500">
                              No medicine matches found.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={addMedicineEntry}
                      className="h-11 rounded-2xl bg-teal-600 px-4 text-sm font-bold text-white hover:bg-teal-700"
                    >
                      Add Medicine
                    </button>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <label className={labelCls}>Quantity</label>
                      <input
                        value={newMedicineEntry.quantity}
                        onChange={(e) =>
                          setNewMedicineEntry((current) => ({ ...current, quantity: e.target.value }))
                        }
                        className={inputCls}
                        placeholder="500mg, 1 tablet, etc."
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Time</label>
                      <input
                        value={newMedicineEntry.time}
                        onChange={(e) =>
                          setNewMedicineEntry((current) => ({ ...current, time: e.target.value }))
                        }
                        className={inputCls}
                        placeholder="Morning / Twice daily / After food"
                      />
                    </div>
                  </div>

                  {medicineEntries.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {medicineEntries.map((entry, index) => (
                        <div
                          key={`${entry.name}-${index}`}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                        >
                          <div>
                            <p className="font-medium text-slate-900">{entry.name}</p>
                            <p className="text-xs text-slate-500">
                              {entry.quantity || 'No quantity'} · {entry.time || 'No time'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeMedicineEntry(index)}
                            className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className={labelCls}>Raw Text</label>
                  <textarea
                    value={patientPrescriptionDraft.rawText}
                    onChange={(e) =>
                      setPatientPrescriptionDraft((current) => ({
                        ...current,
                        rawText: e.target.value,
                      }))
                    }
                    className={inputCls}
                    rows={4}
                    placeholder="Additional prescription context or transcription"
                  />
                </div>

                <div>
                  <label className={labelCls}>Issue Date</label>
                  <input
                    type="date"
                    value={patientPrescriptionDraft.issuedAt}
                    onChange={(e) =>
                      setPatientPrescriptionDraft((current) => ({
                        ...current,
                        issuedAt: e.target.value,
                      }))
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Next Visit Date</label>
                  <input
                    type="date"
                    value={patientPrescriptionDraft.expiryAt}
                    onChange={(e) =>
                      setPatientPrescriptionDraft((current) => ({
                        ...current,
                        expiryAt: e.target.value,
                      }))
                    }
                    className={inputCls}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className={labelCls}>Clinical Notes</label>
                  <textarea
                    value={patientPrescriptionDraft.notes}
                    onChange={(e) =>
                      setPatientPrescriptionDraft((current) => ({
                        ...current,
                        notes: e.target.value,
                      }))
                    }
                    className={inputCls}
                    rows={3}
                    placeholder="Optional notes"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <p className="text-sm text-slate-500">
                  {patientPrescriptionStatus || `Writing for ${activePrescriptionPatient.name}`}
                </p>
                <button
                  type="submit"
                  className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
                >
                  Save Prescription
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Patient Saved Prescriptions Modal ── */}
      {isPatientPrescriptionsModalOpen && activePatientPrescriptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
                  Saved Prescriptions
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">
                  {activePatientPrescriptions.name}
                </h2>
                <p className="text-sm text-slate-500">
                  View, edit, or print prescriptions already saved for this patient.
                </p>
              </div>
              <button
                onClick={closePatientPrescriptionsModal}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <div className="grid gap-6 px-6 py-6 lg:grid-cols-[320px_1fr]">
              <aside className="space-y-3">
                {patientSavedPrescriptions.length > 0 ? (
                  patientSavedPrescriptions.map((prescription) => (
                    <div
                      key={prescription._id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm"
                    >
                      <p className="font-semibold text-slate-950">
                        {formatIssuedDate(prescription.issuedAt)}
                      </p>
                      <p className="mt-1 line-clamp-2 text-slate-600">
                        {prescription.medicinesGiven ||
                          prescription.rawText ||
                          'No details available.'}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openSavedPrescription(prescription, 'view')}
                          className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-white"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => openSavedPrescription(prescription, 'edit')}
                          className="rounded-lg border border-teal-300 bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700 hover:bg-teal-100"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => printSavedPrescription(prescription)}
                          className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                        >
                          Print
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                    No saved prescriptions for this patient.
                  </p>
                )}
              </aside>

              <main className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                  Select a saved prescription to view, edit, or print it.
                </div>
              </main>
            </div>
          </div>
        </div>
      )}

      {/* ── Saved Prescription View Modal ── */}
      {isSavedPrescriptionViewOpen && selectedSavedPrescription && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
                  Prescription View
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">
                  {formatIssuedDate(selectedSavedPrescription.issuedAt)}
                </h2>
                <p className="text-sm text-slate-500">
                  Existing prescription format, ready to review or print.
                </p>
              </div>
              <button
                onClick={closeSavedPrescription}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <div className="space-y-5 px-6 py-6">
              <PrescriptionPrintView prescription={selectedSavedPrescription} />

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <p className="text-sm text-slate-500">{savedPrescriptionStatus}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSavedPrescriptionViewOpen(false);
                      setIsSavedPrescriptionEditing(true);
                    }}
                    className="rounded-xl border border-teal-300 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-700 hover:bg-teal-100"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => printSavedPrescription(selectedSavedPrescription)}
                    className="rounded-xl border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                  >
                    Print
                  </button>
                  <button
                    type="button"
                    onClick={closeSavedPrescription}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Back
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}