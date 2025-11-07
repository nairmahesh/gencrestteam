import { Schema, model, Document, PopulatedDoc } from 'mongoose';
import bcrypt from 'bcryptjs';

// --- Interface for your requested fields ---
export interface IUser extends Document {
  firstName: string;
  lastName: string;
  employeeId: string;
  email: string;
  phone: string;
  dateOfJoining?: Date;
  isActive: boolean;
  reportingTo?: PopulatedDoc<IUser & Document>;
  zone?: string;
  location?: string;
  territory?: string;
  state?: string;
  region?: string;
  role: string;
  password?: string;
  isPasswordSet: boolean;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  employeeId: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true, unique: true },
  dateOfJoining: { type: Date },
  isActive: { type: Boolean, default: true },
  reportingTo: { type: Schema.Types.ObjectId, ref: 'User' },
  zone: { type: String },
  location: { type: String },
  territory: { type: String },
  state: { type: String },
  region: { type: String },
  role: { type: String, required: true },
  
  password: {
    type: String,
    select: false,
  },
  isPasswordSet: {
    type: Boolean,
    default: false,
  },
  passwordResetToken: { type: String, select: false },
  passwordResetExpires: { type: Date, select: false },
}, {
  timestamps: true,
  methods: {
    async comparePassword(candidatePassword: string): Promise<boolean> {
      return bcrypt.compare(candidatePassword, this.password!);
    },
  },
});

userSchema.pre<IUser>('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password!, salt);
  next();
});

export const User = model<IUser>('User', userSchema);