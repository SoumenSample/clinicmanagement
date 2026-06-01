import mongoose, { Schema, Document } from 'mongoose';

export type ShelfLocationType = 'AISLE' | 'RACK' | 'SHELF' | 'BIN';

export interface IShelf extends Document {
  tenantId?: Schema.Types.ObjectId;
  code: string;
  label: string;
  locationType: ShelfLocationType;
  parentShelfId?: Schema.Types.ObjectId | null;
  capacityQty: number;
  minOccupancyPct: number;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const ShelfSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      index: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    locationType: {
      type: String,
      required: true,
      enum: ['AISLE', 'RACK', 'SHELF', 'BIN'],
      default: 'SHELF',
    },
    parentShelfId: {
      type: Schema.Types.ObjectId,
      ref: 'Shelf',
      default: null,
    },
    capacityQty: {
      type: Number,
      required: true,
      default: 0,
    },
    minOccupancyPct: {
      type: Number,
      required: true,
      default: 85,
    },
    notes: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.models.Shelf || mongoose.model<IShelf>('Shelf', ShelfSchema);