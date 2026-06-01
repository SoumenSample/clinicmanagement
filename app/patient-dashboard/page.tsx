'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAuthHeaders } from '@/lib/utils/tenant-client';
import { getReportUploadResourceType, isPdfReportFile, normalizeReportFileUrl } from '@/lib/utils/report-file';
import {
  Mail,
  Phone,
  Pill,
  Stethoscope,
  Trash2,
  Loader2,
  FileText,
  FileImage,
  CloudUpload,
  Eye,
  CalendarDays,
  UserRound,
  ChevronDown,
  MessageSquare,
  MoreHorizontal,
  FileCheck2,
  Paperclip,
  BadgeCheck,
  Clock3,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type PatientProfile = {
  _id: string;
  name: string;
  age?: number;
  gender?: string;
  phone?: string;
  email?: string;
  address?: string;
  allergies?: string[];
  historySummary?: string;
};

type DoctorSummary = {
  _id: string;
  name: string;
  specialization: string;
  clinicName?: string;
  clinicAddress?: string;
  phone?: string;
  email?: string;
  availableDays?: string[];
  availabilityNotes?: string;
  availabilitySlotMinutes?: number;
  availabilityWindows?: Array<{
    title?: string;
    daysOfWeek?: string[];
    startDate?: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
    note?: string;
  }>;
  availabilityExceptions?: Array<{
    date?: string;
    reason?: string;
  }>;
};

type AppointmentRecord = {
  _id: string;
  appointmentDate: string;
  timeSlot: string;
  reason?: string;
  notes?: string;
  status?: 'booked' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  source?: string;
  doctorId?: DoctorSummary | string;
  patientId?: { _id: string; name?: string; phone?: string } | string;
};

type Prescription = {
  _id: string;
  issuedAt: string;
  patientId?: { _id: string; name?: string; phone?: string } | string;
  status?: string;
  doctorId?: { _id: string; name?: string; specialization?: string } | string;
  previousHistory?: string;
  investigationsGiven?: string;
  medicinesGiven?: string;
  rawText?: string;
  notes?: string;
  expiryAt?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseMedicineEntries(value?: string) {
  if (!value) return [] as Array<{ name: string; quantity: string; time: string }>;
  return value
    .split(/\r?\n/)
    .map((line) => {
      const parts = line.split('|').map((p) => p.trim());
      if (parts.length >= 3) return { name: parts[0], quantity: parts[1], time: parts[2] };
      if (parts.length === 2) return { name: parts[0], quantity: parts[1], time: '' };
      if (parts[0]) return { name: parts[0], quantity: '', time: '' };
      return null;
    })
    .filter((e): e is { name: string; quantity: string; time: string } => e !== null);
}

function formatIssuedDate(value?: string) {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN');
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

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

function appointmentDayName(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
}

function normalizeAvailabilityDay(value: string) {
  return value.toLowerCase();
}

function toMinutes(value?: string) {
  if (!value) return null;
  const raw = value.trim().toLowerCase();
  if (!raw) return null;

  const twelveHour = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (twelveHour) {
    let hours = Number(twelveHour[1]);
    const minutes = Number(twelveHour[2] || '0');
    const meridiem = twelveHour[3].toLowerCase();
    if (meridiem === 'pm' && hours !== 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }

  const twentyFourHour = raw.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (twentyFourHour) {
    const hours = Number(twentyFourHour[1]);
    const minutes = Number(twentyFourHour[2] || '0');
    return hours * 60 + minutes;
  }

  return null;
}

function normalizeAvailabilitySlotInterval(value?: number) {
  return value === 5 || value === 10 || value === 15 || value === 30 ? value : 15;
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

function getDoctorSlotIntervalMinutes(doctor: DoctorSummary | null) {
  return normalizeAvailabilitySlotInterval(doctor?.availabilitySlotMinutes);
}

function getAvailableTimeSlotsForDoctor(doctor: DoctorSummary | null, dateKey: string) {
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

function isWithinRange(dateKey: string, startDate?: string, endDate?: string) {
  if (startDate && dateKey < startDate) return false;
  if (endDate && dateKey > endDate) return false;
  return true;
}

function isDoctorAvailableOnDate(doctor: DoctorSummary | null, dateKey: string) {
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

function isDoctorAvailableAtTime(doctor: DoctorSummary | null, dateKey: string, timeSlot: string) {
  if (!doctor) return false;

  const availableSlots = getAvailableTimeSlotsForDoctor(doctor, dateKey);
  if (availableSlots.length === 0) {
    return isDoctorAvailableOnDate(doctor, dateKey);
  }

  return availableSlots.includes(timeSlot.trim());
}

function formatRelativeDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getDoctorInitials(name?: string) {
  if (!name) return 'Dr';
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

const AVATAR_PALETTES = [
  { bg: 'bg-violet-100', text: 'text-violet-700', ring: 'ring-violet-200' },
  { bg: 'bg-teal-100',   text: 'text-teal-700',   ring: 'ring-teal-200'   },
  { bg: 'bg-sky-100',    text: 'text-sky-700',    ring: 'ring-sky-200'    },
  { bg: 'bg-amber-100',  text: 'text-amber-700',  ring: 'ring-amber-200'  },
  { bg: 'bg-rose-100',   text: 'text-rose-700',   ring: 'ring-rose-200'   },
  { bg: 'bg-emerald-100',text: 'text-emerald-700',ring: 'ring-emerald-200'},
];

function getDoctorPalette(name?: string) {
  if (!name) return AVATAR_PALETTES[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length];
}

function getFileExtension(filename?: string) {
  return (filename ?? '').split('.').pop()?.toLowerCase() ?? '';
}
function isPdfFile(filename?: string) { return getFileExtension(filename) === 'pdf'; }
function isImageFile(filename?: string) {
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(getFileExtension(filename));
}

// ─── Prescription sub-components (unchanged) ─────────────────────────────────

function PrescriptionInfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-1 font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function PrescriptionSection({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
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
                {[doctor?.specialization].filter(Boolean).join(' · ') || 'Medical Practitioner'}
              </p>
            </div>
          </div>
          <div className="text-sm text-slate-300 md:text-right">
            <div className="mt-2 space-y-1">
              {doctor?.phone && <p className="inline-flex items-center gap-2 md:justify-end"><Phone className="h-3.5 w-3.5" />{doctor.phone}</p>}
              {doctor?.email && <p className="inline-flex items-center gap-2 md:justify-end"><Mail className="h-3.5 w-3.5" />{doctor.email}</p>}
            </div>
          </div>
        </div>
      </div>
      <div className="border-b border-slate-200 bg-slate-50 px-7 py-5">
        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <div className="grid gap-3 sm:grid-cols-4">
            <PrescriptionInfoItem label="Patient" value={patient?.name || 'N/A'} />
            <PrescriptionInfoItem label="Age" value={patient?.age !== undefined ? `${patient.age} yrs` : 'N/A'} />
            <PrescriptionInfoItem label="Gender" value={patient?.gender || 'N/A'} />
            <PrescriptionInfoItem label="Phone" value={patient?.phone || 'N/A'} />
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
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-xs font-bold text-white">{idx + 1}</div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-950">{entry.name}</p>
                    <div className="mt-1.5 flex flex-wrap gap-2 text-xs">
                      {entry.quantity && <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">Qty: {entry.quantity}</span>}
                      {entry.time && <span className="rounded-full bg-teal-50 px-2.5 py-1 font-medium text-teal-700">{entry.time}</span>}
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

// ─── Report Viewer Modal ──────────────────────────────────────────────────────

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
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Close</button>
        </div>
        <div className="min-h-0 flex-1 bg-slate-100">
          {reportUrl ? (
            <iframe title={report?.filename || 'Report preview'} src={reportUrl} className="h-full min-h-[70vh] w-full bg-white" />
          ) : (
            <div className="flex h-[70vh] items-center justify-center text-sm text-slate-500">No report URL available.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Upload Drop Zone ─────────────────────────────────────────────────────────

function UploadDropZone({ onFile, uploading }: { onFile: (file: File) => void; uploading: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !uploading && inputRef.current?.click()}
      className={[
        'group relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-all duration-200',
        dragging ? 'border-teal-400 bg-teal-50/60' : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/20',
        uploading ? 'pointer-events-none opacity-60' : '',
      ].join(' ')}
    >
      <input ref={inputRef} type="file" className="hidden"
        onChange={(e) => { const file = e.target.files?.[0]; if (file) onFile(file); e.currentTarget.value = ''; }} />
      <div className={['flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-200',
        dragging ? 'bg-teal-100 text-teal-600' : 'bg-slate-100 text-slate-400 group-hover:bg-teal-50 group-hover:text-teal-500'].join(' ')}>
        {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CloudUpload className="h-5 w-5" />}
      </div>
      {uploading ? (
        <p className="text-sm font-medium text-slate-600">Uploading…</p>
      ) : (
        <div>
          <p className="text-sm font-semibold text-slate-700">Drop file or <span className="text-teal-600 underline underline-offset-2">browse</span></p>
          <p className="mt-0.5 text-xs text-slate-400">PDF, JPG, PNG — up to 20 MB</p>
        </div>
      )}
    </div>
  );
}

// ─── Document Attachment Chip ─────────────────────────────────────────────────

function DocumentChip({ report, onView }: { report: any; onView: () => void }) {
  const ext = getFileExtension(report.filename).toUpperCase() || 'FILE';
  const pdf = isPdfFile(report.filename);
  const img = isImageFile(report.filename);

  return (
    <button type="button" onClick={onView}
      className={['group flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all duration-150 hover:shadow-sm',
        pdf ? 'border-red-100 bg-red-50/60 hover:border-red-200 hover:bg-red-50' :
        img  ? 'border-sky-100 bg-sky-50/60 hover:border-sky-200 hover:bg-sky-50' :
               'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100'].join(' ')}>
      <div className={['flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
        pdf ? 'bg-red-100 text-red-500' : img ? 'bg-sky-100 text-sky-500' : 'bg-slate-200 text-slate-500'].join(' ')}>
        {img ? <FileImage className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-800 group-hover:text-slate-950">{report.filename || 'Document'}</p>
        <p className="text-xs text-slate-400">{ext} · tap to preview</p>
      </div>
      <div className={['flex h-7 w-7 shrink-0 items-center justify-center rounded-xl transition-colors',
        pdf ? 'bg-red-100 text-red-500 group-hover:bg-red-200' :
        img  ? 'bg-sky-100 text-sky-500 group-hover:bg-sky-200' :
               'bg-slate-200 text-slate-500 group-hover:bg-slate-300'].join(' ')}>
        <Eye className="h-3.5 w-3.5" />
      </div>
    </button>
  );
}

// ─── Comment Bubble ───────────────────────────────────────────────────────────

function CommentBubble({ comment }: { comment: any }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-100 ring-2 ring-white">
        <MessageSquare className="h-3.5 w-3.5 text-teal-600" />
      </div>
      <div className="flex-1">
        <div className="rounded-2xl rounded-tl-sm bg-teal-50 px-4 py-3 ring-1 ring-teal-100">
          <p className="text-sm leading-relaxed text-slate-800">{comment.comment}</p>
        </div>
        <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
          <Clock3 className="h-3 w-3" />
          {new Date(comment.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          {' · '}
          {new Date(comment.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

// ─── Report Feed Post ─────────────────────────────────────────────────────────

function ReportPost({
  report,
  onView,
  onDelete,
  deleting,
}: {
  report: any;
  onView: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const hasComments = report.comments && report.comments.length > 0;
  const doctorName = report.doctorId?.name as string | undefined;
  const doctorSpec = report.doctorId?.specialization as string | undefined;
  const palette = getDoctorPalette(doctorName);
  const initials = getDoctorInitials(doctorName);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md">

      {/* ── Header: Doctor ── */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-4">
        <div className={['flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-bold ring-2', palette.bg, palette.text, palette.ring].join(' ')}>
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-bold text-slate-900">{doctorName ? `Dr. ${doctorName}` : 'Your Doctor'}</p>
            <BadgeCheck className="h-4 w-4 shrink-0 text-teal-500" />
          </div>
          <p className="truncate text-xs text-slate-400">
            {doctorSpec || 'Medical Practitioner'} · {formatRelativeDate(report.createdAt)}
          </p>
        </div>
        {/* ⋯ Menu */}
        <div className="relative shrink-0" ref={menuRef}>
          <button type="button" onClick={() => setShowMenu((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-10 z-20 min-w-35 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
              <button type="button" onClick={() => { setShowMenu(false); onView(); }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                <Eye className="h-4 w-4 text-slate-400" /> Preview
              </button>
              <button type="button" onClick={() => { setShowMenu(false); onDelete(); }} disabled={deleting}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50">
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mx-5 h-px bg-slate-100" />

      {/* ── Body: Document ── */}
      <div className="space-y-3 px-5 py-4">
        <div className="flex items-center gap-2">
          <FileCheck2 className="h-4 w-4 text-slate-400" />
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Attached Report</p>
        </div>
        <DocumentChip report={report} onView={onView} />
        <p className="flex items-center gap-1.5 text-xs text-slate-400">
          <CalendarDays className="h-3.5 w-3.5" />
          Uploaded {new Date(report.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* ── Doctor Comments ── */}
      {hasComments && (
        <>
          <div className="mx-5 h-px bg-slate-100" />
          <div className="px-5 py-3">
            <button type="button" onClick={() => setCommentsOpen((v) => !v)} className="flex w-full items-center gap-2 text-left">
              <div className="flex flex-1 min-w-0 items-center gap-2">
                <MessageSquare className="h-4 w-4 shrink-0 text-teal-500" />
                <p className="text-xs font-semibold text-teal-700 truncate">
                  {report.comments.length} doctor comment{report.comments.length !== 1 ? 's' : ''}
                </p>
              </div>
              <ChevronDown className={['h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200', commentsOpen ? 'rotate-180' : ''].join(' ')} />
            </button>
            {commentsOpen && (
              <div className="mt-4 space-y-3">
                {report.comments.map((c: any, idx: number) => <CommentBubble key={idx} comment={c} />)}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Footer ── */}
      <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
        <button type="button" onClick={onView}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700">
          <Eye className="h-3.5 w-3.5" /> Preview file
        </button>
        {hasComments && (
          <button type="button" onClick={() => setCommentsOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-teal-100 bg-teal-50 px-3.5 py-2 text-xs font-semibold text-teal-700 shadow-sm transition hover:bg-teal-100">
            <MessageSquare className="h-3.5 w-3.5" /> {commentsOpen ? 'Hide' : 'View'} comments
          </button>
        )}
        <button type="button" onClick={onDelete} disabled={deleting}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-red-100 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-600 shadow-sm transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50">
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Remove
        </button>
      </div>
    </article>
  );
}

// ─── Doctor Assign Select ─────────────────────────────────────────────────────

function DoctorAssignSelect({
  prescriptions,
  selectedDoctor,
  onChange,
}: {
  prescriptions: Prescription[];
  selectedDoctor: string | undefined;
  onChange: (id: string | undefined) => void;
}) {
  const doctors = Array.from(
    new Map(prescriptions.map((p) => {
      const d = typeof p.doctorId === 'object' ? p.doctorId : null;
      return [d?._id || '', d];
    }))
  ).filter(([, d]) => !!d) as [string, any][];

  if (doctors.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
        <UserRound className="h-3.5 w-3.5" />
        Assign to doctor
        <span className="font-normal normal-case tracking-normal text-slate-400">(optional)</span>
      </label>
      <div className="relative">
        <select value={selectedDoctor || ''} onChange={(e) => onChange(e.target.value || undefined)}
          className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-4 pr-10 text-sm text-slate-700 shadow-sm transition focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100">
          <option value="">— No specific doctor —</option>
          {doctors.map(([, d]: any) => (
            <option key={d._id} value={d._id}>Dr. {d.name}{d.specialization ? ` — ${d.specialization}` : ''}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
    </div>
  );
}

// ─── Reports Section ──────────────────────────────────────────────────────────

function ReportsSection({
  reports, prescriptions, selectedDoctor, setSelectedDoctor,
  uploadingReport, deletingReportId, onUpload, onView, onDelete,
}: {
  reports: any[];
  prescriptions: Prescription[];
  selectedDoctor: string | undefined;
  setSelectedDoctor: (id: string | undefined) => void;
  uploadingReport: boolean;
  deletingReportId: string;
  onUpload: (file: File) => void;
  onView: (report: any) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Upload card */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-950">Upload a Report</h2>
            <p className="mt-0.5 text-sm text-slate-500">Share a lab test, scan, or any medical document.</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
            <Paperclip className="h-5 w-5" />
          </div>
        </div>
        <div className="space-y-3">
          <DoctorAssignSelect prescriptions={prescriptions} selectedDoctor={selectedDoctor} onChange={setSelectedDoctor} />
          <UploadDropZone onFile={onUpload} uploading={uploadingReport} />
        </div>
      </section>

      {/* Feed header */}
      {reports.length > 0 && (
        <div className="flex items-center gap-3">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Your reports</p>
          <div className="h-px flex-1 bg-slate-200" />
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">{reports.length}</span>
        </div>
      )}

      {/* Feed */}
      {reports.length > 0 ? (
        <div className="space-y-4">
          {reports.map((r) => (
            <ReportPost key={r._id} report={r}
              onView={() => onView(r)} onDelete={() => onDelete(r._id)} deleting={deletingReportId === r._id} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-slate-200 bg-slate-50 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-300 shadow-sm ring-1 ring-slate-200">
            <FileCheck2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500">No reports yet</p>
            <p className="mt-1 text-xs text-slate-400">Upload your first report above</p>
          </div>
        </div>
      )}
    </div>
  );
}

function AppointmentsSection({
  doctors,
  appointments,
  selectedDoctorId,
  appointmentDate,
  appointmentTimeSlot,
  reason,
  notes,
  bookingStatus,
  cancellingAppointmentId,
  onChangeDoctor,
  onChangeDate,
  onChangeTimeSlot,
  onChangeReason,
  onChangeNotes,
  onCancelAppointment,
  onSubmit,
}: {
  doctors: DoctorSummary[];
  appointments: AppointmentRecord[];
  selectedDoctorId: string;
  appointmentDate: string;
  appointmentTimeSlot: string;
  reason: string;
  notes: string;
  bookingStatus: string;
  cancellingAppointmentId: string;
  onChangeDoctor: (value: string) => void;
  onChangeDate: (value: string) => void;
  onChangeTimeSlot: (value: string) => void;
  onChangeReason: (value: string) => void;
  onChangeNotes: (value: string) => void;
  onCancelAppointment: (appointmentId: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const selectedDoctor = doctors.find((doctor) => doctor._id === selectedDoctorId) || null;
  const [bookingMonth, setBookingMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const availableTimeSlots = selectedDoctor && appointmentDate ? getAvailableTimeSlotsForDoctor(selectedDoctor, appointmentDate) : [];

  useEffect(() => {
    if (!appointmentDate || !selectedDoctor) return;
    if (!isDoctorAvailableOnDate(selectedDoctor, appointmentDate)) {
      onChangeDate('');
    }
  }, [appointmentDate, selectedDoctor, onChangeDate]);

  useEffect(() => {
    if (!selectedDoctor || !appointmentDate) return;

    if (availableTimeSlots.length === 0) {
      if (appointmentTimeSlot) onChangeTimeSlot('');
      return;
    }

    if (!availableTimeSlots.includes(appointmentTimeSlot)) {
      onChangeTimeSlot(availableTimeSlots[0]);
    }
  }, [appointmentDate, appointmentTimeSlot, availableTimeSlots, onChangeTimeSlot, selectedDoctor]);

  const bookingCalendarGrid = buildCalendarGrid(bookingMonth);

  const moveBookingMonth = (offset: number) => {
    setBookingMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  const handleBookingDateClick = (dateKey: string) => {
    if (!selectedDoctor) return;
    if (!isDoctorAvailableOnDate(selectedDoctor, dateKey)) return;
    onChangeDate(dateKey);
  };

  const selectedDateLabel = appointmentDate ? formatAppointmentDate(appointmentDate) : 'No date selected';
  const selectedTimeAvailable = !appointmentDate || !appointmentTimeSlot ? true : availableTimeSlots.includes(appointmentTimeSlot);

  return (
    <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Appointments</h2>
          <p className="mt-1 text-sm text-slate-500">Book a visit and review your upcoming appointments.</p>
        </div>
        <span className="inline-flex w-fit items-center rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 ring-1 ring-teal-200">
          {appointments.length} appointment{appointments.length === 1 ? '' : 's'}
        </span>
      </div>

      <form onSubmit={onSubmit} className="grid gap-4 rounded-3xl border border-slate-100 bg-slate-50/80 p-4 md:grid-cols-2">
        <div className="space-y-1.5 md:col-span-2">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Doctor</label>
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

        <div className="space-y-3 md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Pick a date</label>
              <p className="mt-1 text-xs text-slate-500">Only dates that match the doctor's availability are selectable.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => moveBookingMonth(-1)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <p className="text-sm font-semibold text-slate-900">{formatMonthLabel(bookingMonth)}</p>
              <button
                type="button"
                onClick={() => moveBookingMonth(1)}
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
            {bookingCalendarGrid.map((cell) => {
              const isSelected = cell.key === appointmentDate;
              const isAvailable = selectedDoctor ? isDoctorAvailableOnDate(selectedDoctor, cell.key) : false;

              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => handleBookingDateClick(cell.key)}
                  disabled={!selectedDoctor || !isAvailable}
                  aria-pressed={isSelected}
                  className={[
                    'relative flex h-12 items-center justify-center rounded-2xl border text-sm font-semibold transition',
                    cell.inMonth ? 'border-slate-200' : 'border-dashed border-slate-100 text-slate-300',
                    isSelected
                      ? 'bg-teal-600 text-white ring-2 ring-teal-200'
                      : isAvailable && selectedDoctor
                        ? 'bg-white text-slate-700 hover:border-teal-300 hover:bg-teal-50'
                        : 'cursor-not-allowed border-slate-100 bg-slate-100 text-slate-300',
                    cell.isToday && !isSelected ? 'after:absolute after:bottom-1 after:h-1.5 after:w-1.5 after:rounded-full after:bg-teal-500' : '',
                  ].join(' ')}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 text-xs text-slate-500 shadow-sm">
            <span>
              Selected date: <strong className="text-slate-700">{selectedDateLabel}</strong>
            </span>
            <span>
              {selectedDoctor ? (
                <>
                  {selectedTimeAvailable ? 'Time is available' : 'Time is outside the doctor availability'}
                  {selectedDoctor.availabilityNotes ? <span className="text-slate-400"> · {selectedDoctor.availabilityNotes}</span> : null}
                </>
              ) : (
                'Select doctor first'
              )}
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Time slot</label>
          <select
            value={appointmentTimeSlot}
            onChange={(e) => onChangeTimeSlot(e.target.value)}
            disabled={!selectedDoctor || !appointmentDate || availableTimeSlots.length === 0}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/10 disabled:cursor-not-allowed disabled:bg-slate-50"
          >
            <option value="">
              {!selectedDoctor
                ? 'Select a doctor first'
                : !appointmentDate
                  ? 'Select a date first'
                  : availableTimeSlots.length > 0
                    ? 'Select a time slot'
                    : 'No slots available for this date'}
            </option>
            {availableTimeSlots.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            {selectedDoctor ? `Generated in ${getDoctorSlotIntervalMinutes(selectedDoctor)}-minute intervals from the doctor's availability.` : 'Select doctor and date to generate slots.'}
          </p>
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Reason</label>
          <textarea
            value={reason}
            onChange={(e) => onChangeReason(e.target.value)}
            rows={3}
            placeholder="Brief reason for the visit"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/10"
          />
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => onChangeNotes(e.target.value)}
            rows={2}
            placeholder="Optional notes for the clinic"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/10"
          />
        </div>

        <div className="md:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-500">
            {selectedDoctor ? (
              <span>
                {selectedDoctor.availabilityWindows && selectedDoctor.availabilityWindows.length > 0 ? (
                  <strong className="text-slate-700">{selectedDoctor.availabilityWindows.length} availability window{selectedDoctor.availabilityWindows.length === 1 ? '' : 's'} defined</strong>
                ) : (
                  <>
                    Available days: <strong className="text-slate-700">{formatDayList(selectedDoctor.availableDays)}</strong>
                  </>
                )}
                {selectedDoctor.availabilityNotes ? ` · ${selectedDoctor.availabilityNotes}` : ''}
              </span>
            ) : (
              <span>Select a doctor to see availability notes.</span>
            )}
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-2xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-500"
          >
            Book appointment
          </button>
        </div>

        {bookingStatus && (
          <p className="md:col-span-2 rounded-2xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm text-teal-800">
            {bookingStatus}
          </p>
        )}
      </form>

      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Appointments</h3>
        {appointments.length > 0 ? (
          <div className="space-y-3">
            {appointments.map((appointment) => {
              const doctor = typeof appointment.doctorId === 'object' ? appointment.doctorId : null;
              return (
                <div key={appointment._id} className="rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{doctor?.name || 'Doctor'}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {doctor?.specialization || 'Specialist'} · {formatAppointmentDate(appointment.appointmentDate)} · {appointment.timeSlot}
                      </p>
                      {appointment.reason && <p className="mt-2 text-sm text-slate-700">{appointment.reason}</p>}
                    </div>
                      <div className="flex flex-col items-start gap-2 sm:items-end">
                        <span className="inline-flex w-fit rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                          {appointment.status || 'booked'}
                        </span>
                        {!['cancelled', 'completed'].includes(appointment.status || '') && (
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
            No appointments booked yet.
          </p>
        )}
      </div>
    </section>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PatientDashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [doctors, setDoctors] = useState<DoctorSummary[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [uploadingReport, setUploadingReport] = useState(false);
  const [deletingReportId, setDeletingReportId] = useState('');
  const [viewingReport, setViewingReport] = useState<any | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<string | undefined>(undefined);
  const [appointmentDoctorId, setAppointmentDoctorId] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTimeSlot, setAppointmentTimeSlot] = useState('');
  const [appointmentReason, setAppointmentReason] = useState('');
  const [appointmentNotes, setAppointmentNotes] = useState('');
  const [appointmentStatus, setAppointmentStatus] = useState('');
  const [cancellingAppointmentId, setCancellingAppointmentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const searchParams = useSearchParams();
  const activeSection = searchParams.get('section') || 'profile';

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    void loadData();
  }, [router]);

  const loadData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [profileRes, prescriptionsRes, doctorsRes] = await Promise.all([
        fetch('/api/patients/me', { headers: getAuthHeaders(token) }),
        fetch('/api/prescriptions', { headers: getAuthHeaders(token) }),
        fetch('/api/doctors', { headers: getAuthHeaders(token) }),
      ]);
      if (!profileRes.ok || !prescriptionsRes.ok || !doctorsRes.ok) throw new Error('Failed to load patient dashboard');

      const profileData = await profileRes.json();
      const prescriptionData = await prescriptionsRes.json();
      const doctorData = await doctorsRes.json();
      setProfile(profileData);
      setDoctors(Array.isArray(doctorData) ? doctorData : []);
      setPrescriptions(
        profileData?._id
          ? prescriptionData.filter((item: Prescription) => {
              if (typeof item.patientId === 'string') return item.patientId === profileData._id;
              return item.patientId?._id === profileData._id;
            })
          : []
      );

      try {
        const appointmentsRes = await fetch('/api/appointments', { headers: getAuthHeaders(token) });
        if (appointmentsRes.ok) {
          const appointmentsData = await appointmentsRes.json();
          setAppointments(Array.isArray(appointmentsData) ? appointmentsData : []);
        }
      } catch (e) {
        // ignore appointment load failures to keep the rest of the dashboard available
      }

      try {
        const reportsRes = await fetch('/api/reports', { headers: getAuthHeaders(token) });
        if (reportsRes.ok) {
          const reportsData = await reportsRes.json();
          setReports(Array.isArray(reportsData) ? reportsData : []);
        }
      } catch (e) { /* ignore */ }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  function getCloudinaryConfig() {
    return { cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME };
  }

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(new Error('Failed to read report file'));
      reader.readAsDataURL(file);
    });

  const uploadReportFile = async (file: File) => {
    if (isPdfReportFile(file.name, file.type)) return readFileAsDataUrl(file);
    const { cloudName } = getCloudinaryConfig();
    if (!cloudName) throw new Error('Cloudinary is not configured.');
    const token = localStorage.getItem('token');
    const signatureResponse = await fetch('/api/cloudinary/signature', { headers: getAuthHeaders(token) });
    const signatureData = await signatureResponse.json();
    if (!signatureResponse.ok) throw new Error(signatureData.error || 'Failed to prepare Cloudinary upload');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', signatureData.apiKey);
    formData.append('folder', signatureData.folder);
    formData.append('timestamp', signatureData.timestamp);
    formData.append('signature', signatureData.signature);
    const resourceType = getReportUploadResourceType(file);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, { method: 'POST', body: formData });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error?.message || 'Failed to upload report');
    if (!result.secure_url) throw new Error('Cloudinary did not return a URL');
    return result.secure_url;
  };

  const handleReportUpload = async (file: File) => {
    setUploadingReport(true);
    try {
      const uploadedUrl = await uploadReportFile(file);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders(token) },
        body: JSON.stringify({ fileUrl: uploadedUrl, filename: file.name, doctorId: selectedDoctor }),
      });
      if (res.ok) {
        const created = await res.json();
        setReports((r) => [created, ...r]);
      }
    } catch (err) { /* ignore */ }
    finally { setUploadingReport(false); }
  };

  const handleReportDelete = async (reportId: string) => {
    const confirmed = window.confirm('Delete this report? This cannot be undone.');
    if (!confirmed) return;
    setDeletingReportId(reportId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/reports/${reportId}`, { method: 'DELETE', headers: getAuthHeaders(token) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete report');
      }
      setReports((current) => current.filter((r) => r._id !== reportId));
    } catch (err: any) {
      setError(err.message || 'Failed to delete report');
    } finally {
      setDeletingReportId('');
    }
  };

  const recentPrescriptions = prescriptions.slice(0, 5);
  const [viewingPrescription, setViewingPrescription] = useState<Prescription | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);

  function openPrescriptionView(p: Prescription) { setViewingPrescription(p); setIsViewOpen(true); }
  function closePrescriptionView() { setViewingPrescription(null); setIsViewOpen(false); }

  function printPrescription(prescription: Prescription) {
    const win = window.open('', '_blank', 'width=900,height=1100');
    if (!win) return;
    const doctor: any = typeof prescription.doctorId === 'object' ? prescription.doctorId : {};
    const patient: any = typeof prescription.patientId === 'object' ? prescription.patientId : {};
    const medRows = parseMedicineEntries(prescription.medicinesGiven)
      .map((m, i) => `<tr><td>${i + 1}</td><td>${m.name}</td><td>${m.quantity || ''}</td><td>${m.time || ''}</td></tr>`)
      .join('') || '<tr><td colspan="4">No medicines recorded.</td></tr>';
    const issued = formatIssuedDate(prescription.issuedAt);
    const expiry = prescription.expiryAt ? formatIssuedDate(prescription.expiryAt) : '';
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Prescription</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#0f172a}table{width:100%;border-collapse:collapse}th,td{padding:8px;border-bottom:1px solid #e6eef6;text-align:left}h1{margin:0 0 8px}h3{margin:18px 0 8px}.box{border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin:8px 0}.muted{color:#64748b}</style></head><body><h1>Prescription</h1><div class="box"><div><strong>Doctor:</strong> ${doctor?.name || ''}</div><div><strong>Patient:</strong> ${patient?.name || ''}</div><div><strong>Date:</strong> ${issued}</div>${expiry ? `<div><strong>Valid until:</strong> ${expiry}</div>` : ''}</div>${prescription.previousHistory ? `<div class="box"><strong>History</strong><div class="muted">${prescription.previousHistory}</div></div>` : ''}${prescription.investigationsGiven ? `<div class="box"><strong>Investigations</strong><div class="muted">${prescription.investigationsGiven}</div></div>` : ''}<h3>Medicines</h3><table><thead><tr><th>#</th><th>Name</th><th>Qty</th><th>Time</th></tr></thead><tbody>${medRows}</tbody></table>${prescription.notes ? `<div class="box"><strong>Clinical Notes:</strong><div class="muted">${prescription.notes}</div></div>` : ''}${prescription.rawText ? `<div class="box"><strong>Raw Text:</strong><div class="muted">${prescription.rawText}</div></div>` : ''}</body></html>`;
    win.document.open(); win.document.write(html); win.document.close();
    setTimeout(() => { try { win.print(); } catch (e) {} }, 300);
  }

  const handleAppointmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!appointmentDoctorId || !appointmentDate || !appointmentTimeSlot.trim()) {
      setAppointmentStatus('Select a doctor, date, and time slot first.');
      return;
    }

    const selectedDoctor = doctors.find((doctor) => doctor._id === appointmentDoctorId) || null;
    if (!selectedDoctor) {
      setAppointmentStatus('Select a doctor first.');
      return;
    }

    if (!isDoctorAvailableOnDate(selectedDoctor, appointmentDate)) {
      setAppointmentStatus('That date is blocked for the selected doctor.');
      return;
    }

    if (!isDoctorAvailableAtTime(selectedDoctor, appointmentDate, appointmentTimeSlot)) {
      setAppointmentStatus('That time is outside the selected doctor availability.');
      return;
    }

    setAppointmentStatus('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders(token) },
        body: JSON.stringify({
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

      setAppointments((current) => [payload, ...current]);
      setAppointmentStatus('Appointment booked successfully.');
      setAppointmentDoctorId('');
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

      setAppointments((current) => current.map((appointment) => (appointment._id === appointmentId ? { ...appointment, status: 'cancelled' } : appointment)));
      setAppointmentStatus('Appointment cancelled.');
    } catch (err: any) {
      setAppointmentStatus(err.message || 'Failed to cancel appointment');
    } finally {
      setCancellingAppointmentId('');
    }
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'appointments':
        return (
          <AppointmentsSection
            doctors={doctors}
            appointments={appointments}
            selectedDoctorId={appointmentDoctorId}
            appointmentDate={appointmentDate}
            appointmentTimeSlot={appointmentTimeSlot}
            reason={appointmentReason}
            notes={appointmentNotes}
            bookingStatus={appointmentStatus}
            cancellingAppointmentId={cancellingAppointmentId}
            onChangeDoctor={setAppointmentDoctorId}
            onChangeDate={setAppointmentDate}
            onChangeTimeSlot={setAppointmentTimeSlot}
            onChangeReason={setAppointmentReason}
            onChangeNotes={setAppointmentNotes}
            onCancelAppointment={handleCancelAppointment}
            onSubmit={handleAppointmentSubmit}
          />
        );

      case 'doctors':
        return (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Doctors</h2>
            <div className="mt-4 space-y-3">
              {doctors.length > 0 ? (
                doctors.map((doctor) => (
                  <div key={doctor._id} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
                    <p className="font-semibold text-slate-900">{doctor.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{doctor.specialization || ''}</p>
                    <p className="mt-2 text-xs text-slate-400">Available: {formatDayList(doctor.availableDays)}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">You haven't visited any doctors yet.</p>
              )}
            </div>
          </section>
        );

      case 'prescriptions':
        return (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Prescriptions</h2>
            <div className="mt-4 space-y-3">
              {recentPrescriptions.length > 0 ? recentPrescriptions.map((item) => (
                <div key={item._id} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{(typeof item.doctorId === 'object' && item.doctorId?.name) || 'Doctor'}</p>
                      <p className="mt-1 text-xs text-slate-500">{new Date(item.issuedAt).toLocaleString('en-IN')}</p>
                      <p className="mt-2 line-clamp-2 text-slate-600">{item.medicinesGiven || item.rawText || 'No details available.'}</p>
                    </div>
                    <div className="ml-4 flex shrink-0 items-center gap-2">
                      <button type="button" onClick={() => openPrescriptionView(item)}
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">View</button>
                      <button type="button" onClick={() => printPrescription(item)}
                        className="rounded-2xl bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-200">Print</button>
                    </div>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-slate-500">No prescriptions found yet.</p>
              )}
            </div>
          </section>
        );

      case 'reports':
        return (
          <ReportsSection
            reports={reports} prescriptions={prescriptions}
            selectedDoctor={selectedDoctor} setSelectedDoctor={setSelectedDoctor}
            uploadingReport={uploadingReport} deletingReportId={deletingReportId}
            onUpload={handleReportUpload} onView={(r) => setViewingReport(r)} onDelete={handleReportDelete}
          />
        );

      case 'profile':
      default:
        return (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Profile</h2>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <p><span className="font-medium text-slate-900">Age:</span> {profile?.age ?? 'N/A'}</p>
              <p><span className="font-medium text-slate-900">Gender:</span> {profile?.gender || 'N/A'}</p>
              <p><span className="font-medium text-slate-900">Phone:</span> {profile?.phone || 'N/A'}</p>
              <p><span className="font-medium text-slate-900">Email:</span> {profile?.email || 'N/A'}</p>
              <p><span className="font-medium text-slate-900">Address:</span> {profile?.address || 'N/A'}</p>
            </div>
          </section>
        );
    }
  };

  if (loading) return <div className="min-h-[60vh] px-6 py-10 text-slate-600">Loading patient dashboard...</div>;
  if (error) return <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-red-700">{error}</div>;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600">Patient Portal</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Welcome, {profile?.name || 'Patient'}</h1>
        <p className="mt-2 text-sm text-slate-500">Your linked patient account, prescriptions, reports, and appointments.</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {[
            ['profile', 'Profile'],
            ['doctors', 'Doctors'],
            ['appointments', 'Appointments'],
            ['prescriptions', 'Prescriptions'],
            ['reports', 'Reports'],
          ].map(([section, label]) => (
            <Link
              key={section}
              href={`/patient-dashboard?section=${section}`}
              className={[
                'rounded-full px-4 py-2 text-sm font-semibold transition',
                activeSection === section ? 'bg-violet-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              ].join(' ')}
            >
              {label}
            </Link>
          ))}
        </div>
      </section>

      {renderSection()}

      {viewingReport && <ReportViewerModal report={viewingReport} onClose={() => setViewingReport(null)} />}

      {isViewOpen && viewingPrescription && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Prescription</p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">
                  {(typeof viewingPrescription.doctorId === 'object' && viewingPrescription.doctorId?.name) || 'Doctor'}
                </h2>
                <p className="text-sm text-slate-500">{formatIssuedDate(viewingPrescription.issuedAt)}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => printPrescription(viewingPrescription)}
                  className="rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100">Print</button>
                <button onClick={closePrescriptionView}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Close</button>
              </div>
            </div>
            <div className="space-y-5 px-6 py-6">
              <PrescriptionPrintView prescription={viewingPrescription} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}