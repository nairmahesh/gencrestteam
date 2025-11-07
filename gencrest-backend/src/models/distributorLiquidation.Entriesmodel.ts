import { Schema, model, Document } from "mongoose";

export interface IDistributorLiquidationEntries extends Document {
  distributorCode: string;
  productEntries: {
    productCode: string;
    productPrice: number;
    openingStock: { value: number; amount: number };
    balanceStock: { value: number; amount: number };
    soldToFarmer?: { value: number; amount: number };
    soldToRetailer?: { value: number; amount: number };
    retailerDetails?: { retailerId?: string; quantity?: number };
  }[];
  entryDate: Date;
  enteredBy: string;
  signatureUrl?: string;
  photoUrls?: string[];
  approvalStatus?:'pending' | 'approved' | 'rejected';
  rejectedReason?: string;
  rejectedBy?: string;
  approvedBy?: string;
  metadata?: {
    location?: { longitude?: number; latitude?: number };
    timeStamp?: Date;
    device?: string;
    ip?: string;
    browser?: string;
    os?: string;
    name?: string;
    source?: string;
  };
}

const distributorLiquidationEntriesSchema = new Schema<IDistributorLiquidationEntries>(
  {
    distributorCode: { type: String, required: true, index: true },
    productEntries: [
      {
        productCode: { type: String, required: true, index: true },
        productPrice: { type: Number, required: true },
        openingStock: {
          value: { type: Number, required: true },
          amount: { type: Number, required: true },
        },
        balanceStock: {
          value: { type: Number, required: true },
          amount: { type: Number, required: true },
        },
        soldToFarmer: {
          value: { type: Number, default: 0 },
          amount: { type: Number, default: 0 },
        },
        soldToRetailer: {
          value: { type: Number, default: 0 },
          amount: { type: Number, default: 0 },
        },
        retailerDetails: {
          retailerId: { type: String },
          quantity: { type: Number, default: 0 },
        },
      },
    ],
    entryDate: { type: Date, required: true, index: true },
    enteredBy: { type: String, required: true },
    signatureUrl: { type: String },
    photoUrls: [{ type: String }],
    approvalStatus: { type: String, default: 'pending' },
    rejectedReason: { type: String },
    rejectedBy: { type: String },
    approvedBy: { type: String },
    metadata: {
      location: {
        longitude: { type: Number },
        latitude: { type: Number },
      },
      timeStamp: { type: Date, default: Date.now },
      device: { type: String },
      ip: { type: String },
      browser: { type: String },
      os: { type: String },
      name: { type: String },
      source: { type: String },
    },
  },
  { timestamps: true }
);

export const DistributorLiquidationEntries = model<IDistributorLiquidationEntries>(
  "DistributorLiquidationEntries",
  distributorLiquidationEntriesSchema
);
