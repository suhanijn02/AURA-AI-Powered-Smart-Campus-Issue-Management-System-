const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Socket.IO connection handler
const socketHandler = (io) => {
  // Store connected users with their roles and departments
  const connectedUsers = new Map();

  // Authentication middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      
      if (!user || !user.isActive) {
        return next(new Error('Invalid or inactive user'));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.name} (${socket.user.role})`);
    
    // Store user connection
    connectedUsers.set(socket.user._id.toString(), {
      socketId: socket.id,
      user: socket.user,
      connectedAt: new Date()
    });

    // Join user to appropriate rooms based on role
    joinUserToRooms(socket);

    // Handle joining department room (for department staff)
    socket.on('join_department', (departmentId) => {
      if (socket.user.role === 'department_staff' && 
          socket.user.departmentId.toString() === departmentId) {
        socket.join(`department_${departmentId}`);
        console.log(`User ${socket.user.name} joined department room: ${departmentId}`);
      }
    });

    // Handle joining issue room (for real-time issue tracking)
    socket.on('join_issue', (issueId) => {
      socket.join(`issue_${issueId}`);
      console.log(`User ${socket.user.name} joined issue room: ${issueId}`);
    });

    // Handle leaving issue room
    socket.on('leave_issue', (issueId) => {
      socket.leave(`issue_${issueId}`);
      console.log(`User ${socket.user.name} left issue room: ${issueId}`);
    });

    // Handle real-time issue status updates
    socket.on('issue_status_update', async (data) => {
      try {
        const { issueId, status, remarks } = data;
        
        // Validate that user has permission to update this issue
        const Issue = require('../models/Issue');
        const issue = await Issue.findById(issueId);
        
        if (!issue) {
          socket.emit('error', { message: 'Issue not found' });
          return;
        }

        // Check permissions
        const canUpdate = 
          socket.user.role === 'admin' ||
          (socket.user.role === 'department_staff' && 
           issue.departmentId.toString() === socket.user.departmentId.toString()) ||
          (socket.user.role === 'student' && 
           issue.studentId.toString() === socket.user._id.toString());

        if (!canUpdate) {
          socket.emit('error', { message: 'Permission denied' });
          return;
        }

        // Broadcast update to relevant rooms
        io.to(`issue_${issueId}`).emit('issue_updated', {
          issueId,
          status,
          updatedBy: socket.user,
          timestamp: new Date(),
          remarks
        });

        // Also notify department room if it's a department staff update
        if (socket.user.role === 'department_staff') {
          io.to(`department_${issue.departmentId}`).emit('department_issue_updated', {
            issueId,
            status,
            updatedBy: socket.user,
            timestamp: new Date()
          });
        }

      } catch (error) {
        console.error('Socket issue status update error:', error);
        socket.emit('error', { message: 'Failed to update issue status' });
      }
    });

    // Handle typing indicators for real-time collaboration
    socket.on('typing_start', (data) => {
      const { issueId, room } = data;
      socket.to(room || `issue_${issueId}`).emit('user_typing', {
        userId: socket.user._id,
        userName: socket.user.name,
        issueId
      });
    });

    socket.on('typing_stop', (data) => {
      const { issueId, room } = data;
      socket.to(room || `issue_${issueId}`).emit('user_stop_typing', {
        userId: socket.user._id,
        issueId
      });
    });

    // Handle real-time notifications
    socket.on('mark_notification_read', (notificationId) => {
      // This would typically update the database
      // For now, just acknowledge
      socket.emit('notification_marked_read', { notificationId });
    });

    // Get online users in department
    socket.on('get_department_users', async () => {
      if (socket.user.role === 'department_staff' || socket.user.role === 'admin') {
        const departmentId = socket.user.departmentId;
        const departmentUsers = Array.from(connectedUsers.values())
          .filter(connection => 
            connection.user.departmentId?.toString() === departmentId?.toString()
          )
          .map(connection => ({
            userId: connection.user._id,
            name: connection.user.name,
            role: connection.user.role,
            connectedAt: connection.connectedAt
          }));

        socket.emit('department_users_online', departmentUsers);
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.name} (${socket.user.role})`);
      connectedUsers.delete(socket.user._id.toString());
      
      // Notify other users about disconnection
      socket.broadcast.emit('user_disconnected', {
        userId: socket.user._id,
        userName: socket.user.name
      });
    });

    // Handle connection errors
    socket.on('error', (error) => {
      console.error(`Socket error for user ${socket.user.name}:`, error);
    });
  });

  // Helper function to join user to appropriate rooms
  function joinUserToRooms(socket) {
    const user = socket.user;
    
    // Join user to their personal room
    socket.join(`user_${user._id}`);
    
    // Join role-based rooms
    socket.join(`role_${user.role}`);
    
    // Join department room if department staff
    if (user.role === 'department_staff' && user.departmentId) {
      socket.join(`department_${user.departmentId}`);
    }
    
    console.log(`User ${user.name} joined rooms: user_${user._id}, role_${user.role}${user.departmentId ? `, department_${user.departmentId}` : ''}`);
  }

  // Helper function to emit notifications to specific users
  const emitToUser = (userId, event, data) => {
    io.to(`user_${userId}`).emit(event, data);
  };

  // Helper function to emit to all users in a role
  const emitToRole = (role, event, data) => {
    io.to(`role_${role}`).emit(event, data);
  };

  // Helper function to emit to all users in a department
  const emitToDepartment = (departmentId, event, data) => {
    io.to(`department_${departmentId}`).emit(event, data);
  };

  // Helper function to emit to all users tracking an issue
  const emitToIssue = (issueId, event, data) => {
    io.to(`issue_${issueId}`).emit(event, data);
  };

  // Make helper functions available globally
  io.emitToUser = emitToUser;
  io.emitToRole = emitToRole;
  io.emitToDepartment = emitToDepartment;
  io.emitToIssue = emitToIssue;

  // Expose connected users for monitoring
  io.getConnectedUsers = () => connectedUsers;

  console.log('Socket.IO server initialized');
};

module.exports = socketHandler;
