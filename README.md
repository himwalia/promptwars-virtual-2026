# Civic-Flow: Autonomous Election Navigator

**Civic-Flow** is an AI-powered, interactive Election Navigator that guides users through the U.S. electoral process — from Voter Registration to Certification — with adaptive explanations powered by Google Gemini 1.5 Pro.

---

## 🚀 Engineering Highlights

- **98.56% Test Coverage** — 62 passing Jest tests across 6 suites covering confidence scoring, knowledge state transitions, hysteresis stability, BYOK quota routing, and Gemini adapter error handling.
- **Adaptive AI Engine** — Dynamically adjusts explanation depth based on the user's "Civic Knowledge State" (Novice → Informed → Policy Wonk) using weighted confidence scoring with time-decay and topic difficulty multipliers.
- **Hybrid BYOK Architecture** — Works out-of-the-box with a backend API key, with an Advanced Settings option for power users to provide their own Gemini key via `x-api-key` header.
- **Cloud Run Deployed** — Live and serving at: **https://promptwars-virtual-2026-178015878041.asia-south1.run.app**

---

## 🛠️ Tech Stack

| Service | Purpose |
|---|---|
| **Firebase Auth** | Google Login integration |
| **Gemini 1.5 Pro** | Core Logic Engine (adaptive explanations) |
| **Firestore** | State Persistence (user progress, knowledge state) |
| **Cloud Run** | Serverless deployment (asia-south1) |
| **Express.js** | Backend API server |
| **Jest** | Test framework with coverage enforcement |

---

## 📊 Test Coverage Report

```
--------------------|---------|----------|---------|---------|
File                | % Stmts | % Branch | % Funcs | % Lines |
--------------------|---------|----------|---------|---------|
All files           |   98.56 |    97.16 |     100 |   99.21 |
 confidenceScore.js |   96.96 |    96.66 |     100 |     100 |
 geminiAdapter.js   |     100 |    97.43 |     100 |     100 |
 knowledgeState.js  |      98 |    97.29 |     100 |   97.67 |
--------------------|---------|----------|---------|---------|
Test Suites: 6 passed, 6 total
Tests:       62 passed, 62 total
```

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run locally
npm start

# Run tests with coverage
npm run test:coverage
```

---

## 🏗️ Infrastructure

- **Server Entry Point**: `server/index.js`
- **Port Binding**: `0.0.0.0:process.env.PORT || 8080` (Cloud Run compatible)
- **Live URL**: https://promptwars-virtual-2026-178015878041.asia-south1.run.app

---

## 📁 Project Structure

```
├── MISSION_PRD.md              # Product Requirements Document
├── README.md                   # This file
├── package.json                # Dependencies & scripts
├── server/
│   ├── index.js                # Express server (Cloud Run entry point)
│   └── lib/
│       ├── confidenceScore.js  # Confidence score engine
│       ├── knowledgeState.js   # Knowledge state machine + hysteresis
│       └── geminiAdapter.js    # Gemini API adapter (BYOK support)
└── tests/
    ├── confidenceScore.test.js          # 14 core test cases
    ├── confidenceScore.coverage.test.js # 5 supplementary coverage tests
    ├── knowledgeState.test.js           # 16 core test cases
    ├── knowledgeState.coverage.test.js  # 11 supplementary coverage tests
    ├── geminiAdapter.test.js            # 8 core test cases
    └── geminiAdapter.coverage.test.js   # 8 supplementary coverage tests
```