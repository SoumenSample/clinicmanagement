import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import Appointment from '@/lib/models/Appointment';
import Doctor from '@/lib/models/Doctor';
import Patient from '@/lib/models/Patient';
import { writeAuditLog } from '@/lib/services/audit';

type AppointmentStatus = 'booked' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';

function throwHttpError(message: string, statusCode: number) {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  throw error;
}

function normalizeDay(value: string) {
  return value.toLowerCase();
}

function normalizeDateKey(value: string) {
  return value.trim();
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

function normalizeSlotIntervalMinutes(value?: number) {
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

function buildTimeSlotsForWindow(window: any, intervalMinutes: number) {
  const windowStart = toMinutes(window?.startTime);
  const windowEnd = toMinutes(window?.endTime);

  if (windowStart === null || windowEnd === null || windowEnd <= windowStart) {
    return [] as string[];
  }

  const slots: string[] = [];
  for (let current = windowStart; current + intervalMinutes <= windowEnd; current += intervalMinutes) {
    slots.push(buildTimeSlotLabel(current, intervalMinutes));
  }

  return slots;
}

function extractStartTime(timeSlot: string) {
  const firstPart = timeSlot.split(/\s*(?:to|-|–|—)\s*/i)[0] || timeSlot;
  const match = firstPart.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
  return match?.[1] || firstPart.trim();
}

function isDateWithinRange(dateKey: string, startDate?: string, endDate?: string) {
  const target = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(target.getTime())) return false;

  if (startDate) {
    const start = new Date(`${startDate}T00:00:00`);
    if (!Number.isNaN(start.getTime()) && target < start) return false;
  }

  if (endDate) {
    const end = new Date(`${endDate}T23:59:59`);
    if (!Number.isNaN(end.getTime()) && target > end) return false;
  }

  return true;
}

function matchesAvailabilityWindow(params: {
  appointmentDate: string;
  appointmentTimeSlot: string;
  window: any;
  intervalMinutes?: number;
  strictSlotMatch?: boolean;
}) {
  const dayName = appointmentDayName(params.appointmentDate);
  const appointmentTime = params.appointmentTimeSlot.trim();
  const appointmentMinutes = toMinutes(extractStartTime(appointmentTime));

  if (params.window.daysOfWeek?.length > 0 && !params.window.daysOfWeek.map(normalizeDay).includes(dayName)) {
    return false;
  }

  if (params.window.startDate || params.window.endDate) {
    if (!isDateWithinRange(params.appointmentDate, params.window.startDate, params.window.endDate)) {
      return false;
    }
  }

  const windowStart = toMinutes(params.window.startTime);
  const windowEnd = toMinutes(params.window.endTime);
  const intervalMinutes = normalizeSlotIntervalMinutes(params.intervalMinutes);

  if (params.strictSlotMatch && windowStart !== null && windowEnd !== null) {
    const generatedSlots = buildTimeSlotsForWindow(params.window, intervalMinutes);
    if (generatedSlots.length === 0) return false;
    return generatedSlots.includes(appointmentTime);
  }

  if ((windowStart !== null || windowEnd !== null) && appointmentMinutes !== null) {
    if (windowStart !== null && appointmentMinutes < windowStart) return false;
    if (windowEnd !== null && appointmentMinutes > windowEnd) return false;
  }

  return true;
}

function hasBlockedException(doctor: any, appointmentDate: string) {
  const targetDate = normalizeDateKey(appointmentDate);
  return Array.isArray(doctor?.availabilityExceptions)
    ? doctor.availabilityExceptions.some((item: any) => normalizeDateKey(item?.date || '') === targetDate)
    : false;
}

function isBookableByLegacyDays(doctor: any, appointmentDate: string) {
  const dayName = appointmentDayName(appointmentDate);
  const availableDays = Array.isArray(doctor?.availableDays) ? doctor.availableDays.map(normalizeDay) : [];
  return availableDays.length === 0 || availableDays.includes(dayName);
}

function isBookableByWindows(doctor: any, appointmentDate: string, timeSlot: string, strictSlotMatch = false) {
  const windows = Array.isArray(doctor?.availabilityWindows) ? doctor.availabilityWindows : [];
  if (windows.length === 0) return true;
  const intervalMinutes = normalizeSlotIntervalMinutes(doctor?.availabilitySlotMinutes);
  return windows.some((window: any) => matchesAvailabilityWindow({ appointmentDate, appointmentTimeSlot: timeSlot, window, intervalMinutes, strictSlotMatch }));
}

function appointmentDayName(appointmentDate: string) {
  const date = new Date(`${appointmentDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
}

async function resolvePatientId(tenantId: string, role: string, userId: string, patientId?: string) {
  if (role === 'patient') {
    const patient: any = await Patient.findOne({ tenantId, userId }).lean();
    if (!patient) throwHttpError('Patient profile not found', 404);
    return patient._id.toString();
  }

  if (!patientId) {
    throwHttpError('patientId is required', 400);
  }

  if (!mongoose.isValidObjectId(patientId)) {
    throwHttpError('Invalid patient ID', 400);
  }

  const patient: any = await Patient.findOne({ _id: patientId, tenantId }).lean();
  if (!patient) throwHttpError('Patient not found in this tenant', 404);
  return patient._id.toString();
}

async function resolveDoctor(tenantId: string, doctorId: string) {
  if (!mongoose.isValidObjectId(doctorId)) {
    throwHttpError('Invalid doctor ID', 400);
  }

  const doctor: any = await Doctor.findOne({ _id: doctorId, tenantId }).lean();
  if (!doctor) throwHttpError('Doctor not found in this tenant', 404);
  return doctor;
}

async function enrichAppointments(query: Record<string, unknown>) {
  return Appointment.find(query)
    .populate('patientId', 'name phone email age gender')
    .populate('doctorId', 'name specialization clinicName clinicAddress phone email availableDays availabilityNotes availabilitySlotMinutes')
    .populate('bookedByUserId', 'name email role')
    .sort({ appointmentDate: 1, timeSlot: 1, createdAt: -1 })
    .lean();
}

export async function listAppointments(params: {
  tenantId: string;
  role: string;
  userId: string;
  doctorId?: string;
  patientId?: string;
}) {
  await connectDB();

  const query: Record<string, unknown> = { tenantId: params.tenantId };

  if (params.role === 'patient') {
    const patient: any = await Patient.findOne({ tenantId: params.tenantId, userId: params.userId }).lean();
    if (!patient) throwHttpError('Patient profile not found', 404);
    query.patientId = patient._id;
  } else if (params.role === 'doctor') {
    const doctor: any = await Doctor.findOne({ tenantId: params.tenantId, userId: params.userId }).lean();
    if (!doctor) throwHttpError('Doctor profile not found', 404);
    query.doctorId = doctor._id;
  } else {
    if (params.doctorId && mongoose.isValidObjectId(params.doctorId)) {
      query.doctorId = params.doctorId;
    }
    if (params.patientId && mongoose.isValidObjectId(params.patientId)) {
      query.patientId = params.patientId;
    }
  }

  return enrichAppointments(query);
}

export async function createAppointment(params: {
  tenantId: string;
  role: string;
  userId: string;
  doctorId: string;
  patientId?: string;
  appointmentDate: string;
  timeSlot: string;
  reason?: string;
  notes?: string;
}) {
  await connectDB();

  if (!params.tenantId || !mongoose.isValidObjectId(params.tenantId)) {
    throwHttpError('Tenant context is required', 400);
  }

  const doctor = await resolveDoctor(params.tenantId, params.doctorId);
  const patientId = await resolvePatientId(params.tenantId, params.role, params.userId, params.patientId);

  const dayName = appointmentDayName(params.appointmentDate);
  if (!dayName) {
    throwHttpError('Invalid appointment date', 400);
  }

  if (hasBlockedException(doctor, params.appointmentDate)) {
    throwHttpError('Selected doctor is unavailable on the chosen date', 400);
  }

  const appointmentDate = params.appointmentDate.trim();
  const timeSlot = params.timeSlot.trim();

  if (!isBookableByWindows(doctor, appointmentDate, timeSlot, params.role === 'patient') || !isBookableByLegacyDays(doctor, appointmentDate)) {
    throwHttpError('Selected doctor is not available at that date and time', 400);
  }

  const conflict = await Appointment.findOne({
    tenantId: params.tenantId,
    doctorId: doctor._id,
    appointmentDate,
    timeSlot,
    status: { $ne: 'cancelled' },
  }).lean();

  if (conflict) {
    throwHttpError('This time slot is already booked', 409);
  }

  const appointment = await Appointment.create({
    tenantId: params.tenantId,
    patientId,
    doctorId: doctor._id,
    bookedByUserId: params.userId,
    bookedByRole: params.role,
    appointmentDate,
    timeSlot,
    reason: params.reason,
    notes: params.notes,
    source:
      params.role === 'patient'
        ? 'patient'
        : params.role === 'doctor'
          ? 'doctor'
          : params.role === 'admin' || params.role === 'owner'
            ? 'admin'
            : 'staff',
    status: 'booked',
  });

  await writeAuditLog({
    tenantId: params.tenantId,
    actorUserId: params.userId,
    module: 'clinic',
    action: 'create',
    entityType: 'Appointment',
    entityId: appointment._id.toString(),
    after: appointment.toObject(),
  });

  return Appointment.findById(appointment._id)
    .populate('patientId', 'name phone email age gender')
    .populate('doctorId', 'name specialization clinicName clinicAddress phone email availableDays availabilityNotes availabilitySlotMinutes')
    .populate('bookedByUserId', 'name email role');
}

export async function updateAppointment(params: {
  tenantId: string;
  role: string;
  userId: string;
  appointmentId: string;
  updates: Partial<{
    appointmentDate: string;
    timeSlot: string;
    reason: string;
    notes: string;
    status: AppointmentStatus;
  }>;
}) {
  await connectDB();

  if (!mongoose.isValidObjectId(params.appointmentId)) {
    throwHttpError('Invalid appointment ID', 400);
  }

  const appointment = await Appointment.findOne({ _id: params.appointmentId, tenantId: params.tenantId });
  if (!appointment) throwHttpError('Appointment not found', 404);

  if (params.role === 'patient') {
    const patient: any = await Patient.findOne({ tenantId: params.tenantId, userId: params.userId }).lean();
    if (!patient || patient._id.toString() !== appointment.patientId.toString()) {
      throwHttpError('You can only manage your own appointments', 403);
    }
  } else if (params.role === 'doctor') {
    const doctor: any = await Doctor.findOne({ tenantId: params.tenantId, userId: params.userId }).lean();
    if (!doctor || doctor._id.toString() !== appointment.doctorId.toString()) {
      throwHttpError('You can only manage your own appointments', 403);
    }
  }

  const doctor: any = await Doctor.findOne({ _id: appointment.doctorId, tenantId: params.tenantId }).lean();
  if (!doctor) throwHttpError('Doctor profile not found', 404);

  const nextDate = params.updates.appointmentDate || appointment.appointmentDate;
  const nextSlot = params.updates.timeSlot || appointment.timeSlot;

  if (params.updates.appointmentDate || params.updates.timeSlot) {
    if (hasBlockedException(doctor, nextDate)) {
      throwHttpError('Selected doctor is unavailable on the chosen date', 400);
    }

    if (!isBookableByWindows(doctor, nextDate, nextSlot, params.role === 'patient') || !isBookableByLegacyDays(doctor, nextDate)) {
      throwHttpError('Selected doctor is not available at that date and time', 400);
    }

    const conflict = await Appointment.findOne({
      tenantId: params.tenantId,
      doctorId: appointment.doctorId,
      appointmentDate: nextDate,
      timeSlot: nextSlot,
      status: { $ne: 'cancelled' },
      _id: { $ne: appointment._id },
    }).lean();

    if (conflict) {
      throwHttpError('This time slot is already booked', 409);
    }
  }

  const before = appointment.toObject();
  appointment.appointmentDate = nextDate;
  appointment.timeSlot = nextSlot;

  if (params.updates.reason !== undefined) appointment.reason = params.updates.reason;
  if (params.updates.notes !== undefined) appointment.notes = params.updates.notes;
  if (params.updates.status !== undefined) appointment.status = params.updates.status;

  await appointment.save();

  await writeAuditLog({
    tenantId: params.tenantId,
    actorUserId: params.userId,
    module: 'clinic',
    action: 'update',
    entityType: 'Appointment',
    entityId: appointment._id.toString(),
    before,
    after: appointment.toObject(),
  });

  return Appointment.findById(appointment._id)
    .populate('patientId', 'name phone email age gender')
    .populate('doctorId', 'name specialization clinicName clinicAddress phone email availableDays availabilityNotes availabilitySlotMinutes')
    .populate('bookedByUserId', 'name email role');
}

export async function updateDoctorAvailability(params: {
  tenantId: string;
  userId: string;
  availableDays: string[];
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
  availabilityExceptions?: Array<{ date?: string; reason?: string }>;
}) {
  const doctor = await Doctor.findOne({ tenantId: params.tenantId, userId: params.userId });
  if (!doctor) throwHttpError('Doctor profile not found', 404);

  return updateDoctorAvailabilityRecord({
    doctor,
    tenantId: params.tenantId,
    actorUserId: params.userId,
    availableDays: params.availableDays,
    availabilityNotes: params.availabilityNotes,
    availabilitySlotMinutes: params.availabilitySlotMinutes,
    availabilityWindows: params.availabilityWindows,
    availabilityExceptions: params.availabilityExceptions,
  });
}

export async function updateDoctorAvailabilityByDoctorId(params: {
  tenantId: string;
  actorUserId: string;
  doctorId: string;
  availableDays: string[];
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
  availabilityExceptions?: Array<{ date?: string; reason?: string }>;
}) {
  await connectDB();

  if (!mongoose.isValidObjectId(params.doctorId)) {
    throwHttpError('Invalid doctor ID', 400);
  }

  const doctor = await Doctor.findOne({ _id: params.doctorId, tenantId: params.tenantId });
  if (!doctor) throwHttpError('Doctor profile not found', 404);

  return updateDoctorAvailabilityRecord({
    doctor,
    tenantId: params.tenantId,
    actorUserId: params.actorUserId,
    availableDays: params.availableDays,
    availabilityNotes: params.availabilityNotes,
    availabilitySlotMinutes: params.availabilitySlotMinutes,
    availabilityWindows: params.availabilityWindows,
    availabilityExceptions: params.availabilityExceptions,
  });
}

async function updateDoctorAvailabilityRecord(params: {
  doctor: any;
  tenantId: string;
  actorUserId: string;
  availableDays: string[];
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
  availabilityExceptions?: Array<{ date?: string; reason?: string }>;
}) {
  const { doctor } = params;

  const before = doctor.toObject();
  const derivedDays = Array.from(
    new Set(
      (params.availabilityWindows || [])
        .flatMap((window) => window.daysOfWeek || [])
        .map(normalizeDay)
        .filter(Boolean)
    )
  );

  doctor.availableDays = derivedDays.length > 0 ? derivedDays : params.availableDays;
  doctor.availabilityNotes = params.availabilityNotes;
  doctor.availabilitySlotMinutes = normalizeSlotIntervalMinutes(params.availabilitySlotMinutes);
  doctor.availabilityWindows = params.availabilityWindows || [];
  doctor.availabilityExceptions = params.availabilityExceptions || [];
  await doctor.save();

  await writeAuditLog({
    tenantId: params.tenantId,
    actorUserId: params.actorUserId,
    module: 'clinic',
    action: 'update',
    entityType: 'Doctor',
    entityId: doctor._id.toString(),
    before,
    after: doctor.toObject(),
  });

  return doctor;
}

export async function getDoctorAvailability(params: { tenantId: string; userId: string }) {
  await connectDB();
  return Doctor.findOne({ tenantId: params.tenantId, userId: params.userId }).lean();
}

export async function getDoctorAvailabilityByDoctorId(params: { tenantId: string; doctorId: string }) {
  await connectDB();

  if (!mongoose.isValidObjectId(params.doctorId)) {
    throwHttpError('Invalid doctor ID', 400);
  }

  return Doctor.findOne({ tenantId: params.tenantId, _id: params.doctorId }).lean();
}