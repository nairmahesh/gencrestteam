import { Schema, model, Document } from 'mongoose';

export interface IProduct extends Document {
 productCode: string;
 productName: string;
 sku: string;
 price: number;
 category: string;
}

const productSchema = new Schema<IProduct>({
 productCode: {
  type: String,
  required: true,
  index: true,
 },
 productName: {
  type: String,
  required: true,
 },
 sku: {
  type: String,
  required: true,
 },
 price: {
  type: Number,
  required: true,
 },
 category: {
  type: String,
  required: true,
  index: true,
 },
}, { timestamps: true });

export const Product = model<IProduct>('Product', productSchema);