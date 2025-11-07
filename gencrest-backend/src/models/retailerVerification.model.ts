import { Schema, model, Document, PopulatedDoc } from 'mongoose';
import { IRetailer } from './retailer.model';
import { IUser } from './user.model';

interface ISkuVerification {
  productCode: string;
  skuCode: string;
  skuName: string;
  expectedStock: number;
  actualStock: number;
  variance: number;
}

export interface IRetailerVerification extends Document {
  retailer: PopulatedDoc<IRetailer & Document>;
  verifiedBy: PopulatedDoc<IUser & Document>;
  verificationDate: Date;
  skusChecked: ISkuVerification[];
  totalSkusCount: number;
  proofType: 'Photo' | 'E-Signature' | 'Photo + E-Signature';
  proofUrls: string[];
  signatureUrl?: string;
  notes?: string;
  location?: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
}

const retailerVerificationSchema = new Schema<IRetailerVerification>({
  retailer: { type: Schema.Types.ObjectId, ref: 'Retailer', required: true, index: true },
  verifiedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  verificationDate: { type: Date, default: Date.now, index: true },
  skusChecked: [{
    productCode: { type: String },
    skuCode: { type: String },
    skuName: { type: String },
    expectedStock: { type: Number },
    actualStock: { type: Number },
    variance: { type: Number },
  }],
  totalSkusCount: { type: Number, required: true },
  proofType: { type: String, enum: ['Photo', 'E-Signature', 'Photo + E-Signature'], required: true },
  proofUrls: [{ type: String }],
  signatureUrl: { type: String },
  notes: { type: String },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number] }, // [longitude, latitude]
  },
}, { timestamps: true });

export const RetailerVerification = model<IRetailerVerification>(
  'RetailerVerification',
  retailerVerificationSchema
);