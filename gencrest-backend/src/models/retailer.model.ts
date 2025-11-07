import { Schema, model, Document, PopulatedDoc } from 'mongoose';
import { IUser } from './user.model';

export interface IRetailerLocation {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface IRetailer extends Document {
  retailerId: string; // Custom, human-readable ID (e.g., "RET001")
  name: string;
  businessName?: string;
  contactPerson?: string;
  phone: string;
  email?: string;
  address: string;
  location: IRetailerLocation;
  pincode: string;
  market: string;
  city: string;
  state: string;
  zone: string;
  region: string;
  territory: string;
  status: 'Active' | 'Inactive' | 'Blocked';
  priority: 'High' | 'Medium' | 'Low';
  assignedMDO?: PopulatedDoc<IUser & Document>;
  createdBy: PopulatedDoc<IUser & Document>;
}

const retailerSchema = new Schema<IRetailer>({
  retailerId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, index: true }, // Add index for faster search
  businessName: { type: String },
  contactPerson: { type: String },
  phone: { type: String, required: true, unique: true, index: true }, // <-- ADDED unique: true
  email: { type: String, lowercase: true, trim: true },
  address: { type: String, required: true },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere',
    },
  },
  pincode: { type: String },
  market: { type: String },
  city: { type: String, index: true },
  state: { type: String, index: true },
  zone: { type: String, index: true },
  region: { type: String, index: true },
  territory: { type: String, index: true },
  status: { type: String, enum: ['Active', 'Inactive', 'Blocked'], default: 'Active' },
  priority: { type: String, enum: ['High', 'Medium', 'Low'], default: 'Medium' },
  assignedMDO: { type: Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

export const Retailer = model<IRetailer>('Retailer', retailerSchema);