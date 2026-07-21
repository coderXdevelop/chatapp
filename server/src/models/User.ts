import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  email: string;
  password?: string;
  displayName: string;
  age?: number | undefined;
  avatarUrl?: string;
  avatarPublicId?: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    password: {
      type: String,
      select: false,
    },
    displayName: {
      type: String,
      default: 'ChatConnect User',
      trim: true,
    },
    age: {
      type: Number,
    },
    avatarUrl: {
      type: String,
      default: '',
    },
    avatarPublicId: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      default: 'Hey there! I am using ChatConnect.',
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IUser>('User', UserSchema);
