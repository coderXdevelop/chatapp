import mongoose, { Document, Schema } from 'mongoose';

export interface IChat extends Document {
  participants: mongoose.Types.ObjectId[];
  lastMessage?: mongoose.Types.ObjectId;
  unreadCounts: Map<string, number>;
  isGroup: boolean;
  name: string;
  avatarUrl: string;
  avatarPublicId: string;
  creator?: mongoose.Types.ObjectId;
  admins: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const ChatSchema: Schema = new Schema(
  {
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
    },
    unreadCounts: {
      type: Map,
      of: Number,
      default: new Map(),
    },
    isGroup: {
      type: Boolean,
      default: false,
    },
    name: {
      type: String,
      trim: true,
      default: '',
    },
    avatarUrl: {
      type: String,
      default: '',
    },
    avatarPublicId: {
      type: String,
      default: '',
    },
    creator: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    admins: [
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

// Index participants array for faster lookups when querying a user's chats
ChatSchema.index({ participants: 1 });
ChatSchema.index({ participants: 1, isGroup: 1 });
ChatSchema.index({ updatedAt: -1 });

export default mongoose.model<IChat>('Chat', ChatSchema);

