import { Schema, model, Document, PopulatedDoc } from 'mongoose';
import { IRetailer } from './retailer.model';

export interface IRetailerStock extends Document {
  retailer: PopulatedDoc<IRetailer & Document>;
  distributorCode: string;
  productCode: string;
  productName: string;
  skuCode: string;
  skuName: string;
  unit: string;
  unitValue: number;
  currentStock: number;
  lastReceivedDate: Date;
  lastReceivedQuantity: number;
  totalReceived: number;
  totalSold: number;
  updatedBy: string; // employeeId
}

const retailerStockSchema = new Schema<IRetailerStock>({
  retailer: { type: Schema.Types.ObjectId, ref: 'Retailer', required: true, index: true },
  distributorCode: { type: String, required: true, index: true },
  productCode: { type: String, required: true, index: true },
  productName: { type: String },
  skuCode: { type: String, index: true },
  skuName: { type: String },
  unit: { type: String },
  unitValue: { type: Number, default: 0 },
  currentStock: { type: Number, default: 0 },
  lastReceivedDate: { type: Date, default: Date.now },
  lastReceivedQuantity: { type: Number, default: 0 },
  totalReceived: { type: Number, default: 0 },
  totalSold: { type: Number, default: 0 },
  updatedBy: { type: String, required: true },
}, { timestamps: true });

retailerStockSchema.index({ retailer: 1, distributorCode: 1, skuCode: 1 }, { unique: true });

export const RetailerStock = model<IRetailerStock>('RetailerStock', retailerStockSchema);