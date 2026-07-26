import mongoose, { Document, Schema } from 'mongoose';

export interface IReaction {
  user: mongoose.Types.ObjectId;
  emoji: string;
}

export interface ILinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  domain?: string;
}

export interface IMessage extends Document {
  chat: mongoose.Types.ObjectId;
  sender: mongoose.Types.ObjectId;
  text?: string;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  tempId?: string;
  mediaUrl?: string;
  mediaPublicId?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'document' | 'gif' | 'sticker';
  mediaDuration?: number;
  mediaSize?: number;
  mediaWidth?: number;
  mediaHeight?: number;
  reactions?: IReaction[];
  linkPreview?: ILinkPreview;
  isEdited?: boolean;
  isDeleted?: boolean;
  replyTo?: mongoose.Types.ObjectId | null;
  isForwarded?: boolean;
  deletedForUsers?: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const ReactionSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    emoji: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const LinkPreviewSchema = new Schema(
  {
    url: { type: String, required: true },
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    image: { type: String, default: '' },
    domain: { type: String, default: '' },
  },
  { _id: false }
);

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
    mediaPublicId: {
      type: String,
      default: null,
    },
    mediaType: {
      type: String,
      enum: ['image', 'video', 'audio', 'document', 'gif', 'sticker', null],
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
    reactions: {
      type: [ReactionSchema],
      default: [],
    },
    linkPreview: {
      type: LinkPreviewSchema,
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
