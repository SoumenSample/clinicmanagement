import mongoose, { Schema, Document } from 'mongoose';

export interface IPrescription extends Document {
  tenantId: Schema.Types.ObjectId;
  doctorId: Schema.Types.ObjectId;
  patientId: Schema.Types.ObjectId;
  prescriptionType: 'image' | 'pdf' | 'manual';
  source: 'clinic' | 'walk-in' | 'upload';
  fileUrl?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  previousHistory?: string;
  investigationsGiven?: string;
  medicinesGiven?: string;
  rawText?: string;
  status: 'draft' | 'reviewed' | 'linked' | 'closed';
  linkedSaleId?: Schema.Types.ObjectId;
  suggestedMedicines: string[];
  notes?: string;
  issuedAt: Date;
  expiryAt?: Date;
}

const PrescriptionSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
      index: true,
    },
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    prescriptionType: {
      type: String,
      enum: ['image', 'pdf', 'manual'],
      required: true,
    },
    source: {
      type: String,
      enum: ['clinic', 'walk-in', 'upload'],
      default: 'walk-in',
    },
    fileUrl: String,
    fileName: String,
    mimeType: String,
    fileSize: Number,
    previousHistory: String,
    investigationsGiven: String,
    medicinesGiven: String,
    rawText: String,
    status: {
      type: String,
      enum: ['draft', 'reviewed', 'linked', 'closed'],
      default: 'draft',
    },
    linkedSaleId: {
      type: Schema.Types.ObjectId,
      ref: 'Sale',
      default: null,
    },
    suggestedMedicines: {
      type: [String],
      default: [],
    },
    notes: String,
    issuedAt: {
      type: Date,
      default: Date.now,
    },
    expiryAt: Date,
  },
  { timestamps: true }
);

PrescriptionSchema.index({ tenantId: 1, doctorId: 1, issuedAt: -1 });
PrescriptionSchema.index({ tenantId: 1, patientId: 1, issuedAt: -1 });

if (process.env.NODE_ENV !== 'production' && mongoose.models.Prescription) {
  delete mongoose.models.Prescription;
}

export default mongoose.models.Prescription || mongoose.model<IPrescription>('Prescription', PrescriptionSchema);