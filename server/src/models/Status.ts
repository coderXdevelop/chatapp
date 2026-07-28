import mongoose, { Document, Schema } from 'mongoose';

export interface IStatusView {
  user: mongoose.Types.ObjectId;
  reaction?: string | null;
  viewedAt: Date;
}

export interface IStatus extends Document {
  user: mongoose.Types.ObjectId;
  text?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  caption?: string;
  backgroundColor?: string;
  views: IStatusView[];
  allowedUsers?: mongoose.Types.ObjectId[] | null;
  createdAt: Date;
  updatedAt: Date;
}

const StatusViewSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reaction: {
      type: String,
      default: null,
    },
    viewedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

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
    views: {
      type: [StatusViewSchema],
      default: [],
    },
    allowedUsers: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      default: null, // null means standard contacts access
    },
  },
  {
    timestamps: true,
  }
);

// TTL index: Status documents automatically expire 24 hours (86400 seconds) after creation
StatusSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

export default mongoose.model<IStatus>('Status', StatusSchema);
