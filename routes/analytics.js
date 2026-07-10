const express = require('express');
const Issue = require('../models/Issue');
const User = require('../models/User');
const Department = require('../models/Department');
const Category = require('../models/Category');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const router = express.Router();

// Get overall analytics (admin only)
router.get('/overview', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { period = '30' } = req.query; // Default to last 30 days
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(period));

    const [
      totalIssues,
      resolvedIssues,
      pendingIssues,
      criticalIssues,
      avgResolutionTime,
      issuesByStatus,
      issuesByPriority,
      issuesByDepartment,
      issuesByCategory,
      monthlyTrends,
      departmentPerformance
    ] = await Promise.all([
      // Total issues in period
      Issue.countDocuments({ createdAt: { $gte: daysAgo } }),
      
      // Resolved issues in period
      Issue.countDocuments({ 
        createdAt: { $gte: daysAgo },
        status: 'resolved' 
      }),
      
      // Pending issues
      Issue.countDocuments({ 
        status: { $in: ['pending', 'in_progress'] }
      }),
      
      // Critical issues
      Issue.countDocuments({ 
        priority: 'critical',
        status: { $in: ['pending', 'in_progress'] }
      }),
      
      // Average resolution time
      Issue.aggregate([
        { $match: { status: 'resolved', resolvedAt: { $gte: daysAgo } } },
        { $project: {
          resolutionTime: { $subtract: ['$resolvedAt', '$createdAt'] }
        }},
        { $group: {
          _id: null,
          avgTime: { $avg: '$resolutionTime' }
        }}
      ]),
      
      // Issues by status
      Issue.aggregate([
        { $match: { createdAt: { $gte: daysAgo } } },
        { $group: {
          _id: '$status',
          count: { $sum: 1 }
        }}
      ]),
      
      // Issues by priority
      Issue.aggregate([
        { $match: { createdAt: { $gte: daysAgo } } },
        { $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }}
      ]),
      
      // Issues by department
      Issue.aggregate([
        { $match: { createdAt: { $gte: daysAgo } } },
        { $lookup: {
          from: 'departments',
          localField: 'departmentId',
          foreignField: '_id',
          as: 'department'
        }},
        { $unwind: '$department' },
        { $group: {
          _id: '$department.name',
          count: { $sum: 1 }
        }},
        { $sort: { count: -1 } }
      ]),
      
      // Issues by category
      Issue.aggregate([
        { $match: { createdAt: { $gte: daysAgo } } },
        { $lookup: {
          from: 'categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'category'
        }},
        { $unwind: '$category' },
        { $group: {
          _id: '$category.name',
          count: { $sum: 1 }
        }},
        { $sort: { count: -1 } }
      ]),
      
      // Monthly trends
      Issue.aggregate([
        { $match: { createdAt: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 12)) } } },
        { $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          total: { $sum: 1 },
          resolved: {
            $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
          }
        }},
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]),
      
      // Department performance
      Department.aggregate([
        { $lookup: {
          from: 'issues',
          localField: '_id',
          foreignField: 'departmentId',
          as: 'issues'
        }},
        { $project: {
          name: 1,
          totalIssues: { $size: '$issues' },
          resolvedIssues: {
            $size: {
              $filter: {
                input: '$issues',
                cond: { $eq: ['$$this.status', 'resolved'] }
              }
            }
          },
          pendingIssues: {
            $size: {
              $filter: {
                input: '$issues',
                cond: { $in: ['$$this.status', ['pending', 'in_progress']] }
              }
            }
          }
        }},
        { $project: {
          name: 1,
          totalIssues: 1,
          resolvedIssues: 1,
          pendingIssues: 1,
          resolutionRate: {
            $cond: [
              { $eq: ['$totalIssues', 0] },
              0,
              { $multiply: [{ $divide: ['$resolvedIssues', '$totalIssues'] }, 100] }
            ]
          }
        }},
        { $sort: { resolutionRate: -1 } }
      ])
    ]);

    res.json({
      overview: {
        totalIssues,
        resolvedIssues,
        pendingIssues,
        criticalIssues,
        avgResolutionTime: avgResolutionTime[0]?.avgTime || 0,
        resolutionRate: totalIssues > 0 ? (resolvedIssues / totalIssues) * 100 : 0
      },
      charts: {
        issuesByStatus,
        issuesByPriority,
        issuesByDepartment,
        issuesByCategory,
        monthlyTrends,
        departmentPerformance
      }
    });

  } catch (error) {
    console.error('Analytics overview error:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve analytics', 
      error: error.message 
    });
  }
});

// Get department analytics (department staff and admin)
router.get('/department/:departmentId', authenticateToken, async (req, res) => {
  try {
    const { departmentId } = req.params;
    const { period = '30' } = req.query;
    
    // Check permissions
    if (req.user.role === 'department_staff' && req.user.departmentId.toString() !== departmentId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(period));

    const [
      department,
      totalIssues,
      resolvedIssues,
      pendingIssues,
      avgResolutionTime,
      issuesByStatus,
      issuesByPriority,
      issuesByCategory,
      staffPerformance,
      recentIssues
    ] = await Promise.all([
      // Department info
      Department.findById(departmentId),
      
      // Total issues in period
      Issue.countDocuments({ 
        departmentId,
        createdAt: { $gte: daysAgo } 
      }),
      
      // Resolved issues in period
      Issue.countDocuments({ 
        departmentId,
        createdAt: { $gte: daysAgo },
        status: 'resolved' 
      }),
      
      // Pending issues
      Issue.countDocuments({ 
        departmentId,
        status: { $in: ['pending', 'in_progress'] }
      }),
      
      // Average resolution time
      Issue.aggregate([
        { $match: { departmentId, status: 'resolved' } },
        { $project: {
          resolutionTime: { $subtract: ['$resolvedAt', '$createdAt'] }
        }},
        { $group: {
          _id: null,
          avgTime: { $avg: '$resolutionTime' }
        }}
      ]),
      
      // Issues by status
      Issue.aggregate([
        { $match: { departmentId, createdAt: { $gte: daysAgo } } },
        { $group: {
          _id: '$status',
          count: { $sum: 1 }
        }}
      ]),
      
      // Issues by priority
      Issue.aggregate([
        { $match: { departmentId, createdAt: { $gte: daysAgo } } },
        { $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }}
      ]),
      
      // Issues by category
      Issue.aggregate([
        { $match: { departmentId, createdAt: { $gte: daysAgo } } },
        { $lookup: {
          from: 'categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'category'
        }},
        { $unwind: '$category' },
        { $group: {
          _id: '$category.name',
          count: { $sum: 1 }
        }},
        { $sort: { count: -1 } }
      ]),
      
      // Staff performance
      User.aggregate([
        { $match: { departmentId, role: 'department_staff' } },
        { $lookup: {
          from: 'issues',
          localField: '_id',
          foreignField: 'assignedTo',
          as: 'assignedIssues'
        }},
        { $project: {
          name: 1,
          email: 1,
          totalAssigned: { $size: '$assignedIssues' },
          resolvedAssigned: {
            $size: {
              $filter: {
                input: '$assignedIssues',
                cond: { $eq: ['$$this.status', 'resolved'] }
              }
            }
          }
        }},
        { $project: {
          name: 1,
          email: 1,
          totalAssigned: 1,
          resolvedAssigned: 1,
          resolutionRate: {
            $cond: [
              { $eq: ['$totalAssigned', 0] },
              0,
              { $multiply: [{ $divide: ['$resolvedAssigned', '$totalAssigned'] }, 100] }
            ]
          }
        }}
      ]),
      
      // Recent issues
      Issue.find({ departmentId })
        .populate('studentId', 'name email')
        .populate('categoryId', 'name')
        .sort({ createdAt: -1 })
        .limit(10)
    ]);

    res.json({
      department,
      overview: {
        totalIssues,
        resolvedIssues,
        pendingIssues,
        avgResolutionTime: avgResolutionTime[0]?.avgTime || 0,
        resolutionRate: totalIssues > 0 ? (resolvedIssues / totalIssues) * 100 : 0
      },
      charts: {
        issuesByStatus,
        issuesByPriority,
        issuesByCategory
      },
      staffPerformance,
      recentIssues
    });

  } catch (error) {
    console.error('Department analytics error:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve department analytics', 
      error: error.message 
    });
  }
});

// Get student analytics (students own data)
router.get('/student', authenticateToken, authorizeRoles('student'), async (req, res) => {
  try {
    const studentId = req.user._id;
    const { period = '30' } = req.query;

    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(period));

    const [
      totalIssues,
      resolvedIssues,
      pendingIssues,
      avgResolutionTime,
      issuesByStatus,
      issuesByPriority,
      recentIssues,
      feedbackStats
    ] = await Promise.all([
      // Total issues in period
      Issue.countDocuments({ 
        studentId,
        createdAt: { $gte: daysAgo } 
      }),
      
      // Resolved issues in period
      Issue.countDocuments({ 
        studentId,
        createdAt: { $gte: daysAgo },
        status: 'resolved' 
      }),
      
      // Pending issues
      Issue.countDocuments({ 
        studentId,
        status: { $in: ['pending', 'in_progress'] }
      }),
      
      // Average resolution time
      Issue.aggregate([
        { $match: { studentId, status: 'resolved' } },
        { $project: {
          resolutionTime: { $subtract: ['$resolvedAt', '$createdAt'] }
        }},
        { $group: {
          _id: null,
          avgTime: { $avg: '$resolutionTime' }
        }}
      ]),
      
      // Issues by status
      Issue.aggregate([
        { $match: { studentId, createdAt: { $gte: daysAgo } } },
        { $group: {
          _id: '$status',
          count: { $sum: 1 }
        }}
      ]),
      
      // Issues by priority
      Issue.aggregate([
        { $match: { studentId, createdAt: { $gte: daysAgo } } },
        { $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }}
      ]),
      
      // Recent issues
      Issue.find({ studentId })
        .populate('categoryId', 'name color')
        .populate('departmentId', 'name')
        .sort({ createdAt: -1 })
        .limit(10),
      
      // Feedback statistics
      Issue.aggregate([
        { $match: { 
          studentId,
          status: 'resolved',
          'studentFeedback.rating': { $exists: true }
        }},
        { $group: {
          _id: null,
          avgRating: { $avg: '$studentFeedback.rating' },
          totalFeedback: { $sum: 1 }
        }}
      ])
    ]);

    res.json({
      overview: {
        totalIssues,
        resolvedIssues,
        pendingIssues,
        avgResolutionTime: avgResolutionTime[0]?.avgTime || 0,
        resolutionRate: totalIssues > 0 ? (resolvedIssues / totalIssues) * 100 : 0
      },
      charts: {
        issuesByStatus,
        issuesByPriority
      },
      recentIssues,
      feedbackStats: feedbackStats[0] || { avgRating: 0, totalFeedback: 0 }
    });

  } catch (error) {
    console.error('Student analytics error:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve student analytics', 
      error: error.message 
    });
  }
});

module.exports = router;
