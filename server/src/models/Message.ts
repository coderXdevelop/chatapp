import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
  chat: mongoose.Types.ObjectId;
  sender: mongoose.Types.ObjectId;
  text?: string;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  tempId?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'document';
  mediaDuration?: number;
  mediaSize?: number;
  mediaWidth?: number;
  mediaHeight?: number;
  isEdited?: boolean;
  isDeleted?: boolean;
  replyTo?: mongoose.Types.ObjectId | null;
  isForwarded?: boolean;
  deletedForUsers?: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema: Schema = new Schema(
  {
    chat: {
      type: Schema.Types.ObjectId,
      ref: 'Chat',
      required: true,
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      required: false,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['sending', 'sent', 'delivered', 'read'],
      default: 'sent',
    },
    tempId: {
      type: String,
    },
    mediaUrl: {
      type: String,
      default: null,
    },
    mediaType: {
      type: String,
      enum: ['image', 'video', 'audio', 'document', null],
      default: null,
    },
    mediaDuration: {
      type: Number,
      default: null,
    },
    mediaSize: {
      type: Number,
      default: null,
    },
    mediaWidth: {
      type: Number,
      default: null,
    },
    mediaHeight: {
      type: Number,
      default: null,
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    replyTo: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    isForwarded: {
      type: Boolean,
      default: false,
    },
    deletedForUsers: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for cursor-based message pagination (by chat room and creation time)
MessageSchema.index({ chat: 1, createdAt: -1 });

export default mongoose.model<IMessage>('Message', MessageSchema);
