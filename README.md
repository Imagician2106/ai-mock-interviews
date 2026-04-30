# 🎯 Intergini – AI Mock Interview Platform

## 🚀 About the Project

**Intergini** is an AI-powered mock interview platform designed to help users practice interviews in a realistic and interactive way.

This project was originally based on an existing open-source idea, but has been **independently customized, configured, debugged, and extended** to work end-to-end with real integrations like Firebase, Vapi, and AI models.

The goal of Intergini is simple:
👉 Help users **prepare better for interviews using AI-driven simulations and feedback**

---

## 🧠 What Intergini Does

* 🔐 User authentication using Firebase
* 🎤 AI-powered mock interviews with voice interaction
* 🤖 Dynamic question generation using AI
* 📊 Smart feedback based on interview performance
* 🧾 Stores interview history and results
* 💻 Clean dashboard to manage interviews

---

## ⚙️ Tech Stack

* Next.js
* Firebase (Auth + Firestore)
* Tailwind CSS
* Vapi AI (voice assistant)
* Google Gemini API
* shadcn/ui
* Zod

---

## 🔋 Features

👉 **Authentication System**
Secure login and signup using Firebase.

👉 **AI Interview Generation**
Generate interview questions based on role, experience, and tech stack.

👉 **Voice-Based Interview Experience**
Interact with an AI interviewer using real-time voice (Vapi).

👉 **AI Feedback System**
Get structured feedback including:

* Communication
* Technical knowledge
* Confidence
* Problem-solving

👉 **Dashboard**
Track all your interviews and performance.

👉 **Responsive UI**
Works across desktop and mobile devices.

---

## 🛠️ What I Changed / Improved

* ✅ Fixed Firebase setup and configuration issues
* ✅ Resolved Firestore indexing errors and query failures
* ✅ Integrated Vapi voice assistant properly
* ✅ Handled API key and environment setup manually
* ✅ Improved project structure and stability
* ✅ Customized UI and overall flow
* ✅ Debugged runtime and build errors in Next.js
* ✅ Set up deployment-ready configuration

---

## ⚡ Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Imagician2106/ai-mock-interviews.git
cd ai_mock_interviews
```

---

### 2. Install dependencies

```bash
npm install
```

---

### 3. Setup Environment Variables

Create a `.env.local` file and add:

```env
NEXT_PUBLIC_VAPI_WEB_TOKEN=
NEXT_PUBLIC_VAPI_WORKFLOW_ID=

GOOGLE_GENERATIVE_AI_API_KEY=

NEXT_PUBLIC_BASE_URL=

NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

---

### 4. Run the project

```bash
npm run dev
```

Open 👉 http://localhost:3000

---

## 🌍 Deployment

This project is deployment-ready and can be hosted for free using platforms like:

* Vercel (recommended)
* Netlify

---

## 📌 Note

This project reflects hands-on work including:

* Debugging real-world errors
* Integrating multiple APIs
* Managing backend + frontend together

---

## 💡 Future Improvements

* Add more AI models (fallback system)
* Improve feedback accuracy
* Add analytics dashboard
* Better UI/UX polish

---

## 🙌 Final Thought

Intergini is not just a tutorial project — it’s a **working AI system built, fixed, and customized step by step**.


