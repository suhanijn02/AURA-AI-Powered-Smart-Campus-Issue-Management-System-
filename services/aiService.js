const axios = require('axios');
const Category = require('../models/Category');

class AIService {
  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.geminiApiKey = process.env.GEMINI_API_KEY;
    this.useOpenAI = !!this.openaiApiKey;
  }

  // Classify issue using AI
  async classifyIssue(title, description) {
    try {
      // First try local keyword matching
      const localMatch = await Category.findBestMatch(`${title} ${description}`);
      
      // If we have a good local match with high confidence, use it
      if (localMatch && this.calculateLocalConfidence(title, description, localMatch) > 70) {
        return {
          category: localMatch,
          department: localMatch.departmentId,
          priority: this.determinePriority(title, description),
          confidence: this.calculateLocalConfidence(title, description, localMatch),
          summary: this.generateSummary(title, description),
          method: 'local'
        };
      }

      // Fall back to AI API if available
      if (this.useOpenAI || this.geminiApiKey) {
        return await this.classifyWithAI(title, description);
      }

      // Fallback to local matching with lower confidence
      return {
        category: localMatch,
        department: localMatch?.departmentId,
        priority: this.determinePriority(title, description),
        confidence: localMatch ? this.calculateLocalConfidence(title, description, localMatch) : 30,
        summary: this.generateSummary(title, description),
        method: 'local_fallback'
      };

    } catch (error) {
      console.error('AI Classification error:', error);
      
      // Ultimate fallback - try to get any category
      const fallbackCategory = await Category.findOne({ isActive: true }).populate('departmentId');
      
      return {
        category: fallbackCategory,
        department: fallbackCategory?.departmentId,
        priority: 'medium',
        confidence: 20,
        summary: this.generateSummary(title, description),
        method: 'error_fallback',
        error: error.message
      };
    }
  }

  // Classify using OpenAI API
  async classifyWithOpenAI(title, description) {
    const prompt = this.buildClassificationPrompt(title, description);
    
    try {
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an AI assistant that classifies campus maintenance issues. Respond with a JSON object containing category, priority (low/medium/high/critical), and confidence (0-100).'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 150,
        temperature: 0.3
      }, {
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const aiResponse = JSON.parse(response.data.choices[0].message.content);
      const category = await this.findCategoryByName(aiResponse.category);

      return {
        category,
        department: category?.departmentId,
        priority: aiResponse.priority || 'medium',
        confidence: aiResponse.confidence || 75,
        summary: this.generateSummary(title, description),
        method: 'openai'
      };

    } catch (error) {
      console.error('OpenAI API error:', error);
      throw error;
    }
  }

  // Classify using Gemini API
  async classifyWithGemini(title, description) {
    const prompt = this.buildClassificationPrompt(title, description);
    
    try {
      const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.geminiApiKey}`, {
        contents: [{
          parts: [{
            text: `You are an AI assistant that classifies campus maintenance issues. Respond with a JSON object containing category, priority (low/medium/high/critical), and confidence (0-100).\n\n${prompt}`
          }]
        }]
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const aiResponse = JSON.parse(response.data.candidates[0].content.parts[0].text);
      const category = await this.findCategoryByName(aiResponse.category);

      return {
        category,
        department: category?.departmentId,
        priority: aiResponse.priority || 'medium',
        confidence: aiResponse.confidence || 75,
        summary: this.generateSummary(title, description),
        method: 'gemini'
      };

    } catch (error) {
      console.error('Gemini API error:', error);
      throw error;
    }
  }

  // Classify with AI (chooses best available API)
  async classifyWithAI(title, description) {
    if (this.useOpenAI) {
      return await this.classifyWithOpenAI(title, description);
    } else if (this.geminiApiKey) {
      return await this.classifyWithGemini(title, description);
    }
    throw new Error('No AI API keys configured');
  }

  // Build classification prompt
  buildClassificationPrompt(title, description) {
    return `Analyze this campus issue and classify it:

Title: "${title}"
Description: "${description}"

Available categories:
- Electrical (power outages, fan issues, light problems, wiring issues)
- Plumbing (water leaks, drainage, toilet issues, water supply)
- IT/Network (WiFi issues, computer problems, network connectivity)
- Housekeeping (cleaning, waste management, pest control)
- Security (safety concerns, access control, surveillance)
- Infrastructure (building damage, furniture, roads, parking)
- HVAC (air conditioning, heating, ventilation)

Respond with JSON: {"category": "category_name", "priority": "low|medium|high|critical", "confidence": 0-100}

Priority guidelines:
- Critical: safety hazards, live wires, gas leaks, structural damage
- High: major disruptions, multiple affected areas, urgent repairs needed
- Medium: standard maintenance requests, minor inconveniences
- Low: cosmetic issues, improvements, non-urgent requests`;
  }

  // Find category by name (fuzzy matching)
  async findCategoryByName(categoryName) {
    if (!categoryName) return null;
    
    const categories = await Category.find({ isActive: true }).populate('departmentId');
    
    // Try exact match first
    let category = categories.find(cat => 
      cat.name.toLowerCase() === categoryName.toLowerCase()
    );
    
    if (category) return category;
    
    // Try fuzzy matching
    const searchTerms = categoryName.toLowerCase().split(' ');
    let bestMatch = null;
    let highestScore = 0;
    
    categories.forEach(cat => {
      let score = 0;
      const catName = cat.name.toLowerCase();
      
      searchTerms.forEach(term => {
        if (catName.includes(term)) {
          score += 1;
        }
      });
      
      if (score > highestScore) {
        highestScore = score;
        bestMatch = cat;
      }
    });
    
    return bestMatch;
  }

  // Determine priority based on content analysis
  determinePriority(title, description) {
    const text = `${title} ${description}`.toLowerCase();
    
    // Critical keywords
    const criticalKeywords = [
      'fire', 'spark', 'live wire', 'electric shock', 'gas leak', 
      'structural', 'collapse', 'emergency', 'danger', 'hazard',
      'burst', 'flood', 'severe', 'critical', 'urgent'
    ];
    
    // High priority keywords
    const highKeywords = [
      'no power', 'outage', 'broken', 'damaged', 'major', 'multiple',
      'not working', 'failed', 'urgent', 'asap', 'immediately'
    ];
    
    // Low priority keywords
    const lowKeywords = [
      'slow', 'minor', 'cosmetic', 'suggestion', 'improvement',
      'request', 'would like', 'prefer', 'nice to have'
    ];
    
    // Check for critical keywords
    if (criticalKeywords.some(keyword => text.includes(keyword))) {
      return 'critical';
    }
    
    // Check for high priority keywords
    if (highKeywords.some(keyword => text.includes(keyword))) {
      return 'high';
    }
    
    // Check for low priority keywords
    if (lowKeywords.some(keyword => text.includes(keyword))) {
      return 'low';
    }
    
    return 'medium';
  }

  // Calculate local confidence score
  calculateLocalConfidence(title, description, category) {
    if (!category) return 0;
    
    const text = `${title} ${description}`.toLowerCase();
    let score = 0;
    
    // Category name match
    if (text.includes(category.name.toLowerCase())) {
      score += 40;
    }
    
    // Keywords match
    category.keywords.forEach(keyword => {
      if (text.includes(keyword)) {
        score += 20;
      }
    });
    
    // Description match
    if (category.description && text.includes(category.description.toLowerCase())) {
      score += 10;
    }
    
    return Math.min(score, 100);
  }

  // Generate summary of the issue
  generateSummary(title, description) {
    // Simple summarization - take first 100 characters of description
    const summary = description.length > 100 
      ? description.substring(0, 100) + '...' 
      : description;
    
    return summary;
  }

  // Get AI service status
  getServiceStatus() {
    return {
      openaiAvailable: !!this.openaiApiKey,
      geminiAvailable: !!this.geminiApiKey,
      activeService: this.useOpenAI ? 'openai' : (this.geminiApiKey ? 'gemini' : 'local')
    };
  }
}

module.exports = new AIService();
