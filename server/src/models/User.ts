import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  email: string;
  password?: string;
  displayName: string;
  connectId: string;
  age?: number | undefined;
  avatarUrl?: string;
  avatarPublicId?: string;
  status: string;
  pushToken?: string;
  lastSeen?: Date;
  blockedUsers: mongoose.Types.ObjectId[];
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
    connectId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
      index: true,
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
    pushToken: {
      type: String,
      default: '',
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    blockedUsers: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
  }
);

UserSchema.index({ blockedUsers: 1 });

export default mongoose.model<IUser>('User', UserSchema);

