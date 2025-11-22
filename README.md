# ClassEngage

**Real-time Interactive Learning Platform for Google Meet**

ClassEngage is a comprehensive solution that brings interactive polling, quizzes, and attendance tracking to your online classroom. It consists of a Chrome extension for students and a web-based dashboard for teachers, all powered by Firebase for real-time synchronization.

---

## 🌟 Features

### For Teachers (Dashboard)
- **Session Management**: Create and manage live teaching sessions
- **Interactive Polls**: Launch instant polls with multiple choice questions
- **Advanced Quizzes**:
  - Multiple question types (MCQ, True/False, Text Answer)
  - Single or multiple correct answers
  - Automatic grading for objective questions
  - Manual grading interface for text answers
  - Timed quizzes with auto-submission
  - Question navigation for students
- **Live Leaderboard**: Track student performance in real-time
- **Attendance System**: Automatic tracking with join/leave times and duration
- **Analytics & Export**: Download attendance logs and quiz results as CSV

### For Students (Chrome Extension)
- **Seamless Integration**: Works inside Google Meet interface
- **Join Sessions**: Quick session access with ID
- **Respond to Polls**: Submit answers with instant feedback
- **Take Quizzes**:
  - Answer multiple question types
  - Navigate between questions
  - Live timer countdown
  - Auto-submit on timeout
- **View Rankings**: See real-time leaderboard and scores
- **Attendance Tracking**: Automatic check-in/check-out

---

## 🏗️ Architecture

### Tech Stack

**Dashboard (Web Application)**
- React 18
- Vite
- Tailwind CSS
- Firebase (Firestore, Authentication)
- React Router

**Chrome Extension**
- Manifest V3
- Vanilla JavaScript
- Firebase SDK (bundled with esbuild)
- Chrome Storage API
- Real-time Firestore listeners

**Backend**
- Firebase Firestore (NoSQL database)
- Firebase Authentication
- Server-side validation in extension background script

### Project Structure

```
ClassEngage/
├── classengage-dashboard/          # Teacher dashboard (React app)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.jsx            # Landing page
│   │   │   ├── Login.jsx           # Authentication
│   │   │   ├── MySessions.jsx      # Session list
│   │   │   └── SessionPage.jsx     # Main session control
│   │   ├── components/
│   │   │   └── Toast.jsx           # Notification system
│   │   ├── firebase/
│   │   │   ├── init.js             # Firebase initialization
│   │   │   └── AuthProvider.jsx    # Auth context
│   │   ├── App.jsx                 # Main app component
│   │   └── styles.css              # Global styles
│   ├── public/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── postcss.config.js
│
├── c–––      # Chrome extension
│   ├── src/
│   │   ├── background.src.js       # Service worker (trusted writer)
│   │   ├── contentScript.src.js    # UI overlay & listeners
│   │   ├── firebaseConfig.js       # Firebase config (gitignored)
│   │   └── extension/              # Built files
│   │       ├── manifest.json       # Extension manifest
│   │       ├── popup.html          # Extension popup
│   │       ├── popup.js            # Popup logic
│   │       ├── background.js       # Built background script
│   │       └── contentScript.js    # Built content script
│   ├── build.mjs                   # esbuild bundler
│   └── package.json
│
└── README.md                        # This file
```

---

## 🚀 Setup Instructions

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Firebase project
- Google Chrome browser

### 1. Firebase Setup

1. Create a new Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Firestore Database**
3. Enable **Email/Password Authentication**
4. Get your Firebase configuration:
   - Go to Project Settings → General
   - Scroll to "Your apps" → Web app
   - Copy the configuration object

### 2. Dashboard Setup

```bash
cd classengage-dashboard

# Install dependencies
npm install

# Create Firebase config
# Create src/firebase/init.js with your Firebase config:
```

**src/firebase/init.js:**
```javascript
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
```

```bash
# Run development server
npm run dev

# Build for production
npm run build
```

Dashboard will be available at `http://localhost:5173`

### 3. Extension Setup

```bash
cd classengage-extension

# Install dependencies
npm install

# Create Firebase config
# Create src/firebaseConfig.js with the same config:
```

**src/firebaseConfig.js:**
```javascript
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

```bash
# Build the extension
node build.mjs
```

### 4. Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `classengage-extension/src/extension` folder
5. Extension is now installed!

---

## 📖 Usage Guide

### For Teachers

#### 1. Create Account & Login
- Visit the dashboard
- Sign up with email/password
- Login to access your sessions

#### 2. Create a Session
- Click **"New Session"** button
- Share the **Session ID** with students
- Session is now live

#### 3. Launch a Poll
- Enter your question
- Add options (minimum 2)
- Select correct answer
- Click **"Launch Poll"**
- Students see poll in real-time
- Click **"End Poll"** when done

#### 4. Create a Quiz
- Switch to **Quiz Mode**
- Enter quiz title and duration
- Add questions:
  - **MCQ**: Select single or multiple correct answers
  - **True/False**: Choose correct option
  - **Text**: Provide reference answer
- Click **"Launch Quiz"**
- Monitor timer countdown
- Auto-closes when timer ends

#### 5. Manual Grading (Text Answers)
- Click **"Quiz Results"** after ending quiz
- Find submissions marked **"📝 Pending"**
- Click **"Grade"** button
- Review student answer vs reference answer
- Award points and add feedback
- Click **"Save Grades"**

#### 6. View Attendance
- Click **"📋 Attendance"** button
- See join/leave times and duration
- Click **"📥 Export CSV"** to download

#### 7. End Session
- Click **"End Session"** when class is over
- All data is saved in Firebase

### For Students

#### 1. Install Extension
- Install the ClassEngage Chrome extension
- Pin it to toolbar for easy access

#### 2. Join Session
- Open Google Meet
- Click ClassEngage extension icon
- Enter **Session ID** from teacher
- Enter your **Name** and **Center**
- Click **"Join Session"**
- Overlay appears in bottom-right corner

#### 3. Answer Polls
- Poll appears automatically when teacher launches
- Select your answer
- Click **"Submit"**
- See if you're correct (✓ or ✗)
- Earn points for correct answers

#### 4. Take Quizzes
- Quiz appears when teacher launches
- See timer countdown at top
- Answer questions:
  - **MCQ single**: Click one option
  - **MCQ multiple**: Check all that apply
  - **True/False**: Click True or False
  - **Text**: Type your answer
- Use **Previous/Next** to navigate
- Click **"Submit Quiz"** on last question
- Auto-submits when timer reaches 0
- See your score immediately

#### 5. View Leaderboard
- See your rank in **Top 3 Students**
- View **Center Rankings**
- Track your score in real-time

#### 6. Leave Session
- Click **"Leave"** button when done
- Attendance is automatically recorded

---

## 🔒 Security Features

### Client-Server Architecture
- **Background script** = Trusted writer only
- **Content script** = UI rendering & listeners
- All writes to Firestore happen server-side

### Server-Side Validation
- Answer correctness computed in background script
- Students cannot cheat by inspecting client code
- Quiz results validated against server-stored answers

### Attendance Integrity
- Join/leave timestamps from `serverTimestamp()`
- Cannot be manipulated client-side

### Firebase Security Rules
Recommended Firestore rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /sessions/{sessionId} {
      allow read: if true;
      allow write: if request.auth != null;

      match /students/{studentId} {
        allow read: if true;
        allow write: if true; // Extension background writes
      }

      match /responses/{responseId} {
        allow read: if true;
        allow write: if true; // Extension background writes
      }

      match /quizSubmissions/{submissionId} {
        allow read: if true;
        allow write: if true; // Extension background writes
      }

      match /attendance/{studentId} {
        allow read: if true;
        allow write: if true; // Extension background writes
      }
    }
  }
}
```

---

## 🚢 Deployment

### Dashboard (Vercel)

```bash
cd classengage-dashboard

# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Production deployment
vercel --prod
```

**vercel.json** (already configured):
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ]
}
```

### Extension (Chrome Web Store)

1. Build production version:
```bash
cd classengage-extension
node build.mjs
```

2. Create a ZIP file:
```bash
# Zip the extension folder
zip -r classengage-extension.zip src/extension
```

3. Upload to Chrome Web Store:
- Go to [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole)
- Click **"New Item"**
- Upload ZIP file
- Fill in store listing details
- Submit for review

---

## 🐛 Troubleshooting

### Common Issues

**Extension context invalidated**
- **Cause**: Extension was reloaded while page was open
- **Solution**: Refresh the Google Meet page

**Firestore: Unsupported field value: undefined**
- **Cause**: Trying to save undefined values to Firestore
- **Solution**: Already handled in code with validation

**No document to update (attendance)**
- **Cause**: Student didn't join properly
- **Solution**: Use `setDoc` with merge instead of `updateDoc`

**Quiz timer not starting**
- **Cause**: Quiz created without duration
- **Solution**: Set duration in quiz builder

**Manual grading not showing**
- **Cause**: No text answer questions in quiz
- **Solution**: Add text type questions to enable manual grading

### Debug Mode

**Dashboard:**
```bash
# Check console for errors
F12 → Console tab

# Check Firebase connection
console.log(db)
```

**Extension:**
```bash
# Check background script logs
chrome://extensions → Service worker → Console

# Check content script logs
F12 on Google Meet → Console tab → Look for "BG received:", "Quiz submit response:"
```

---

## 📊 Data Models

### Session Document
```javascript
{
  id: "sessionId",
  createdBy: "teacherUid",
  createdAt: Timestamp,
  activePoll: {
    pollId: "poll_timestamp",
    question: "What is 2+2?",
    options: ["2", "3", "4", "5"],
    correctOption: 2,
    createdAt: timestamp
  },
  activeQuiz: {
    quizId: "quiz_timestamp",
    title: "Math Quiz",
    duration: 300,
    questions: [...],
    createdAt: timestamp
  },
  leaderboard: {
    topStudents: [{id, name, center, score}],
    centers: {centerName: totalScore}
  },
  endedAt: Timestamp | null
}
```

### Student Document (Subcollection)
```javascript
{
  id: "studentId",
  name: "John Doe",
  center: "NYC",
  score: 50,
  joinedAt: Timestamp
}
```

### Quiz Submission Document (Subcollection)
```javascript
{
  visibleStudentId: "student_123",
  visibleStudentName: "John Doe",
  center: "NYC",
  quizId: "quiz_123",
  answers: {q1: 0, q2: [0,2], q3: "answer text"},
  results: {
    q1: {
      isCorrect: true,
      studentAnswer: 0,
      correctOption: 0,
      gradingStatus: "auto",
      type: "mcq"
    }
  },
  totalScore: 30,
  pendingManualGrading: false,
  gradingStatus: "completed",
  submittedAt: Timestamp
}
```

### Attendance Document (Subcollection)
```javascript
{
  studentId: "student_123",
  name: "John Doe",
  center: "NYC",
  joinedAt: Timestamp,
  leftAt: Timestamp | null,
  status: "present"
}
```

---

## 🤝 Contributing

We welcome contributions! To contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 🙏 Acknowledgments

- Firebase for real-time database
- React team for the awesome framework
- Tailwind CSS for utility-first styling
- Chrome Extensions team for Manifest V3

---

## 📞 Support

For issues, questions, or feature requests:
- Open an issue on GitHub
- Contact: [roushan01jan@gmail.com]

---

**Built with ❤️ by the ClassEngage Team**

*Making online education interactive and engaging, one session at a time.*
