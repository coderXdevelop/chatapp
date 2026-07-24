import mongoose, { Document, Schema } from 'mongoose';

export interface IReport extends Document {
  reporter: mongoose.Types.ObjectId;
  reportedUser?: mongoose.Types.ObjectId;
  reportedChat?: mongoose.Types.ObjectId;
  reason: string;
  category: 'spam' | 'abuse' | 'harassment' | 'inappropriate_content' | 'other';
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: Date;
  updatedAt: Date;
}

const ReportSchema: Schema = new Schema(
  {
    reporter: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reportedUser: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    reportedChat: {
      type: Schema.Types.ObjectId,
      ref: 'Chat',
      index: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    category: {
      type: String,
      enum: ['spam', 'abuse', 'harassment', 'inappropriate_content', 'other'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'resolved', 'dismissed'],
      default: 'pending',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IReport>('Report', ReportSchema);
