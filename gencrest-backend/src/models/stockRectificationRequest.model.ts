import { Schema, model, Document, PopulatedDoc } from 'mongoose';
import { IRetailer } from './retailer.model';
import { IUser } from './user.model';

export interface IStockRectificationRequest extends Document {
  retailer: PopulatedDoc<IRetailer & Document>;
  requestedBy: PopulatedDoc<IUser & Document>;
  productName: string;
  skuCode: string;
  skuName: string;
  unit: string;
  currentStockUnits: number;
  adjustmentType: 'increase' | 'decrease';
  adjustmentUnits: number;
  newStockUnits: number;
  reason: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: PopulatedDoc<IUser & Document>;
  rejectionReason?: string;
  processedAt?: Date;
}

const stockRectificationRequestSchema = new Schema<IStockRectificationRequest>({
  retailer: { type: Schema.Types.ObjectId, ref: 'Retailer', required: true, index: true },
  requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  productName: { type: String, required: true },
  skuCode: { type: String, required: true, index: true },
  skuName: { type: String },
  unit: { type: String },
  currentStockUnits: { type: Number, required: true },
  adjustmentType: { type: String, enum: ['increase', 'decrease'], required: true },
  adjustmentUnits: { type: Number, required: true },
  newStockUnits: { type: Number, required: true },
  reason: { type: String, required: true },
  notes: { type: String },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  rejectionReason: { type: String },
  processedAt: { type: Date },
}, { timestamps: true });

export const StockRectificationRequest = model<IStockRectificationRequest>(
  'StockRectificationRequest',
  stockRectificationRequestSchema
);