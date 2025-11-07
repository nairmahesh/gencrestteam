import { Schema, model, Document } from 'mongoose';

export interface IDistributor extends Document {
 dateCreated: Date;
 isActive: boolean;
 distributorCode: string;
 name: string;
 companyName: string;
 category: string;
 vertical: string;
 territory: string;
 city: string;
 region: string;
 zone: string;
 state: string;
 address:string;
 pincode: string;
}

const distributorSchema = new Schema<IDistributor>({
 dateCreated: { type: Date, default: Date.now },
 isActive: { type: Boolean, default: true },
 distributorCode: { type: String, required: true },
 name: { type: String, required: true },
 companyName: { type: String, required: true },
 category: { type: String, required: true },
 vertical: { type: String, required: true },
 territory: { type: String, required: true },
 city: { type: String, required: true },
 region: { type: String, required: true },
 zone: { type: String, required: true },
 state: { type: String, required: true },
 address: { type: String, required: true },
 pincode: { type: String, required: true },
}, { timestamps: true });

export const Distributor = model<IDistributor>('Distributor', distributorSchema);