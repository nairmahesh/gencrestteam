import { Schema, model, Document, PopulatedDoc } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  firstName: string;
  lastName: string;
  employeeId: string;
  email?: string;
  phone?: string;
  dateOfJoining?: Date;
  isActive: boolean;
  reportingTo?: PopulatedDoc<IUser & Document>;
  zone?: string;
  location?: string;
  territory?: string;
  state?: string;
  region?: string;
  role: string;

  // --- Auth Fields ---
  password?: string;
  isPasswordSet: boolean;
  passwordResetToken?: string;
  passwordResetExpires?: Date;

  // --- Methods ---
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  // 'unique: true' automatically creates an index
  employeeId: { type: String, required: true, unique: true, index: true },
  email: { type: String, lowercase: true, trim: true, index: true },
  phone: { type: String},
  dateOfJoining: { type: Date },
  isActive: { type: Boolean, default: true },
  reportingTo: { type: Schema.Types.ObjectId, ref: 'User' },

  // --- Added indexes as requested ---
  zone: { type: String, index: true },
  location: { type: String, index: true },
  territory: { type: String, index: true },
  state: { type: String, index: true },
  region: { type: String, index: true },
  role: { type: String, required: true, index: true },
  
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

// --- Hash password before saving ---
userSchema.pre<IUser>('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password!, salt);
  next();
});

export const User = model<IUser>('User', userSchema);