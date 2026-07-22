import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
  chat: mongoose.Types.ObjectId;
  sender: mongoose.Types.ObjectId;
  text: string;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  tempId?: string;
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
      required: true,
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
  },
  {
    timestamps: true,
  }
);

// Compound index for cursor-based message pagination (by chat room and creation time)
MessageSchema.index({ chat: 1, createdAt: -1 });

export default mongoose.model<IMessage>('Message', MessageSchema);
