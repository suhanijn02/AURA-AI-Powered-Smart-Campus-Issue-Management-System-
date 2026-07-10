const express = require('express');
const Category = require('../models/Category');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { validateCategoryCreation } = require('../middleware/validation');
const router = express.Router();

// Get all categories
router.get('/', async (req, res) => {
  try {
    const { departmentId, isActive = true } = req.query;
    
    let query = {};
    if (isActive !== 'all') {
      query.isActive = isActive === 'true';
    }
    if (departmentId) {
      query.departmentId = departmentId;
    }

    const categories = await Category.find(query)
      .populate('departmentId', 'name')
      .sort({ name: 1 });

    res.json({ categories });

  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve categories', 
      error: error.message 
    });
  }
});

// Get single category
router.get('/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id)
      .populate('departmentId', 'name');

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json({ category });

  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve category', 
      error: error.message 
    });
  }
});

// Create new category (admin only)
router.post('/', authenticateToken, authorizeRoles('admin'), validateCategoryCreation, async (req, res) => {
  try {
    const { name, description, departmentId, keywords, color, icon, priority_level } = req.body;

    // Check if category already exists in the same department
    const existingCategory = await Category.findOne({ name, departmentId });
    if (existingCategory) {
      return res.status(400).json({ message: 'Category with this name already exists in this department' });
    }

    const category = new Category({
      name,
      description,
      departmentId,
      keywords: keywords || [],
      color: color || '#6B7280',
      icon: icon || 'folder',
      priority_level: priority_level || 'medium'
    });

    await category.save();
    await category.populate('departmentId', 'name');

    res.status(201).json({
      message: 'Category created successfully',
      category
    });

  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ 
      message: 'Failed to create category', 
      error: error.message 
    });
  }
});

// Update category (admin only)
router.put('/:id', authenticateToken, authorizeRoles('admin'), validateCategoryCreation, async (req, res) => {
  try {
    const { name, description, departmentId, keywords, color, icon, priority_level, isActive } = req.body;

    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Update fields
    if (name) category.name = name;
    if (description !== undefined) category.description = description;
    if (departmentId) category.departmentId = departmentId;
    if (keywords !== undefined) category.keywords = keywords;
    if (color) category.color = color;
    if (icon) category.icon = icon;
    if (priority_level) category.priority_level = priority_level;
    if (isActive !== undefined) category.isActive = isActive;

    await category.save();
    await category.populate('departmentId', 'name');

    res.json({
      message: 'Category updated successfully',
      category
    });

  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ 
      message: 'Failed to update category', 
      error: error.message 
    });
  }
});

// Delete category (admin only)
router.delete('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Check if category has associated issues
    const Issue = require('../models/Issue');
    const issueCount = await Issue.countDocuments({ categoryId: category._id });

    if (issueCount > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete category with associated issues' 
      });
    }

    await Category.findByIdAndDelete(category._id);

    res.json({ message: 'Category deleted successfully' });

  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ 
      message: 'Failed to delete category', 
      error: error.message 
    });
  }
});

// Get categories by department
router.get('/department/:departmentId', async (req, res) => {
  try {
    const { departmentId } = req.params;
    const { isActive = true } = req.query;

    let query = { departmentId };
    if (isActive !== 'all') {
      query.isActive = isActive === 'true';
    }

    const categories = await Category.find(query)
      .populate('departmentId', 'name')
      .sort({ name: 1 });

    res.json({ categories });

  } catch (error) {
    console.error('Get categories by department error:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve categories', 
      error: error.message 
    });
  }
});

module.exports = router;
