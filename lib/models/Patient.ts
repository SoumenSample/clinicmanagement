import mongoose, { Schema, Document } from 'mongoose';

export interface IPatient extends Document {
  tenantId: Schema.Types.ObjectId;
  userId?: Schema.Types.ObjectId;
  name: string;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  phone?: string;
  email?: string;
  address?: string;
  allergies: string[];
  historySummary?: string;
  lastVisitAt?: Date;
  doctorId?: Schema.Types.ObjectId;
  doctorIds?: Schema.Types.ObjectId[];
}

const PatientSchema = new Schema(
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
    age: {
      type: Number,
      min: 0,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
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
    address: {
      type: String,
      trim: true,
    },
    allergies: {
      type: [String],
      default: [],
    },
    historySummary: {
      type: String,
      trim: true,
    },
    lastVisitAt: Date,
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: 'Doctor',
      index: true,
    },
    doctorIds: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: 'Doctor',
        },
      ],
      default: [],
      index: true,
    },
  },
  { timestamps: true }
);

PatientSchema.index({ tenantId: 1, phone: 1 });
PatientSchema.index({ tenantId: 1, name: 1 });

export default mongoose.models.Patient || mongoose.model<IPatient>('Patient', PatientSchema);