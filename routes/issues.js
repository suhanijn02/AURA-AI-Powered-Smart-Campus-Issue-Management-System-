const express = require('express');
const multer = require('multer');
const path = require('path');
const Issue = require('../models/Issue');
const IssueLog = require('../models/IssueLog');
const Category = require('../models/Category');
const Department = require('../models/Department');
const { authenticateToken, authorizeRoles, canAccessIssue } = require('../middleware/auth');
const { validateIssueCreation, validateIssueUpdate, validateFeedback } = require('../middleware/validation');
const aiService = require('../services/aiService');
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'issue-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880 // 5MB default
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Create new issue
router.post('/', authenticateToken, upload.array('images', 5), validateIssueCreation, async (req, res) => {
  try {
    const { title, description, location, priority, categoryId, departmentId } = req.body;

    const selectedCategory = await Category.findById(categoryId).populate('departmentId');
    if (!selectedCategory) {
      return res.status(400).json({ message: 'Selected category was not found' });
    }

    const selectedDepartment = await Department.findById(departmentId);
    if (!selectedDepartment) {
      return res.status(400).json({ message: 'Selected department was not found' });
    }

    const selectedCategoryDepartmentId =
      typeof selectedCategory.departmentId === 'object'
        ? selectedCategory.departmentId?._id?.toString()
        : selectedCategory.departmentId?.toString();

    if (selectedCategoryDepartmentId !== selectedDepartment._id.toString()) {
      return res.status(400).json({ message: 'Selected category does not belong to the chosen department' });
    }
    
    // AI Classification
    let classification;
    try {
      classification = await aiService.classifyIssue(title, description);
    } catch (error) {
      console.log('AI classification failed, using fallback:', error.message);
      // Fallback classification
      classification = {
        category: selectedCategory,
        department: selectedDepartment,
        priority: priority || 'medium',
        confidence: 50,
        summary: `${title}: ${description.substring(0, 100)}...`,
        method: 'fallback'
      };
    }

    const resolvedCategory = classification?.category || selectedCategory;
    const resolvedDepartment = classification?.department || selectedDepartment;
    const resolvedPriority = priority || classification?.priority || 'medium';
    const resolvedSummary = classification?.summary || `${title}: ${description.substring(0, 100)}...`;
    const resolvedConfidence = classification?.confidence ?? 50;
    
    // Create issue with AI classification
    const issue = new Issue({
      title,
      description,
      location,
      priority: resolvedPriority,
      studentId: req.user._id,
      categoryId: resolvedCategory._id,
      departmentId: resolvedDepartment._id,
      aiSummary: resolvedSummary,
      aiConfidence: resolvedConfidence,
      images: req.files ? req.files.map(file => `/uploads/${file.filename}`) : []
    });

    await issue.save();
    
    // Populate related data for response
    await issue.populate([
      { path: 'studentId', select: 'name email' },
      { path: 'categoryId', select: 'name color icon' },
      { path: 'departmentId', select: 'name' }
    ]);

    // Create initial log entry
    const log = new IssueLog({
      issueId: issue._id,
      newStatus: 'pending',
      updatedBy: req.user._id,
      remarks: 'Issue created',
      actionType: 'status_change',
      metadata: {
        aiClassification: {
          method: classification?.method || 'manual_selection',
          confidence: resolvedConfidence
        }
      }
    });
    await log.save();

    // Emit real-time notification
    const io = req.app.get('io');
    if (io) {
      io.emit('new_issue', {
        issue: issue.toObject(),
        departmentId: issue.departmentId._id
      });
    }

    res.status(201).json({
      message: 'Issue created successfully',
      issue,
      classification: {
        ...classification,
        category: resolvedCategory,
        department: resolvedDepartment,
        priority: resolvedPriority,
        confidence: resolvedConfidence,
        summary: resolvedSummary,
      }
    });

  } catch (error) {
    console.error('Issue creation error:', error);
    res.status(500).json({ 
      message: 'Failed to create issue', 
      error: error.message 
    });
  }
});

// Get issues (filtered by user role)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      status, 
      priority, 
      departmentId, 
      categoryId,
      page = 1, 
      limit = 10,
      search 
    } = req.query;

    let query = {};
    
    // Filter based on user role
    if (req.user.role === 'student') {
      query.studentId = req.user._id;
    } else if (req.user.role === 'department_staff') {
      query.departmentId = req.user.departmentId;
    }
    // Admin can see all issues

    // Apply filters
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (departmentId) query.departmentId = departmentId;
    if (categoryId) query.categoryId = categoryId;
    
    // Search functionality
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    
    const issues = await Issue.find(query)
      .populate('studentId', 'name email')
      .populate('categoryId', 'name color icon')
      .populate('departmentId', 'name')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Issue.countDocuments(query);

    res.json({
      issues,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get issues error:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve issues', 
      error: error.message 
    });
  }
});

// Get single issue
router.get('/:id', authenticateToken, canAccessIssue, async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id)
      .populate('studentId', 'name email')
      .populate('categoryId', 'name color icon')
      .populate('departmentId', 'name')
      .populate('assignedTo', 'name email');

    if (!issue) {
      return res.status(404).json({ message: 'Issue not found' });
    }

    // Get issue timeline
    const timeline = await IssueLog.getIssueTimeline(issue._id);

    res.json({
      issue,
      timeline
    });

  } catch (error) {
    console.error('Get issue error:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve issue', 
      error: error.message 
    });
  }
});

// Update issue
router.put('/:id', authenticateToken, canAccessIssue, validateIssueUpdate, async (req, res) => {
  try {
    const { status, priority, assignedTo, remarks, rejectionReason } = req.body;
    
    const issue = await Issue.findById(req.params.id);
    if (!issue) {
      return res.status(404).json({ message: 'Issue not found' });
    }

    const oldStatus = issue.status;
    let actionType = 'status_change';

    // Update issue fields
    if (status && status !== oldStatus) {
      issue.status = status;
      
      if (status === 'rejected' && rejectionReason) {
        issue.rejectionReason = rejectionReason;
      }
    }

    if (priority) issue.priority = priority;
    
    if (assignedTo) {
      issue.assignedTo = assignedTo;
      actionType = 'assignment';
    }

    await issue.save();

    // Create log entry
    const log = new IssueLog({
      issueId: issue._id,
      oldStatus: oldStatus !== issue.status ? oldStatus : null,
      newStatus: issue.status,
      updatedBy: req.user._id,
      remarks: remarks || (status !== oldStatus ? `Status changed from ${oldStatus} to ${status}` : ''),
      actionType,
      metadata: {
        priority: issue.priority,
        assignedTo: issue.assignedTo
      }
    });
    await log.save();

    // Populate updated data
    await issue.populate([
      { path: 'studentId', select: 'name email' },
      { path: 'categoryId', select: 'name color icon' },
      { path: 'departmentId', select: 'name' },
      { path: 'assignedTo', select: 'name email' }
    ]);

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.emit('issue_updated', {
        issue: issue.toObject(),
        updatedBy: req.user._id,
        departmentId: issue.departmentId._id
      });
    }

    res.json({
      message: 'Issue updated successfully',
      issue
    });

  } catch (error) {
    console.error('Issue update error:', error);
    res.status(500).json({ 
      message: 'Failed to update issue', 
      error: error.message 
    });
  }
});

// Add feedback to resolved issue
router.post('/:id/feedback', authenticateToken, canAccessIssue, validateFeedback, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    
    const issue = await Issue.findById(req.params.id);
    
    if (!issue) {
      return res.status(404).json({ message: 'Issue not found' });
    }

    if (issue.status !== 'resolved') {
      return res.status(400).json({ message: 'Feedback can only be added to resolved issues' });
    }

    if (issue.studentId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the student who created the issue can add feedback' });
    }

    // Add feedback
    issue.studentFeedback = {
      rating,
      comment
    };

    await issue.save();

    res.json({
      message: 'Feedback added successfully',
      feedback: issue.studentFeedback
    });

  } catch (error) {
    console.error('Add feedback error:', error);
    res.status(500).json({ 
      message: 'Failed to add feedback', 
      error: error.message 
    });
  }
});

// Get issue statistics
router.get('/stats/dashboard', authenticateToken, async (req, res) => {
  try {
    let matchQuery = {};
    
    // Filter based on user role
    if (req.user.role === 'student') {
      matchQuery.studentId = req.user._id;
    } else if (req.user.role === 'department_staff') {
      matchQuery.departmentId = req.user.departmentId;
    }

    const stats = await Issue.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalIssues: { $sum: 1 },
          pendingIssues: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          inProgressIssues: {
            $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] }
          },
          resolvedIssues: {
            $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
          },
          criticalIssues: {
            $sum: { $cond: [{ $eq: ['$priority', 'critical'] }, 1, 0] }
          },
          avgResolutionTime: {
            $avg: {
              $cond: [
                { $eq: ['$status', 'resolved'] },
                { $subtract: ['$resolvedAt', '$createdAt'] },
                null
              ]
            }
          }
        }
      }
    ]);

    const result = stats[0] || {
      totalIssues: 0,
      pendingIssues: 0,
      inProgressIssues: 0,
      resolvedIssues: 0,
      criticalIssues: 0,
      avgResolutionTime: 0
    };

    res.json(result);

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve statistics', 
      error: error.message 
    });
  }
});

// Delete issue (admin only)
router.delete('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id);
    
    if (!issue) {
      return res.status(404).json({ message: 'Issue not found' });
    }

    // Delete associated logs
    await IssueLog.deleteMany({ issueId: issue._id });
    
    // Delete issue
    await Issue.findByIdAndDelete(issue._id);

    res.json({ message: 'Issue deleted successfully' });

  } catch (error) {
    console.error('Delete issue error:', error);
    res.status(500).json({ 
      message: 'Failed to delete issue', 
      error: error.message 
    });
  }
});

module.exports = router;
