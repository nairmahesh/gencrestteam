import { Schema, model, Document } from 'mongoose';

export interface IDistributorStock extends Document {
 distributorCode: string;
 productCode: string;
 productPrice: string;
 openingStock: { value: number; amount: number };
 balanceStock: { value: number; amount: number };
 liquidationStock: { value: number; amount: number };
 ytdNetSales:  { value: number; amount: number };
}

const distributorStockSchema = new Schema<IDistributorStock>({
 distributorCode: { type: String, required: true, index: true },
 productCode: { type: String, required: true, index: true },
 productPrice: { type: String, required: true },
 openingStock: { value: { type: Number, required: true }, amount: { type: Number, required: true } },
 balanceStock: { value: { type: Number, required: true }, amount: { type: Number, required: true } },
 liquidationStock: { value: { type: Number, required: true }, amount: { type: Number, required: true } },
 ytdNetSales: { value: { type: Number, required: true }, amount: { type: Number, required: true } },
}, { timestamps: true });

export const DistributorStock = model<IDistributorStock>('DistributorStock', distributorStockSchema);