import { z } from 'zod';

const blankToUndefined = (value: unknown) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const doctorSchema = z.object({
  name: z.string().trim().min(1),
  specialization: z.string().trim().min(1),
  consultationFee: z.coerce.number().min(0),
  degree: z.string().trim().optional(),
  clinicName: z.preprocess(blankToUndefined, z.string().trim().optional()),
  clinicAddress: z.preprocess(blankToUndefined, z.string().trim().optional()),
  phone: z.preprocess(blankToUndefined, z.string().trim().optional()),
  email: z.preprocess(blankToUndefined, z.string().trim().email().optional()),
  registrationNumber: z.preprocess(blankToUndefined, z.string().trim().optional()),
  notes: z.preprocess(blankToUndefined, z.string().trim().optional()),
});

export const patientSchema = z.object({
  doctorId: z.string().optional(),
  doctorIds: z.array(z.string()).optional(),
  name: z.string().min(1),
  age: z.number().min(0).optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  allergies: z.array(z.string()).optional(),
  historySummary: z.string().optional(),
  lastVisitAt: z.string().optional(),
});

export const prescriptionManualSchema = z.object({
  doctorId: z.string().min(1),
  patientId: z.string().min(1),
  previousHistory: z.string().optional(),
  investigationsGiven: z.string().optional(),
  medicinesGiven: z.string().optional(),
  rawText: z.string().optional(),
  notes: z.string().optional(),
  issuedAt: z.string().optional(),
  expiryAt: z.string().optional(),
  source: z.enum(['clinic', 'walk-in', 'upload']).optional(),
});

export const prescriptionLinkSchema = z.object({
  saleId: z.string().min(1),
});

export const prescriptionUpdateSchema = z.object({
  doctorId: z.string().min(1).optional(),
  patientId: z.string().min(1).optional(),
  prescriptionType: z.enum(['image', 'pdf', 'manual']).optional(),
  source: z.enum(['clinic', 'walk-in', 'upload']).optional(),
  fileUrl: z.string().optional(),
  fileName: z.string().optional(),
  mimeType: z.string().optional(),
  previousHistory: z.string().optional(),
  investigationsGiven: z.string().optional(),
  medicinesGiven: z.string().optional(),
  rawText: z.string().optional(),
  status: z.enum(['draft', 'reviewed', 'linked', 'closed']).optional(),
  notes: z.string().optional(),
  issuedAt: z.string().optional(),
  expiryAt: z.string().optional(),
});