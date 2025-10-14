//backend/models/CallHistory.js

import mongoose from 'mongoose';

const callHistorySchema = new mongoose.Schema({
  caller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['audio', 'video'],
    required: true
  },
  status: {
    type: String,
    enum: ['missed', 'answered', 'rejected', 'cancelled'],
    default: 'missed'
  },
  duration: {
    type: Number,
    default: 0 // in seconds
  }
}, {
  timestamps: true
});

// Index for faster queries
callHistorySchema.index({ receiver: 1, status: 1, createdAt: -1 });
callHistorySchema.index({ caller: 1, createdAt: -1 });

export default mongoose.model('CallHistory', callHistorySchema);