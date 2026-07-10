const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
    unique: true,
    maxlength: [50, 'Category name cannot exceed 50 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [200, 'Description cannot exceed 200 characters']
  },
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: [true, 'Department is required']
  },
  keywords: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  color: {
    type: String,
    default: '#6B7280',
    match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Please provide a valid hex color']
  },
  icon: {
    type: String,
    default: 'folder'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  priority_level: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  }
}, {
  timestamps: true
});

// Index for better query performance
categorySchema.index({ name: 1 });
categorySchema.index({ departmentId: 1 });
categorySchema.index({ isActive: 1 });

// Method to find category by keywords (for AI classification)
categorySchema.methods.matchesKeywords = function(text) {
  const lowerText = text.toLowerCase();
  return this.keywords.some(keyword => lowerText.includes(keyword));
};

// Static method to find best matching category for a given text
categorySchema.statics.findBestMatch = async function(text) {
  const categories = await this.find({ isActive: true }).populate('departmentId');
  
  let bestMatch = null;
  let highestScore = 0;
  
  categories.forEach(category => {
    let score = 0;
    const lowerText = text.toLowerCase();
    
    // Check exact name match
    if (lowerText.includes(category.name.toLowerCase())) {
      score += 10;
    }
    
    // Check keywords
    category.keywords.forEach(keyword => {
      if (lowerText.includes(keyword)) {
        score += 5;
      }
    });
    
    // Check description
    if (category.description && lowerText.includes(category.description.toLowerCase())) {
      score += 3;
    }
    
    if (score > highestScore) {
      highestScore = score;
      bestMatch = category;
    }
  });
  
  return bestMatch;
};

module.exports = mongoose.model('Category', categorySchema);
