# The Genesis

A comprehensive personal productivity and life management application with AI-powered chat assistance. Built for long-term goal tracking, habit management, mental health support, and strategic planning.

## 🎯 Overview

The Genesis is a full-stack productivity application designed to help users manage their life across multiple dimensions:
- **Task & Time Management**: Weekly todo system with Pomodoro timer
- **Habit Tracking**: Monitor habits and track relapses
- **Goal Planning**: Hierarchical plan builder with conditional branches
- **Mental Health**: Comprehensive mind-body wellness tracking
- **AI Chat Assistant**: Local LLM integration with customizable personalities
- **Life Organization**: Rules, protocols, lessons library, and gratitude journal

## 🏗️ Architecture

### Tech Stack

**Backend:**
- Node.js with Express.js 5
- TypeScript
- SQLite (better-sqlite3) for user authentication
- File-based JSON storage for user state
- JWT authentication with bcrypt password hashing
- LM Studio integration for local AI chat

**Frontend:**
- React 19 with TypeScript
- Vite for build tooling
- Recharts for data visualization
- Day.js for date handling
- Modern CSS with glassmorphic design

### Project Structure

```
The Genesis/
├── src/                    # Backend TypeScript source
│   ├── server.ts          # Express app & API routes
│   ├── auth.ts            # JWT authentication middleware
│   ├── db.ts              # SQLite database operations
│   ├── storage.ts         # File-based state persistence
│   ├── types.ts           # TypeScript type definitions
│   └── defaults.ts        # Default app state factory
├── client/                 # Frontend React application
│   └── src/
│       ├── App.tsx        # Main React component (all UI)
│       ├── App.css        # Application styles
│       ├── main.tsx       # React entry point
│       └── index.css      # Global styles
├── data/                   # User data storage
│   ├── genesis.db         # SQLite database
│   └── users/             # Per-user JSON state files
└── dist/                   # Compiled backend code
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- LM Studio (optional, for AI chat features)
- A modern web browser

### Installation

1. **Clone or navigate to the project directory:**
   ```bash
   cd "The Genesis"
   ```

2. **Install backend dependencies:**
   ```bash
   npm install
   ```

3. **Install frontend dependencies:**
   ```bash
   cd client
   npm install
   cd ..
   ```

### Configuration

Create a `.env` file in the root directory (optional):

```env
PORT=8787
CORS_ORIGIN=http://localhost:5173
JWT_SECRET=your-secret-key-change-this-in-production
LMSTUDIO_BASE_URL=http://127.0.0.1:1234/v1
```

**Environment Variables:**
- `PORT`: Server port (default: 8787)
- `CORS_ORIGIN`: Frontend origin (default: http://localhost:5173)
- `JWT_SECRET`: JWT signing secret (default: "local-dev-secret-change-me")
- `LMSTUDIO_BASE_URL`: LM Studio API URL (default: http://127.0.0.1:1234/v1)

### Running the Application

**Development Mode:**

1. **Start the backend server:**
   ```bash
   npm run dev
   ```
   Server runs on `http://localhost:8787`

2. **Start the frontend (in a new terminal):**
   ```bash
   cd client
   npm run dev
   ```
   Frontend runs on `http://localhost:5173`

**Production Build:**

1. **Build backend:**
   ```bash
   npm run build
   ```

2. **Build frontend:**
   ```bash
   cd client
   npm run build
   ```

3. **Start production server:**
   ```bash
   npm start
   ```

## 📱 Features

### 1. Dashboard
- Customizable motivational quotes
- AI chat interface with multiple personality modes
- Weekly performance trend visualization
- Chat history grouped by date

### 2. Event Countdown
- Track upcoming events with dates and notes
- Days remaining/elapsed display
- Visual countdown cards

### 3. Habits Tracker
- Create and manage habits
- Log relapses with timestamps and trigger notes
- Track habit patterns over time

### 4. Weekly Todo System
- Week-based task organization
- Daily task tracking with completion status
- Reward system (unlocks at 80% completion)
- Daily lessons learned
- Calendar log history for archived weeks
- Auto-archives past weeks
- "Not Done" metric tracking

### 5. Motivational Quotes
- Create/edit motivational cards
- Quotes with personal notes and tags
- Categorize by themes

### 6. Plan Builder
- Tree-structured planning system
- Conditional branches ("if this, then do that")
- Risk levels, progress metrics, branch labels
- Hierarchical visualization
- Fallback and contingency planning

### 7. Lessons Library
- Store lessons learned
- Title, content, and tags
- Searchable knowledge base

### 8. Rules For Life
- Personal rules with reasons
- Life principles and guidelines

### 9. Social Protocols
- Define interaction protocols for specific people
- Includes boundaries, reasons, and expectations
- Relationship management

### 10. Mental Health System
**Mind:**
- Inner Circle: Trusted people
- Things I Love: Positive reminders
- Grounding Tools: Coping strategies
- Low-Point Plan: Crisis management

**Body:**
- Physical Health Habits
- Movement Plan
- Nutrition Anchors
- Sleep Protocol
- Mind-Body Quote

### 11. Gratitude Journal
- Track gratitude and achievements
- Date-based entries with categories
- Celebrate wins and positive moments

### 12. AI Chat Integration
- **LM Studio Integration**: Connects to local LLM server
- **Customizable Personalities**: 
  - Girlfriend (affectionate, warm, encouraging)
  - Mentor (direct, strategic, action-oriented)
  - Strategist (systems thinker, frameworks)
- **Streaming Responses**: Real-time token streaming
- **Model Selection**: Fetches available models from LM Studio
- **Chat Sessions**: Multiple conversations with history

### 13. Settings & Customization
- **Themes**: Midnight (default), Sunrise, Forest
- **Wallpapers**: Per-tab custom wallpapers with upload/history
- **Goal Line**: Personal motivation statement
- **Personality Management**: Create/edit AI personalities

### 14. Pomodoro Timer
- 25-minute timer (1500 seconds)
- Start/pause/reset functionality
- Integrated with todo system

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user (protected)

### State Management
- `GET /api/state` - Get user's app state (protected)
- `PUT /api/state` - Save user's app state (protected)

### AI Integration
- `GET /api/ai/models` - Fetch available LM Studio models (protected)
- `POST /api/ai/chat` - Send chat message (protected)
- `POST /api/ai/chat/stream` - Stream chat response (protected)

### Health
- `GET /api/health` - Server health check

## 🔒 Security

- Helmet.js for HTTP security headers
- CORS configuration
- Password hashing with bcrypt (12 rounds)
- JWT token expiration (7 days)
- Input validation with Zod
- SQL injection protection via parameterized queries

## 💾 Data Storage

- **User Accounts**: Stored in SQLite database (`data/genesis.db`)
- **User State**: JSON files per user (`data/users/{userId}/app-state.json`)
- **Automatic Backups**: State is saved on every change
- **Data Isolation**: Each user has completely isolated data

## 🎨 Theming

Three built-in themes:
- **Midnight**: Dark blue/purple gradient (default)
- **Sunrise**: Warm pink/orange gradient
- **Forest**: Green/nature gradient

Custom wallpapers can be uploaded per tab/section.

## 🤖 AI Chat Setup

1. **Install LM Studio**: Download from [lmstudio.ai](https://lmstudio.ai)
2. **Load a Model**: Open LM Studio and load a compatible model
3. **Start Local Server**: LM Studio automatically starts a local server on port 1234
4. **Configure (Optional)**: Set `LMSTUDIO_BASE_URL` in `.env` if using a different port

The app will automatically detect and connect to LM Studio when available.

## 🛠️ Development

### Scripts

**Backend:**
- `npm run dev` - Start dev server with hot reload
- `npm run build` - Compile TypeScript
- `npm run start` - Run production server
- `npm run typecheck` - Type check without emitting

**Frontend:**
- `npm run dev` - Start Vite dev server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint

### Code Structure

- **Single-file React app**: All UI logic in `App.tsx` for simplicity
- **File-based persistence**: User state stored as JSON files
- **Auto-archiving**: Past weeks automatically archived
- **State normalization**: Backward compatibility for state migrations
- **Streaming AI**: Real-time token streaming for better UX

## 📝 Notes

- The application uses a single React component architecture for simplicity
- All user data is stored locally (SQLite + JSON files)
- No external cloud services required (except optional LM Studio)
- Fully functional offline once authenticated
- Mobile-responsive design

## 🐛 Troubleshooting

**AI Chat not working:**
- Ensure LM Studio is running
- Check that a model is loaded in LM Studio
- Verify `LMSTUDIO_BASE_URL` matches your LM Studio port
- Check browser console for connection errors

**Graph not visible:**
- Ensure you have weekly todos with tasks
- Check browser console for errors
- Verify Recharts is properly installed

**Authentication issues:**
- Clear browser localStorage
- Check JWT_SECRET is set correctly
- Verify database file permissions

## 📄 License

ISC

## 🙏 Acknowledgments

Built with:
- React, Express, TypeScript
- LM Studio for local AI capabilities
- Recharts for data visualization
- Better-sqlite3 for database

---

**The Genesis** - Your personal productivity vault for the next decade.

