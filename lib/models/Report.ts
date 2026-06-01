import mongoose, { Schema, Document } from 'mongoose';

export interface IReport extends Document {
  tenantId: Schema.Types.ObjectId;
  patientId: Schema.Types.ObjectId;
  doctorId?: Schema.Types.ObjectId;
  uploadedBy?: Schema.Types.ObjectId;
  fileUrl: string;
  filename?: string;
  comments: Array<{
    doctorId?: Schema.Types.ObjectId;
    comment: string;
    createdAt: Date;
  }>;
  status?: string;
}

const ReportSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', index: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    fileUrl: { type: String, required: true, trim: true },
    filename: { type: String, trim: true },
    comments: {
      type: [
        {
          doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor' },
          comment: String,
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    status: { type: String, trim: true },
  },
  { timestamps: true }
);

ReportSchema.index({ tenantId: 1, patientId: 1 });

export default mongoose.models.Report || mongoose.model<IReport>('Report', ReportSchema);
