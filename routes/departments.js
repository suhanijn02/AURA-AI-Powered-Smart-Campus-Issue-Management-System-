const express = require('express');
const Department = require('../models/Department');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { validateDepartmentCreation } = require('../middleware/validation');
const router = express.Router();

// Get all departments
router.get('/', async (req, res) => {
  try {
    const { isActive = true } = req.query;
    
    let query = {};
    if (isActive !== 'all') {
      query.isActive = isActive === 'true';
    }

    const departments = await Department.find(query)
      .populate('headOfDepartment', 'name email')
      .sort({ name: 1 });

    res.json({ departments });

  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve departments', 
      error: error.message 
    });
  }
});

// Get single department
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const department = await Department.findById(req.params.id)
      .populate('headOfDepartment', 'name email');

    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    // Get department performance metrics
    const performance = await department.getPerformanceMetrics();

    res.json({
      department,
      performance
    });

  } catch (error) {
    console.error('Get department error:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve department', 
      error: error.message 
    });
  }
});

// Create new department (admin only)
router.post('/', authenticateToken, authorizeRoles('admin'), validateDepartmentCreation, async (req, res) => {
  try {
    const { name, description, sla_hours, email, phone, location, headOfDepartment } = req.body;

    // Check if department already exists
    const existingDepartment = await Department.findOne({ name });
    if (existingDepartment) {
      return res.status(400).json({ message: 'Department with this name already exists' });
    }

    const department = new Department({
      name,
      description,
      sla_hours,
      email,
      phone,
      location,
      headOfDepartment
    });

    await department.save();
    await department.populate('headOfDepartment', 'name email');

    res.status(201).json({
      message: 'Department created successfully',
      department
    });

  } catch (error) {
    console.error('Create department error:', error);
    res.status(500).json({ 
      message: 'Failed to create department', 
      error: error.message 
    });
  }
});

// Update department (admin only)
router.put('/:id', authenticateToken, authorizeRoles('admin'), validateDepartmentCreation, async (req, res) => {
  try {
    const { name, description, sla_hours, email, phone, location, headOfDepartment, isActive } = req.body;

    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    // Update fields
    if (name) department.name = name;
    if (description !== undefined) department.description = description;
    if (sla_hours) department.sla_hours = sla_hours;
    if (email !== undefined) department.email = email;
    if (phone !== undefined) department.phone = phone;
    if (location !== undefined) department.location = location;
    if (headOfDepartment !== undefined) department.headOfDepartment = headOfDepartment;
    if (isActive !== undefined) department.isActive = isActive;

    await department.save();
    await department.populate('headOfDepartment', 'name email');

    res.json({
      message: 'Department updated successfully',
      department
    });

  } catch (error) {
    console.error('Update department error:', error);
    res.status(500).json({ 
      message: 'Failed to update department', 
      error: error.message 
    });
  }
});

// Delete department (admin only)
router.delete('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    
    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    // Check if department has associated categories or issues
    const Category = require('../models/Category');
    const Issue = require('../models/Issue');
    
    const categoryCount = await Category.countDocuments({ departmentId: department._id });
    const issueCount = await Issue.countDocuments({ departmentId: department._id });

    if (categoryCount > 0 || issueCount > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete department with associated categories or issues' 
      });
    }

    await Department.findByIdAndDelete(department._id);

    res.json({ message: 'Department deleted successfully' });

  } catch (error) {
    console.error('Delete department error:', error);
    res.status(500).json({ 
      message: 'Failed to delete department', 
      error: error.message 
    });
  }
});

// Get department statistics
router.get('/:id/stats', authenticateToken, async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    
    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    const performance = await department.getPerformanceMetrics();

    res.json({
      departmentId: department._id,
      departmentName: department.name,
      ...performance
    });

  } catch (error) {
    console.error('Get department stats error:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve department statistics', 
      error: error.message 
    });
  }
});

module.exports = router;
