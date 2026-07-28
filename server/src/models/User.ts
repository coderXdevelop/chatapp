import mongoose, { Document, Schema } from 'mongoose';

export interface IStatusPrivacy {
  type: 'contacts' | 'except' | 'only';
  excludedUsers: mongoose.Types.ObjectId[];
  includedUsers: mongoose.Types.ObjectId[];
}

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
  notificationsEnabled: boolean;
  mutedChats: mongoose.Types.ObjectId[];
  statusPrivacy: IStatusPrivacy;
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
    notificationsEnabled: {
      type: Boolean,
      default: true,
    },
    mutedChats: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Chat',
      },
    ],
    statusPrivacy: {
      type: {
        type: String,
        enum: ['contacts', 'except', 'only'],
        default: 'contacts',
      },
      excludedUsers: [
        {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
      includedUsers: [
        {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
    },
  },
  {
    timestamps: true,
  }
);

UserSchema.index({ blockedUsers: 1 });

export default mongoose.model<IUser>('User', UserSchema);

