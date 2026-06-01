import mongoose, { Schema, Document } from 'mongoose';

export type AppointmentStatus = 'booked' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
export type AppointmentSource = 'patient' | 'staff' | 'doctor' | 'admin';

export interface IAppointment extends Document {
  tenantId: Schema.Types.ObjectId;
  patientId: Schema.Types.ObjectId;
  doctorId: Schema.Types.ObjectId;
  bookedByUserId?: Schema.Types.ObjectId;
  bookedByRole?: string;
  appointmentDate: string;
  timeSlot: string;
  reason?: string;
  notes?: string;
  status: AppointmentStatus;
  source: AppointmentSource;
}

const AppointmentSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
      index: true,
    },
    bookedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    bookedByRole: {
      type: String,
      trim: true,
    },
    appointmentDate: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    timeSlot: {
      type: String,
      required: true,
      trim: true,
    },
    reason: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['booked', 'confirmed', 'cancelled', 'completed', 'no_show'],
      default: 'booked',
      index: true,
    },
    source: {
      type: String,
      enum: ['patient', 'staff', 'doctor', 'admin'],
      default: 'patient',
      index: true,
    },
  },
  { timestamps: true }
);

AppointmentSchema.index({ tenantId: 1, doctorId: 1, appointmentDate: 1, timeSlot: 1, status: 1 });
AppointmentSchema.index({ tenantId: 1, patientId: 1, appointmentDate: 1, timeSlot: 1 });

if (process.env.NODE_ENV !== 'production' && mongoose.models.Appointment) {
  delete mongoose.models.Appointment;
}

export default mongoose.models.Appointment || mongoose.model<IAppointment>('Appointment', AppointmentSchema);