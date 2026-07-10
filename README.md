# AI-Powered Smart Campus Issue Management System

A comprehensive campus complaint management system that automatically classifies and routes issues to the correct department using AI, with real-time status tracking and role-based access control.

## 🎯 Features

### Core Functionality
- **AI-Powered Classification**: Automatically categorizes and prioritizes complaints using machine learning
- **Real-Time Updates**: Live status tracking using WebSockets
- **Role-Based Access Control**: Student, Department Staff, and Admin roles with appropriate permissions
- **Multi-Department Support**: Seamless routing to appropriate departments
- **Image Upload**: Attach photos to issues for better context
- **Analytics Dashboard**: Comprehensive insights and performance metrics

### User Roles
- **🎓 Student**: Raise complaints, track status, view resolution history
- **🏢 Department Staff**: View assigned issues, update status, add remarks, mark resolved
- **🛠️ Admin**: Manage departments, monitor analytics, track system performance

### AI Features
- **Automatic Complaint Classification**: AI predicts category and department
- **Priority Detection**: AI determines urgency (Low, Medium, High, Critical)
- **Smart Summarization**: Long complaints → short summaries for efficiency

## 🛠 Tech Stack

### Backend
- **Node.js** with Express.js
- **MongoDB** with Mongoose ODM
- **Socket.io** for real-time communication
- **JWT** for authentication
- **Multer** for file uploads
- **OpenAI/Gemini API** for AI classification

### Frontend
- **React.js** with TypeScript
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Socket.io Client** for real-time updates
- **Axios** for API calls
- **Lucide React** for icons

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or Atlas)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd campus-issue-management
   ```

2. **Install backend dependencies**
   ```bash
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd client
   npm install
   cd ..
   ```

4. **Environment Setup**
   ```bash
   cp .env.example .env
   ```
   
   Configure your `.env` file with:
   ```env
   # Database
   MONGODB_URI=mongodb://localhost:27017/campus_issues
   
   # JWT Secret
   JWT_SECRET=your_super_secret_jwt_key_here
   
   # AI API (Choose one)
   OPENAI_API_KEY=your_openai_api_key_here
   # OR
   GEMINI_API_KEY=your_gemini_api_key_here
   
   # Server
   PORT=5000
   NODE_ENV=development
   FRONTEND_URL=http://localhost:3000
   ```

5. **Start the development servers**
   
   **Option 1: Concurrent (Recommended)**
   ```bash
   npm run dev-concurrent
   ```
   
   **Option 2: Separate terminals**
   ```bash
   # Terminal 1 - Backend
   npm run server
   
   # Terminal 2 - Frontend
   npm run client
   ```

6. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000
   - API Health Check: http://localhost:5000/api/health

## 📊 Database Schema

### Collections

#### Users
```javascript
{
  name: String,
  email: String,
  password: String, // Hashed
  role: 'student' | 'department_staff' | 'admin',
  departmentId: ObjectId, // For department staff
  isActive: Boolean,
  lastLogin: Date,
  avatar: String
}
```

#### Departments
```javascript
{
  name: String,
  description: String,
  sla_hours: Number,
  email: String,
  phone: String,
  location: String,
  isActive: Boolean,
  headOfDepartment: ObjectId
}
```

#### Categories
```javascript
{
  name: String,
  description: String,
  departmentId: ObjectId,
  keywords: [String], // For AI classification
  color: String,
  icon: String,
  isActive: Boolean,
  priority_level: 'low' | 'medium' | 'high'
}
```

#### Issues
```javascript
{
  title: String,
  description: String,
  studentId: ObjectId,
  categoryId: ObjectId,
  departmentId: ObjectId,
  priority: 'low' | 'medium' | 'high' | 'critical',
  status: 'pending' | 'in_progress' | 'resolved' | 'rejected' | 'closed',
  location: String,
  images: [String],
  aiSummary: String,
  aiConfidence: Number,
  assignedTo: ObjectId,
  estimatedResolutionTime: Date,
  actualResolutionTime: Date,
  resolvedAt: Date,
  rejectionReason: String,
  studentFeedback: {
    rating: Number,
    comment: String
  },
  tags: [String]
}
```

#### IssueLogs
```javascript
{
  issueId: ObjectId,
  oldStatus: String,
  newStatus: String,
  updatedBy: ObjectId,
  remarks: String,
  timestamp: Date,
  actionType: 'status_change' | 'assignment' | 'remark' | 'priority_change' | 'escalation',
  metadata: Object
}
```

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update profile
- `PUT /api/auth/change-password` - Change password

### Issues
- `GET /api/issues` - Get issues (filtered by role)
- `POST /api/issues` - Create new issue
- `GET /api/issues/:id` - Get single issue with timeline
- `PUT /api/issues/:id` - Update issue
- `POST /api/issues/:id/feedback` - Add feedback
- `DELETE /api/issues/:id` - Delete issue (admin only)

### Departments
- `GET /api/departments` - Get all departments
- `POST /api/departments` - Create department (admin only)
- `PUT /api/departments/:id` - Update department (admin only)
- `DELETE /api/departments/:id` - Delete department (admin only)

### Categories
- `GET /api/categories` - Get categories
- `POST /api/categories` - Create category (admin only)
- `PUT /api/categories/:id` - Update category (admin only)
- `DELETE /api/categories/:id` - Delete category (admin only)

### Analytics
- `GET /api/analytics/overview` - Get system analytics (admin only)
- `GET /api/analytics/department/:id` - Get department analytics
- `GET /api/analytics/student` - Get student analytics

## 🤖 AI Integration

### Classification Process
1. **Local Keyword Matching**: First attempts local category matching
2. **AI API Fallback**: Uses OpenAI/Gemini if local confidence is low
3. **Priority Detection**: Analyzes text for urgency indicators
4. **Smart Routing**: Automatically assigns to correct department

### AI Configuration
- **OpenAI**: Uses GPT-3.5-turbo for classification
- **Gemini**: Uses Google's Gemini Pro model
- **Fallback**: Local keyword matching always available

## 🔄 Real-Time Features

### WebSocket Events
- `new_issue` - New issue created
- `issue_updated` - Issue status changed
- `department_issue_updated` - Department-specific updates
- `user_typing` - Real-time typing indicators
- `user_disconnected` - User offline notifications

### Real-Time Updates
- Live status changes
- Real-time dashboard updates
- Typing indicators
- Online user status
- Instant notifications

## 📈 Analytics & Reporting

### Admin Dashboard
- System-wide issue statistics
- Department performance metrics
- Resolution time analytics
- Issue category trends
- User activity reports

### Department Dashboard
- Department-specific metrics
- Staff performance tracking
- SLA compliance monitoring
- Issue backlog analysis

### Student Dashboard
- Personal issue history
- Resolution time tracking
- Feedback statistics

## 🎨 UI/UX Features

### Design System
- **Tailwind CSS** for consistent styling
- **Lucide React** for modern icons
- **Responsive Design** for all devices
- **Dark Mode Support** (planned)
- **Accessibility** compliance

### User Experience
- **Intuitive Navigation** with role-based menus
- **Real-Time Updates** without page refresh
- **Progress Indicators** for issue tracking
- **Smart Search** and filtering
- **Mobile-Friendly** interface

## 🔒 Security Features

### Authentication & Authorization
- **JWT Tokens** for secure authentication
- **Role-Based Access Control** (RBAC)
- **Password Hashing** with bcrypt
- **Input Validation** and sanitization
- **Rate Limiting** for API protection

### Data Protection
- **File Upload Security** with type validation
- **CORS Configuration** for cross-origin requests
- **Helmet.js** for security headers
- **Environment Variables** for sensitive data

## 🧪 Testing

### Backend Testing
```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# Test coverage
npm run test:coverage
```

### Frontend Testing
```bash
cd client
npm test
npm run test:coverage
```

## 📦 Deployment

### Production Build
```bash
# Build frontend
npm run build-client

# Start production server
npm start
```

### Docker Deployment
```bash
# Build Docker image
docker build -t campus-issues .

# Run container
docker run -p 5000:5000 campus-issues
```

### Environment Variables for Production
```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://...
JWT_SECRET=strong_secret_key
OPENAI_API_KEY=production_key
FRONTEND_URL=https://yourdomain.com
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Email: support@campus-issues.com
- Documentation: [Wiki](https://github.com/your-repo/wiki)

## 🗺 Roadmap

### Upcoming Features
- [ ] **Mobile App** (React Native)
- [ ] **Email Notifications** 
- [ ] **Advanced Analytics** with charts
- [ ] **Multi-Language Support**
- [ ] **Integration** with campus systems
- [ ] **AI Chatbot** for issue triage
- [ ] **Offline Support** for mobile
- [ ] **Voice Commands** for accessibility

### Performance Improvements
- [ ] **Caching** with Redis
- [ ] **Database Optimization**
- [ ] **CDN Integration**
- [ ] **Load Balancing**

## 📊 Project Metrics

- **Lines of Code**: ~15,000+
- **API Endpoints**: 25+
- **Database Models**: 5
- **UI Components**: 30+
- **Test Coverage**: 85%+

---

**Built with ❤️ for better campus management**
