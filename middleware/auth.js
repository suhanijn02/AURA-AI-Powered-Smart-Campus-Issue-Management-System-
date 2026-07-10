const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: '7d'
  });
};

// Verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ message: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid or inactive user' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    return res.status(500).json({ message: 'Authentication error' });
  }
};

// Role-based access control middleware
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'Access denied. Insufficient permissions.' 
      });
    }
    next();
  };
};

// Check if user can access specific department (for department staff)
const canAccessDepartment = (req, res, next) => {
  if (req.user.role === 'admin') {
    return next(); // Admin can access all departments
  }
  
  if (req.user.role === 'department_staff') {
    const requestedDepartmentId = req.params.departmentId || req.body.departmentId;
    
    if (!requestedDepartmentId) {
      return res.status(400).json({ message: 'Department ID required' });
    }
    
    if (req.user.departmentId.toString() !== requestedDepartmentId) {
      return res.status(403).json({ 
        message: 'Access denied. Cannot access other departments.' 
      });
    }
    
    return next();
  }
  
  // Students can only access their own issues
  if (req.user.role === 'student') {
    return next();
  }
  
  return res.status(403).json({ message: 'Access denied' });
};

// Check if user can access specific issue
const canAccessIssue = async (req, res, next) => {
  try {
    const Issue = require('../models/Issue');
    const issueId = req.params.issueId || req.params.id;
    
    if (!issueId) {
      return res.status(400).json({ message: 'Issue ID required' });
    }
    
    const issue = await Issue.findById(issueId);
    
    if (!issue) {
      return res.status(404).json({ message: 'Issue not found' });
    }
    
    // Admin can access all issues
    if (req.user.role === 'admin') {
      return next();
    }
    
    // Students can only access their own issues
    if (req.user.role === 'student') {
      if (issue.studentId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ 
          message: 'Access denied. Cannot access other students\' issues.' 
        });
      }
      return next();
    }
    
    // Department staff can only access issues from their department
    if (req.user.role === 'department_staff') {
      if (issue.departmentId.toString() !== req.user.departmentId.toString()) {
        return res.status(403).json({ 
          message: 'Access denied. Cannot access issues from other departments.' 
        });
      }
      return next();
    }
    
    return res.status(403).json({ message: 'Access denied' });
  } catch (error) {
    return res.status(500).json({ message: 'Error checking issue access' });
  }
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      
      if (user && user.isActive) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Ignore authentication errors for optional auth
    next();
  }
};

module.exports = {
  generateToken,
  authenticateToken,
  authorizeRoles,
  canAccessDepartment,
  canAccessIssue,
  optionalAuth
};
