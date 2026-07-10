const express = require('express');
const User = require('../models/User');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const router = express.Router();

// Get all users (admin only)
router.get('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { role, departmentId, isActive = 'all', page = 1, limit = 10 } = req.query;
    
    let query = {};
    
    if (role) query.role = role;
    if (departmentId) query.departmentId = departmentId;
    if (isActive !== 'all') query.isActive = isActive === 'true';

    const skip = (page - 1) * limit;
    
    const users = await User.find(query)
      .populate('departmentId', 'name')
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve users', 
      error: error.message 
    });
  }
});

// Get single user
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    // Users can only view their own profile unless they're admin
    if (req.user.role !== 'admin' && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const user = await User.findById(req.params.id)
      .populate('departmentId', 'name')
      .select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve user', 
      error: error.message 
    });
  }
});

// Update user (admin only, except for own profile)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { name, email, role, departmentId, isActive, avatar } = req.body;
    
    // Check permissions
    const isOwnProfile = req.user._id.toString() === req.params.id;
    const isAdmin = req.user.role === 'admin';
    
    if (!isOwnProfile && !isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update fields based on permissions
    if (name) user.name = name;
    if (email) user.email = email;
    if (avatar !== undefined) user.avatar = avatar;
    
    // Only admin can update these fields
    if (isAdmin) {
      if (role) user.role = role;
      if (departmentId !== undefined) user.departmentId = departmentId;
      if (isActive !== undefined) user.isActive = isActive;
    }

    await user.save();
    await user.populate('departmentId', 'name');

    res.json({
      message: 'User updated successfully',
      user: user.toProfileJSON()
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ 
      message: 'Failed to update user', 
      error: error.message 
    });
  }
});

// Delete user (admin only)
router.delete('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent admin from deleting themselves
    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    // Check if user has associated issues
    const Issue = require('../models/Issue');
    const issueCount = await Issue.countDocuments({ 
      $or: [
        { studentId: user._id },
        { assignedTo: user._id }
      ]
    });

    if (issueCount > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete user with associated issues' 
      });
    }

    await User.findByIdAndDelete(user._id);

    res.json({ message: 'User deleted successfully' });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ 
      message: 'Failed to delete user', 
      error: error.message 
    });
  }
});

// Get users by department
router.get('/department/:departmentId', authenticateToken, async (req, res) => {
  try {
    const { departmentId } = req.params;
    const { role, isActive = true } = req.query;

    let query = { departmentId };
    if (role) query.role = role;
    if (isActive !== 'all') query.isActive = isActive === 'true';

    const users = await User.find(query)
      .select('name email role isActive lastLogin')
      .sort({ name: 1 });

    res.json({ users });

  } catch (error) {
    console.error('Get department users error:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve department users', 
      error: error.message 
    });
  }
});

// Get user statistics
router.get('/stats/dashboard', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const stats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          activeUsers: {
            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
          },
          students: {
            $sum: { $cond: [{ $eq: ['$role', 'student'] }, 1, 0] }
          },
          departmentStaff: {
            $sum: { $cond: [{ $eq: ['$role', 'department_staff'] }, 1, 0] }
          },
          admins: {
            $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] }
          }
        }
      }
    ]);

    const result = stats[0] || {
      totalUsers: 0,
      activeUsers: 0,
      students: 0,
      departmentStaff: 0,
      admins: 0
    };

    res.json(result);

  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve user statistics', 
      error: error.message 
    });
  }
});

module.exports = router;
