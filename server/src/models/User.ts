import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  email: string;
  displayName: string;
  avatarUrl?: string;
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
    displayName: {
      type: String,
      default: 'ChatConnect User',
      trim: true,
    },
    avatarUrl: {
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
