const mongoose = require('mongoose');

const issueSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Issue title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Student is required']
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required']
  },
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: [true, 'Department is required']
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: [true, 'Priority is required'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'resolved', 'rejected', 'closed'],
    required: [true, 'Status is required'],
    default: 'pending'
  },
  location: {
    type: String,
    trim: true,
    maxlength: [200, 'Location cannot exceed 200 characters']
  },
  images: [{
    type: String,
    trim: true
  }],
  aiSummary: {
    type: String,
    trim: true,
    maxlength: [500, 'AI summary cannot exceed 500 characters']
  },
  aiConfidence: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  estimatedResolutionTime: {
    type: Date
  },
  actualResolutionTime: {
    type: Date
  },
  resolvedAt: {
    type: Date
  },
  rejectionReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Rejection reason cannot exceed 500 characters']
  },
  studentFeedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [1000, 'Feedback comment cannot exceed 1000 characters']
    }
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }]
}, {
  timestamps: true
});

// Index for better query performance
issueSchema.index({ studentId: 1 });
issueSchema.index({ departmentId: 1 });
issueSchema.index({ categoryId: 1 });
issueSchema.index({ status: 1 });
issueSchema.index({ priority: 1 });
issueSchema.index({ createdAt: -1 });
issueSchema.index({ assignedTo: 1 });

// Virtual for issue age (time since creation)
issueSchema.virtual('age').get(function() {
  return Date.now() - this.createdAt.getTime();
});

// Virtual for resolution time
issueSchema.virtual('resolutionDuration').get(function() {
  if (this.resolvedAt && this.createdAt) {
    return this.resolvedAt.getTime() - this.createdAt.getTime();
  }
  return null;
});

// Pre-save middleware to set estimated resolution time based on priority
issueSchema.pre('save', function(next) {
  if (this.isNew && !this.estimatedResolutionTime) {
    const now = new Date();
    let hours = 24; // default 24 hours
    
    switch (this.priority) {
      case 'low':
        hours = 72; // 3 days
        break;
      case 'medium':
        hours = 24; // 1 day
        break;
      case 'high':
        hours = 8; // 8 hours
        break;
      case 'critical':
        hours = 2; // 2 hours
        break;
    }
    
    this.estimatedResolutionTime = new Date(now.getTime() + (hours * 60 * 60 * 1000));
  }
  
  // Set resolvedAt when status changes to resolved
  if (this.isModified('status') && this.status === 'resolved' && !this.resolvedAt) {
    this.resolvedAt = new Date();
    this.actualResolutionTime = this.resolvedAt;
  }
  
  next();
});

// Method to check if issue is overdue
issueSchema.methods.isOverdue = function() {
  if (this.status === 'resolved' || this.status === 'closed') {
    return false;
  }
  return Date.now() > this.estimatedResolutionTime.getTime();
};

// Method to get issue progress percentage
issueSchema.methods.getProgressPercentage = function() {
  const statusProgress = {
    'pending': 0,
    'in_progress': 50,
    'resolved': 100,
    'rejected': 0,
    'closed': 100
  };
  
  return statusProgress[this.status] || 0;
};

module.exports = mongoose.model('Issue', issueSchema);
