const mongoose = require('mongoose');

const issueLogSchema = new mongoose.Schema({
  issueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Issue',
    required: [true, 'Issue ID is required']
  },
  oldStatus: {
    type: String,
    enum: ['pending', 'in_progress', 'resolved', 'rejected', 'closed'],
    default: undefined
  },
  newStatus: {
    type: String,
    enum: ['pending', 'in_progress', 'resolved', 'rejected', 'closed'],
    required: [true, 'New status is required']
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Updated by user is required']
  },
  remarks: {
    type: String,
    trim: true,
    maxlength: [1000, 'Remarks cannot exceed 1000 characters']
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  attachments: [{
    type: String,
    trim: true
  }],
  actionType: {
    type: String,
    enum: ['status_change', 'assignment', 'remark', 'priority_change', 'escalation'],
    required: [true, 'Action type is required'],
    default: 'status_change'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Index for better query performance
issueLogSchema.index({ issueId: 1, timestamp: -1 });
issueLogSchema.index({ updatedBy: 1 });
issueLogSchema.index({ timestamp: -1 });

// Static method to get issue timeline
issueLogSchema.statics.getIssueTimeline = async function(issueId) {
  return await this.find({ issueId })
    .populate('updatedBy', 'name email role')
    .sort({ timestamp: 1 });
};

// Static method to get user activity
issueLogSchema.statics.getUserActivity = async function(userId, limit = 50) {
  return await this.find({ updatedBy: userId })
    .populate('issueId', 'title status priority')
    .sort({ timestamp: -1 })
    .limit(limit);
};

// Method to get formatted log entry
issueLogSchema.methods.toFormattedJSON = function() {
  return {
    id: this._id,
    issueId: this.issueId,
    oldStatus: this.oldStatus,
    newStatus: this.newStatus,
    updatedBy: this.updatedBy,
    remarks: this.remarks,
    timestamp: this.timestamp,
    actionType: this.actionType,
    metadata: this.metadata,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

module.exports = mongoose.model('IssueLog', issueLogSchema);
