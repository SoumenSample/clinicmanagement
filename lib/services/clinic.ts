import connectDB from '@/lib/db';
import mongoose from 'mongoose';
import Category from '@/lib/models/Category';
import Doctor from '@/lib/models/Doctor';
import Medicine from '@/lib/models/Medicine';
import Patient from '@/lib/models/Patient';
import Prescription from '@/lib/models/Prescription';
import Sale from '@/lib/models/Sale';
import User from '@/lib/models/User';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { calculateInclusiveTaxBreakdown } from '@/lib/utils/gst';
import { writeAuditLog } from '@/lib/services/audit';
import { sendTemporaryPasswordEmail } from '@/lib/mailer';

export interface DoctorPayload {
  name: string;
  specialization: string;
  consultationFee: number;
  degree?: string;
  clinicName?: string;
  clinicAddress?: string;
  phone?: string;
  email?: string;
  registrationNumber?: string;
  notes?: string;
  availabilitySlotMinutes?: number;
}

type PortalAccountRole = 'doctor' | 'patient';

function throwHttpError(message: string, statusCode: number) {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  throw error;
}

function throwMongoWriteError(error: any, fallbackMessage: string) {
  if (error?.code === 11000) {
    const duplicatedField = Object.keys(error?.keyValue || {})[0];
    const message = duplicatedField
      ? `A record with this ${duplicatedField} already exists`
      : 'A record with this value already exists';
    throwHttpError(message, 409);
  }

  if (error?.name === 'ValidationError') {
    throwHttpError(error.message || fallbackMessage, 400);
  }

  throw error;
}

function generateTemporaryPassword() {
  return crypto.randomBytes(8).toString('base64url');
}

async function createPortalAccount(params: {
  tenantId: string;
  email: string;
  name: string;
  role: PortalAccountRole;
}) {
  const normalizedEmail = params.email.toLowerCase().trim();

  if (!normalizedEmail) {
    throwHttpError(`Email is required to create a ${params.role} portal account`, 400);
  }

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throwHttpError('A user with this email already exists', 409);
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);

  let user;
  try {
    user = await User.create({
      tenantId: params.tenantId,
      email: normalizedEmail,
      password: passwordHash,
      name: params.name,
      role: params.role,
      isVerified: true,
    });
  } catch (error) {
    throwMongoWriteError(error, `Failed to create ${params.role} portal account`);
  }

  return { user, temporaryPassword, email: normalizedEmail };
}

export interface PatientPayload {
  name: string;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  phone?: string;
  email?: string;
  address?: string;
  allergies?: string[];
  historySummary?: string;
  lastVisitAt?: string;
  doctorId?: string;
  doctorIds?: string[];
}

export interface PrescriptionPayload {
  doctorId: string;
  patientId: string;
  prescriptionType: 'image' | 'pdf' | 'manual';
  source?: 'clinic' | 'walk-in' | 'upload';
  fileUrl?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  previousHistory?: string;
  investigationsGiven?: string;
  medicinesGiven?: string;
  rawText?: string;
  notes?: string;
  issuedAt?: string;
  expiryAt?: string;
}

export interface SaleItemPayload {
  medicineId: string;
  quantity: number;
  price?: number;
  mrp?: number;
}

export interface SalePayload {
  items?: SaleItemPayload[];
  patientName: string;
  patientPhone?: string;
  doctorId: string;
  doctorName?: string;
  doctorFee?: number;
  paymentMethod: 'cash' | 'card' | 'cheque' | 'online';
  discountPercent?: number;
  notes?: string;
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
}

function buildPrescriptionText(payload: Pick<PrescriptionPayload, 'rawText' | 'previousHistory' | 'investigationsGiven' | 'medicinesGiven' | 'notes'>) {
  return [payload.previousHistory, payload.investigationsGiven, payload.medicinesGiven, payload.notes, payload.rawText]
    .filter(Boolean)
    .join('\n\n');
}

function parseMedicineList(value?: string) {
  if (!value) return [] as string[];
  return value
    .split(/\r?\n|,|;|\|/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function mergeMedicineNames(...groups: string[][]) {
  const map = new Map<string, string>();
  for (const group of groups) {
    for (const name of group) {
      const normalized = name.trim();
      if (!normalized) continue;
      const key = normalized.toLowerCase();
      if (!map.has(key)) {
        map.set(key, normalized);
      }
    }
  }
  return Array.from(map.values()).slice(0, 20);
}

async function suggestMedicines(tenantId: string, rawText?: string) {
  if (!rawText) return [] as string[];

  const medicines = await Medicine.find({ tenantId }, { name: 1, brand: 1 }).limit(500);
  const normalized = normalizeText(rawText);
  const suggestions: string[] = [];

  for (const medicine of medicines) {
    const name = medicine.name?.toLowerCase?.() || '';
    const brand = medicine.brand?.toLowerCase?.() || '';
    if ((name && normalized.includes(name)) || (brand && normalized.includes(brand))) {
      suggestions.push(medicine.name);
    }
  }

  return Array.from(new Set(suggestions)).slice(0, 10);
}

export async function listDoctors(tenantId: string) {
  await connectDB();
  return Doctor.find({ tenantId }).sort({ createdAt: -1 });
}

// lib/services/clinic.ts — only the changed functions shown, rest is identical

export async function createDoctor(tenantId: string, actorUserId: string, payload: DoctorPayload) {
  await connectDB();

  const normalizedTenantId = tenantId?.trim();
  if (!normalizedTenantId || !mongoose.isValidObjectId(normalizedTenantId)) {
    throwHttpError('Tenant context is required to create a doctor', 400);
  }

  const email = payload.email?.trim() || undefined;

  // ✅ Fix 1: declare doctor outside try so rollback can reference it safely
  let doctor: any = null;
  let linkedAccount: Awaited<ReturnType<typeof createPortalAccount>> | null = null;

  try {
    doctor = await Doctor.create({
      tenantId: normalizedTenantId,
      ...payload,
      email: email || undefined,
    });
  } catch (error) {
    throwMongoWriteError(error, 'Failed to create doctor');
  }

  // ✅ Fix 2: only attempt portal account creation in its own try/catch
  // with clean rollback that guards against doctor being null
  try {
    if (email) {
      linkedAccount = await createPortalAccount({
        tenantId: normalizedTenantId,
        email,
        name: payload.name,
        role: 'doctor',
      });

      doctor.userId = linkedAccount.user._id;
      await doctor.save();

      void sendTemporaryPasswordEmail(
        linkedAccount.email,
        payload.name,
        'doctor',
        linkedAccount.temporaryPassword
      ).catch((err) => {
        console.warn('Failed to send doctor portal credentials', err);
      });
    }
  } catch (error) {
    // ✅ Fix 3: rollback only if doctor was actually created
    if (doctor?._id) {
      await Doctor.findByIdAndDelete(doctor._id).catch(() => null);
    }
    if (linkedAccount?.user?._id) {
      await User.findByIdAndDelete(linkedAccount.user._id).catch(() => null);
    }
    throw error;
  }

  await writeAuditLog({
    tenantId: normalizedTenantId,
    actorUserId,
    module: 'clinic',
    action: 'create',
    entityType: 'Doctor',
    entityId: doctor._id.toString(),
    after: doctor.toObject(),
  });

  return {
    ...doctor.toObject(),
    temporaryPassword: linkedAccount?.temporaryPassword,
  };
}

export async function updateDoctor(tenantId: string, actorUserId: string, doctorId: string, payload: Partial<DoctorPayload>) {
  await connectDB();
  const before = await Doctor.findOne({ _id: doctorId, tenantId });
  if (!before) return null;
  const doctor = await Doctor.findOneAndUpdate({ _id: doctorId, tenantId }, { $set: payload }, { new: true });
  if (doctor) {
    await writeAuditLog({
      tenantId,
      actorUserId,
      module: 'clinic',
      action: 'update',
      entityType: 'Doctor',
      entityId: doctorId,
      before: before.toObject(),
      after: doctor.toObject(),
    });
  }
  return doctor;
}

export async function deleteDoctor(tenantId: string, actorUserId: string, doctorId: string) {
  await connectDB();
  const doctor = await Doctor.findOneAndDelete({ _id: doctorId, tenantId });
  if (!doctor) return null;
  await writeAuditLog({
    tenantId,
    actorUserId,
    module: 'clinic',
    action: 'delete',
    entityType: 'Doctor',
    entityId: doctorId,
    before: doctor.toObject(),
  });
  return doctor;
}

export async function listPatients(tenantId: string) {
  await connectDB();

  const [patients, doctors] = await Promise.all([
    Patient.find({ tenantId })
      .populate('doctorId', 'name specialization')
      .populate('doctorIds', 'name specialization')
      .sort({ createdAt: -1 }),
    Doctor.find({ tenantId }, { name: 1, specialization: 1 }),
  ]);

  const doctorNameMap = new Map(
    doctors.map((doctor: any) => [String(doctor._id), doctor.name])
  );

  return patients.map((patient: any) => {
    const patientObj = patient.toObject();
    const assignedDoctorNames = new Set<string>();

    const addDoctor = (doctor: any) => {
      if (!doctor) return;
      if (typeof doctor === 'string') {
        const resolvedName = doctorNameMap.get(doctor);
        if (resolvedName) assignedDoctorNames.add(resolvedName);
        return;
      }

      if (doctor._id) {
        const resolvedName = doctorNameMap.get(String(doctor._id)) || doctor.name;
        if (resolvedName) assignedDoctorNames.add(resolvedName);
        return;
      }

      if (doctor.name) {
        assignedDoctorNames.add(doctor.name);
      }
    };

    addDoctor(patientObj.doctorId);
    if (Array.isArray(patientObj.doctorIds)) {
      patientObj.doctorIds.forEach(addDoctor);
    }

    return {
      ...patientObj,
      assignedDoctorNames: Array.from(assignedDoctorNames),
      assignedDoctorCount: assignedDoctorNames.size,
    };
  });
}

export async function createPatient(tenantId: string, actorUserId: string, payload: PatientPayload) {
  await connectDB();
  const normalizedTenantId = tenantId?.trim();
  if (!normalizedTenantId || !mongoose.isValidObjectId(normalizedTenantId)) {
    throwHttpError('Tenant context is required to create a patient', 400);
  }

  const email: string = payload.email?.trim() ?? '';
  if (!email) {
    throwHttpError('Email is required to create a patient portal account', 400);
  }

  let patient;
  try {
    const doctorIds = Array.from(
      new Set([
        ...(payload.doctorIds || []),
        payload.doctorId || '',
      ].filter((value): value is string => Boolean(value && value.trim())))
    );

    patient = await Patient.create({
      tenantId: normalizedTenantId,
      ...payload,
      email,
      doctorId: doctorIds[0] || undefined,
      doctorIds,
      allergies: payload.allergies || [],
      lastVisitAt: payload.lastVisitAt ? new Date(payload.lastVisitAt) : undefined,
    });
  } catch (error) {
    throwMongoWriteError(error, 'Failed to create patient');
  }
  let linkedAccount: Awaited<ReturnType<typeof createPortalAccount>> | null = null;

  try {
    linkedAccount = await createPortalAccount({
      tenantId: normalizedTenantId,
      email,
      name: payload.name,
      role: 'patient',
    });

    patient.userId = linkedAccount.user._id;
    await patient.save();

    void sendTemporaryPasswordEmail(linkedAccount.email, payload.name, 'patient', linkedAccount.temporaryPassword).catch((error) => {
      console.warn('Failed to send patient portal credentials', error);
    });
  } catch (error) {
    await Patient.findByIdAndDelete(patient._id).catch(() => null);
    if (linkedAccount?.user?._id) {
      await User.findByIdAndDelete(linkedAccount.user._id).catch(() => null);
    }
    throw error;
  }

  await writeAuditLog({
    tenantId: normalizedTenantId,
    actorUserId,
    module: 'clinic',
    action: 'create',
    entityType: 'Patient',
    entityId: patient._id.toString(),
    after: patient.toObject(),
  });
  return {
    ...patient.toObject(),
    temporaryPassword: linkedAccount?.temporaryPassword,
  };
}

export async function updatePatient(tenantId: string, actorUserId: string, patientId: string, payload: Partial<PatientPayload>) {
  await connectDB();
  const before = await Patient.findOne({ _id: patientId, tenantId });
  if (!before) return null;
  const update: Record<string, unknown> = { ...payload };
  if (payload.lastVisitAt) update.lastVisitAt = new Date(payload.lastVisitAt);
  const patient = await Patient.findOneAndUpdate({ _id: patientId, tenantId }, { $set: update }, { new: true });
  if (patient) {
    await writeAuditLog({
      tenantId,
      actorUserId,
      module: 'clinic',
      action: 'update',
      entityType: 'Patient',
      entityId: patientId,
      before: before.toObject(),
      after: patient.toObject(),
    });
  }
  return patient;
}

export async function deletePatient(tenantId: string, actorUserId: string, patientId: string) {
  await connectDB();
  const patient = await Patient.findOneAndDelete({ _id: patientId, tenantId });
  if (!patient) return null;

  await writeAuditLog({
    tenantId,
    actorUserId,
    module: 'clinic',
    action: 'delete',
    entityType: 'Patient',
    entityId: patientId,
    before: patient.toObject(),
  });

  return patient;
}

export async function listPrescriptions(tenantId: string) {
  await connectDB();
  return Prescription.find({ tenantId })
    .populate('doctorId', 'name specialization degree clinicName registrationNumber')
    .populate('patientId', 'name phone age gender')
    .populate('linkedSaleId', 'invoiceNumber totalAmount saleDate')
    .sort({ createdAt: -1 });
}

export async function createPrescription(tenantId: string, actorUserId: string, payload: PrescriptionPayload) {
  await connectDB();

  const suggestionSourceText = buildPrescriptionText(payload);
  const inferredMedicines = await suggestMedicines(tenantId, suggestionSourceText);
  const explicitMedicines = parseMedicineList(payload.medicinesGiven);
  const suggestedMedicines = mergeMedicineNames(inferredMedicines, explicitMedicines);
  const prescription = await Prescription.create({
    tenantId,
    doctorId: payload.doctorId,
    patientId: payload.patientId,
    prescriptionType: payload.prescriptionType,
    source: payload.source || 'walk-in',
    fileUrl: payload.fileUrl,
    fileName: payload.fileName,
    mimeType: payload.mimeType,
    fileSize: payload.fileSize,
    previousHistory: payload.previousHistory,
    investigationsGiven: payload.investigationsGiven,
    medicinesGiven: payload.medicinesGiven,
    rawText: payload.rawText,
    notes: payload.notes,
    issuedAt: payload.issuedAt ? new Date(payload.issuedAt) : new Date(),
    expiryAt: payload.expiryAt ? new Date(payload.expiryAt) : undefined,
    suggestedMedicines,
  });

  await writeAuditLog({
    tenantId,
    actorUserId,
    module: 'clinic',
    action: 'create',
    entityType: 'Prescription',
    entityId: prescription._id.toString(),
    after: prescription.toObject(),
  });

  return prescription;
}

export async function updatePrescription(
  tenantId: string,
  actorUserId: string,
  prescriptionId: string,
  payload: Partial<PrescriptionPayload & { status?: 'draft' | 'reviewed' | 'linked' | 'closed' }>
) {
  await connectDB();

  const before = await Prescription.findOne({ _id: prescriptionId, tenantId });
  if (!before) return null;
  const beforeData = before as any;

  const update: Record<string, unknown> = { ...payload };
  if (payload.issuedAt) update.issuedAt = new Date(payload.issuedAt);
  if (payload.expiryAt) update.expiryAt = new Date(payload.expiryAt);
  if (payload.doctorId) update.doctorId = payload.doctorId;
  if (payload.patientId) update.patientId = payload.patientId;
  if (payload.previousHistory !== undefined) update.previousHistory = payload.previousHistory;
  if (payload.investigationsGiven !== undefined) update.investigationsGiven = payload.investigationsGiven;
  if (payload.medicinesGiven !== undefined) update.medicinesGiven = payload.medicinesGiven;
  if (payload.rawText !== undefined) update.rawText = payload.rawText;

  const shouldRefreshSuggestions =
    payload.previousHistory !== undefined ||
    payload.investigationsGiven !== undefined ||
    payload.medicinesGiven !== undefined ||
    payload.rawText !== undefined ||
    payload.notes !== undefined;

  if (shouldRefreshSuggestions) {
    const composedText = buildPrescriptionText({
      previousHistory: payload.previousHistory ?? beforeData.previousHistory,
      investigationsGiven: payload.investigationsGiven ?? beforeData.investigationsGiven,
      medicinesGiven: payload.medicinesGiven ?? beforeData.medicinesGiven,
      notes: payload.notes ?? beforeData.notes,
      rawText: payload.rawText ?? beforeData.rawText,
    });

    const inferredMedicines = await suggestMedicines(tenantId, composedText);
    const explicitMedicines = parseMedicineList(payload.medicinesGiven ?? beforeData.medicinesGiven);
    update.suggestedMedicines = mergeMedicineNames(inferredMedicines, explicitMedicines);
  }

  const prescription = await Prescription.findOneAndUpdate(
    { _id: prescriptionId, tenantId },
    { $set: update },
    { new: true }
  )
    .populate('doctorId', 'name specialization degree clinicName registrationNumber')
    .populate('patientId', 'name phone age gender')
    .populate('linkedSaleId', 'invoiceNumber totalAmount saleDate');

  if (prescription) {
    await writeAuditLog({
      tenantId,
      actorUserId,
      module: 'clinic',
      action: 'update',
      entityType: 'Prescription',
      entityId: prescriptionId,
      before: before.toObject(),
      after: prescription.toObject(),
    });
  }

  return prescription;
}

export async function deletePrescription(tenantId: string, actorUserId: string, prescriptionId: string) {
  await connectDB();

  const prescription = await Prescription.findOneAndDelete({ _id: prescriptionId, tenantId });
  if (!prescription) return null;

  await writeAuditLog({
    tenantId,
    actorUserId,
    module: 'clinic',
    action: 'delete',
    entityType: 'Prescription',
    entityId: prescriptionId,
    before: prescription.toObject(),
  });

  return prescription;
}

function buildSaleQuery(tenantId: string, saleId: string) {
  return {
    _id: saleId,
    $or: [{ tenantId }, { tenantId: { $exists: false } }],
  };
}

function buildMedicineQuery(tenantId: string, medicineIds: string[]) {
  return {
    _id: { $in: medicineIds },
    $or: [{ tenantId }, { tenantId: { $exists: false } }],
  };
}

function aggregateSaleItems(items: SaleItemPayload[]) {
  const grouped = new Map<string, number>();

  for (const item of items) {
    grouped.set(item.medicineId, (grouped.get(item.medicineId) || 0) + item.quantity);
  }

  return grouped;
}

async function buildSaleItemSnapshots(
  tenantId: string,
  items: SaleItemPayload[],
  discountPercent = 0
) {
  const medicineIds = Array.from(new Set(items.map((item) => item.medicineId)));
  const medicines = await Medicine.find(buildMedicineQuery(tenantId, medicineIds));
  const medicineMap = new Map(medicines.map((medicine) => [medicine._id.toString(), medicine]));
  const categories = await Category.find({
    tenantId,
    name: { $in: Array.from(new Set(medicines.map((medicine) => medicine.category).filter(Boolean))) },
  });
  const categoryMap = new Map(
    categories.map((category) => [String(category.name).trim().toLowerCase(), category])
  );

  const saleItems = items.map((item) => {
    const medicine = medicineMap.get(item.medicineId);
    if (!medicine) {
      throw new Error(`Medicine with ID ${item.medicineId} not found`);
    }

    const mrp = Number(item.mrp ?? item.price ?? 0);
    const category = categoryMap.get(String(medicine.category || '').trim().toLowerCase());
    const gstRate = Number(category?.gstPercentage ?? 0);
    const taxBreakdown = calculateInclusiveTaxBreakdown(mrp, gstRate);
    const subtotal = item.quantity * mrp;

    return {
      medicineId: item.medicineId,
      medicineName: medicine.name,
      quantity: item.quantity,
      mrp,
      price: mrp,
      basePrice: taxBreakdown.basePrice,
      gstRate,
      gstAmount: taxBreakdown.gstAmount,
      cgstAmount: taxBreakdown.cgstAmount,
      sgstAmount: taxBreakdown.sgstAmount,
      subtotal,
    };
  });

  const grossAmount = saleItems.reduce((sum, item) => sum + item.subtotal, 0);
  const normalizedDiscountPercent = Math.min(Math.max(Number(discountPercent || 0), 0), 100);
  const discountAmount = grossAmount * (normalizedDiscountPercent / 100);
  const totalAmount = Math.max(grossAmount - discountAmount, 0);
  const cgstTotal = saleItems.reduce((sum, item) => sum + item.cgstAmount * item.quantity, 0);
  const sgstTotal = saleItems.reduce((sum, item) => sum + item.sgstAmount * item.quantity, 0);

  return {
    saleItems,
    grossAmount,
    discountPercent: normalizedDiscountPercent,
    discountAmount,
    totalAmount,
    cgstTotal,
    sgstTotal,
    medicines: medicineMap,
  };
}

async function persistSaleStockAndRecord(
  tenantId: string,
  actorUserId: string,
  payload: SalePayload,
  saleId?: string
) {
  const discountPercent = Math.min(Math.max(Number(payload.discountPercent || 0), 0), 100);
  const { saleItems, grossAmount, discountAmount, totalAmount, cgstTotal, sgstTotal, medicines } =
    await buildSaleItemSnapshots(tenantId, payload.items, discountPercent);

  const aggregatedItems = aggregateSaleItems(payload.items);
  for (const [medicineId, quantity] of aggregatedItems.entries()) {
    const medicine = medicines.get(medicineId);
    if (!medicine) {
      throw new Error(`Medicine with ID ${medicineId} not found`);
    }

    if ((medicine.quantity || 0) < quantity) {
      throw new Error(`Insufficient stock for ${medicine.name}`);
    }
  }

  if (aggregatedItems.size > 0) {
    await Medicine.bulkWrite(
      Array.from(aggregatedItems.entries()).map(([medicineId, quantity]) => ({
        updateOne: {
          filter: {
            _id: medicineId,
            $or: [{ tenantId }, { tenantId: { $exists: false } }],
          },
          update: { $inc: { quantity: -quantity } },
        },
      }))
    );
  }

  const sale = saleId
    ? await Sale.findOneAndUpdate(
        buildSaleQuery(tenantId, saleId),
        {
          $set: {
            items: saleItems,
            grossAmount,
            discountPercent,
            discountAmount,
            cgstTotal,
            sgstTotal,
            totalAmount,
            customerName: payload.customerName,
            customerPhone: payload.customerPhone,
            doctorName: payload.doctorName,
            paymentMethod: payload.paymentMethod,
            notes: payload.notes,
          },
        },
        { new: true }
      )
    : await Sale.create({
        tenantId,
        invoiceNumber: `INV-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 1000)
          .toString()
          .padStart(3, '0')}`,
        items: saleItems,
        grossAmount,
        discountPercent,
        discountAmount,
        cgstTotal,
        sgstTotal,
        totalAmount,
        customerName: payload.customerName,
        customerPhone: payload.customerPhone,
        doctorName: payload.doctorName,
        paymentMethod: payload.paymentMethod,
        staffId: actorUserId,
        notes: payload.notes,
        saleDate: new Date(),
      });

  return sale;
}

export async function createSale(
  tenantId: string,
  actorUserId: string,
  payload: SalePayload
) {
  await connectDB();

  const doctor = await Doctor.findOne({ _id: payload.doctorId, tenantId });
  if (!doctor) {
    throw new Error('Doctor not found');
  }

  const consultationFee = Number(
    payload.doctorFee ?? (doctor as any).consultationFee ?? 0
  );

  if (consultationFee < 0) {
    throw new Error('Consultation fee must be zero or greater');
  }

  const sale = await Sale.create({
    tenantId,
    invoiceNumber: `INV-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0')}`,
    saleDate: new Date(),
    items: [],
    doctorId: doctor._id,
    doctorFee: consultationFee,
    grossAmount: consultationFee,
    discountPercent: 0,
    discountAmount: 0,
    cgstTotal: 0,
    sgstTotal: 0,
    totalAmount: consultationFee,
    patientName: payload.patientName,
    patientPhone: payload.patientPhone || '',
    customerName: payload.patientName,
    customerPhone: payload.patientPhone || '',
    doctorName: payload.doctorName?.trim() || doctor.name,
    paymentMethod: payload.paymentMethod,
    staffId: actorUserId,
    notes: payload.notes,
  });

  await writeAuditLog({
    tenantId,
    actorUserId,
    module: 'billing',
    action: 'create',
    entityType: 'Sale',
    entityId: sale._id.toString(),
    after: sale.toObject(),
  });

  return sale;
}

export async function updateSale(
  tenantId: string,
  actorUserId: string,
  saleId: string,
  payload: SalePayload
) {
  await connectDB();

  const before = await Sale.findOne(buildSaleQuery(tenantId, saleId));
  if (!before) {
    return null;
  }

  const doctor = await Doctor.findOne({ _id: payload.doctorId, tenantId });
  if (!doctor) {
    throw new Error('Doctor not found');
  }

  const consultationFee = Number(
    payload.doctorFee ?? (doctor as any).consultationFee ?? 0
  );

  if (consultationFee < 0) {
    throw new Error('Consultation fee must be zero or greater');
  }

  const sale = await Sale.findOneAndUpdate(
    buildSaleQuery(tenantId, saleId),
    {
      $set: {
        items: [],
        doctorId: doctor._id,
        doctorFee: consultationFee,
        grossAmount: consultationFee,
        discountPercent: 0,
        discountAmount: 0,
        cgstTotal: 0,
        sgstTotal: 0,
        totalAmount: consultationFee,
        patientName: payload.patientName,
        patientPhone: payload.patientPhone || '',
        customerName: payload.patientName,
        customerPhone: payload.patientPhone || '',
        doctorName: payload.doctorName?.trim() || doctor.name,
        paymentMethod: payload.paymentMethod,
        notes: payload.notes,
      },
    },
    { new: true }
  );

  if (sale) {
    await writeAuditLog({
      tenantId,
      actorUserId,
      module: 'billing',
      action: 'update',
      entityType: 'Sale',
      entityId: saleId,
      before: before.toObject(),
      after: sale.toObject(),
    });
  }

  return sale;
}

export async function deleteSale(tenantId: string, actorUserId: string, saleId: string) {
  await connectDB();

  const sale = await Sale.findOne(buildSaleQuery(tenantId, saleId));
  if (!sale) {
    return null;
  }

  await Sale.deleteOne({ _id: sale._id });

  await writeAuditLog({
    tenantId,
    actorUserId,
    module: 'billing',
    action: 'delete',
    entityType: 'Sale',
    entityId: saleId,
    before: sale.toObject(),
  });

  return sale;
}

export async function linkPrescriptionToSale(
  tenantId: string,
  actorUserId: string,
  prescriptionId: string,
  saleId: string
) {
  await connectDB();

  const before = await Prescription.findOne({ _id: prescriptionId, tenantId });
  if (!before) return null;

  const sale = await Sale.findOne({ _id: saleId, tenantId });
  if (!sale) return null;

  const prescription = await Prescription.findOneAndUpdate(
    { _id: prescriptionId, tenantId },
    { $set: { linkedSaleId: saleId, status: 'linked' } },
    { new: true }
  );

  if (prescription) {
    await writeAuditLog({
      tenantId,
      actorUserId,
      module: 'clinic',
      action: 'link-sale',
      entityType: 'Prescription',
      entityId: prescriptionId,
      before: before.toObject(),
      after: prescription.toObject(),
    });
  }

  return prescription;
}

export async function analyzePrescriptions(tenantId: string) {
  await connectDB();

  const prescriptions = await Prescription.find({ tenantId });
  const doctors = await Doctor.find({ tenantId });

  const byStatus = prescriptions.reduce<Record<string, number>>((acc, prescription) => {
    acc[prescription.status] = (acc[prescription.status] || 0) + 1;
    return acc;
  }, {});

  const byDoctor = doctors
    .map((doctor) => ({
      doctorId: doctor._id.toString(),
      doctorName: doctor.name,
      prescriptions: prescriptions.filter((prescription) => prescription.doctorId.toString() === doctor._id.toString()).length,
    }))
    .sort((a, b) => b.prescriptions - a.prescriptions)
    .slice(0, 10);

  const latest = prescriptions
    .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime())
    .slice(0, 12)
    .map((prescription) => ({
      label: new Date(prescription.issuedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
      value: 1,
    }));

  return {
    totalDoctors: doctors.length,
    totalPatients: await Patient.countDocuments({ tenantId }),
    totalPrescriptions: prescriptions.length,
    linkedPrescriptions: prescriptions.filter((item) => item.status === 'linked').length,
    byStatus,
    byDoctor,
    latest,
  };
}