import mongoose, { Document, Schema } from 'mongoose';

export interface ICategory extends Document {
  tenantId?: Schema.Types.ObjectId;
  name: string;
  gstPercentage: number;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    gstPercentage: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
  },
  { timestamps: true }
);

CategorySchema.index({ tenantId: 1, name: 1 }, { unique: true });

export default mongoose.models.Category || mongoose.model<ICategory>('Category', CategorySchema);
