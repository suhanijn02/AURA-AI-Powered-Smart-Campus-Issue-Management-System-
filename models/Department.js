const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Department name is required'],
    trim: true,
    unique: true,
    maxlength: [100, 'Department name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  sla_hours: {
    type: Number,
    required: [true, 'SLA hours is required'],
    min: [1, 'SLA hours must be at least 1 hour'],
    max: [168, 'SLA hours cannot exceed 168 hours (1 week)']
  },
  email: {
    type: String,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    trim: true
  },
  location: {
    type: String,
    trim: true,
    maxlength: [200, 'Location cannot exceed 200 characters']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  headOfDepartment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for better query performance
departmentSchema.index({ name: 1 });
departmentSchema.index({ isActive: 1 });

// Virtual for department statistics
departmentSchema.virtual('stats', {
  ref: 'Issue',
  localField: '_id',
  foreignField: 'departmentId',
  count: true
});

// Method to get department performance metrics
departmentSchema.methods.getPerformanceMetrics = async function() {
  const Issue = mongoose.model('Issue');
  
  const totalIssues = await Issue.countDocuments({ departmentId: this._id });
  const resolvedIssues = await Issue.countDocuments({ 
    departmentId: this._id, 
    status: 'resolved' 
  });
  const pendingIssues = await Issue.countDocuments({ 
    departmentId: this._id, 
    status: { $in: ['pending', 'in_progress'] } 
  });
  
  const avgResolutionTime = await Issue.aggregate([
    { $match: { departmentId: this._id, status: 'resolved' } },
    { $project: {
      resolutionTime: { $subtract: ['$resolvedAt', '$createdAt'] }
    }},
    { $group: {
      _id: null,
      avgTime: { $avg: '$resolutionTime' }
    }}
  ]);

  return {
    totalIssues,
    resolvedIssues,
    pendingIssues,
    resolutionRate: totalIssues > 0 ? (resolvedIssues / totalIssues) * 100 : 0,
    avgResolutionTime: avgResolutionTime.length > 0 ? avgResolutionTime[0].avgTime : 0
  };
};

module.exports = mongoose.model('Department', departmentSchema);
