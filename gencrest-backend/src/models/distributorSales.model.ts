import { Schema, model, Document } from 'mongoose';

export interface IDistributorSales extends Document {
 distributorCode: string;
 productCode: string;
 productPrice: number;
 saleQuantity: number;
 saleAmount: number;
 invoiceDate: Date;
 invoiceNumber: string;
}

const distributorSalesSchema = new Schema<IDistributorSales>({
 distributorCode: { type: String, required: true, index: true },
 productCode: { type: String, required: true, index: true },
 productPrice: { type: Number, required: true },
 saleQuantity: { type: Number, required: true },
 saleAmount: { type: Number, required: true },
 invoiceDate: { type: Date, required: true, index: true },
 invoiceNumber: { type: String, required: true, index: true },
}, { timestamps: true });

export const DistributorSales = model<IDistributorSales>('DistributorSales', distributorSalesSchema);