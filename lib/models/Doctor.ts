import mongoose, { Schema, Document } from 'mongoose';

export interface IDoctor extends Document {
  tenantId: Schema.Types.ObjectId;
  userId?: Schema.Types.ObjectId;
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
}

const DoctorSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      sparse: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    specialization: {
      type: String,
      required: true,
      trim: true,
    },
    consultationFee: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    degree: {
      type: String,
      trim: true,
    },
    clinicName: {
      type: String,
      trim: true,
    },
    clinicAddress: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    registrationNumber: {
      type: String,
      trim: true,
    },
    notes: String,
    availableDays: {
      type: [String],
      default: [],
    },
    availabilityNotes: {
      type: String,
      trim: true,
    },
    availabilitySlotMinutes: {
      type: Number,
      enum: [5, 10, 15, 30],
      default: 15,
    },
    availabilityWindows: {
      type: [
        {
          title: { type: String, trim: true },
          daysOfWeek: { type: [String], default: [] },
          startDate: { type: String, trim: true },
          endDate: { type: String, trim: true },
          startTime: { type: String, trim: true },
          endTime: { type: String, trim: true },
          note: { type: String, trim: true },
        },
      ],
      default: [],
    },
    availabilityExceptions: {
      type: [
        {
          date: { type: String, trim: true },
          reason: { type: String, trim: true },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

DoctorSchema.index({ tenantId: 1, name: 1 });
DoctorSchema.index({ tenantId: 1, specialization: 1 });

if (process.env.NODE_ENV !== 'production' && mongoose.models.Doctor) {
  delete mongoose.models.Doctor;
}

export default mongoose.models.Doctor || mongoose.model<IDoctor>('Doctor', DoctorSchema);