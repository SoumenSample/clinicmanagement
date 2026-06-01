import { z } from 'zod';

const blankToUndefined = (value: unknown) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const daySchema = z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);

const blankString = z.preprocess(blankToUndefined, z.string().trim().optional());

const availabilityWindowSchema = z.object({
  title: blankString,
  daysOfWeek: z.array(daySchema).default([]),
  startDate: z.string().min(1).optional(),
  endDate: z.string().min(1).optional(),
  startTime: z.string().min(1).optional(),
  endTime: z.string().min(1).optional(),
  note: blankString,
});

const availabilityExceptionSchema = z.object({
  date: z.string().min(1),
  reason: blankString,
});

const availabilitySlotMinutesSchema = z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(30)]).default(15);

export const appointmentCreateSchema = z.object({
  doctorId: z.string().min(1),
  patientId: z.string().optional(),
  appointmentDate: z.string().min(1),
  timeSlot: z.string().min(1),
  reason: z.preprocess(blankToUndefined, z.string().trim().optional()),
  notes: z.preprocess(blankToUndefined, z.string().trim().optional()),
});

export const appointmentUpdateSchema = z.object({
  appointmentDate: z.string().min(1).optional(),
  timeSlot: z.string().min(1).optional(),
  reason: z.preprocess(blankToUndefined, z.string().trim().optional()),
  notes: z.preprocess(blankToUndefined, z.string().trim().optional()),
  status: z.enum(['booked', 'confirmed', 'cancelled', 'completed', 'no_show']).optional(),
});

export const doctorAvailabilitySchema = z.object({
  availableDays: z.array(daySchema).default([]),
  availabilityNotes: z.preprocess(blankToUndefined, z.string().trim().optional()),
  availabilitySlotMinutes: availabilitySlotMinutesSchema,
  availabilityWindows: z.array(availabilityWindowSchema).default([]),
  availabilityExceptions: z.array(availabilityExceptionSchema).default([]),
});