import mongoose, { Document, Schema } from 'mongoose';

export interface IStatus extends Document {
  user: mongoose.Types.ObjectId;
  text?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  caption?: string;
  backgroundColor?: string;
  createdAt: Date;
  updatedAt: Date;
}

const StatusSchema: Schema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    text: {
      type: String,
      default: '',
    },
    mediaUrl: {
      type: String,
      default: null,
    },
    mediaType: {
      type: String,
      enum: ['image', 'video', null],
      default: null,
    },
    caption: {
      type: String,
      default: '',
    },
    backgroundColor: {
      type: String,
      default: '#0F172A',
    },
  },
  {
    timestamps: true,
  }
);

// TTL index: Status documents automatically expire 24 hours (86400 seconds) after creation
StatusSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

export default mongoose.model<IStatus>('Status', StatusSchema);
