<div align="center">
  <br />
  <img src="public/logo.png" alt="WhatsFire Logo" width="200"/>
  <h1>WhatsFire</h1>
  <h3>A feature-rich WhatsApp clone built with Next.js and Firebase</h3>
</div>

## Features

WhatsFire is a powerful messaging application inspired by WhatsApp, offering a comprehensive set of features:

- **Real-time Messaging** - Send and receive messages instantly
- **Responsive Design** - Works seamlessly across desktop and mobile devices
- **User Authentication** - Secure login with Google
- **Audio & Video Calling** - Make high-quality video and voice calls
- **Online Presence** - See when users are online or their last seen time
- **Read Receipts** - Track when messages are delivered and read
- **Media Sharing** - Send images and files easily
- **Group Chats** - Create and manage group conversations
- **Status Updates** - Share temporary updates with your contacts

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm or yarn
- A Firebase project

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/sanjaysunil/whatsfire.git
   cd whatsfire
   ```

2. **Install dependencies**

   ```bash
   npm install
   # or
   yarn install
   ```

3. **Set up Firebase**

   - Create a new Firebase project at [firebase.google.com](https://firebase.google.com)
   - Enable Authentication (Google provider)
   - Create Firestore Database
   - Create Realtime Database
   - Set up Storage
   - Go to Project Settings > Your Apps > Web and register a new web app

4. **Configure environment variables**

   - Copy the `.env.local.example` file to `.env.local`
   ```bash
   cp env.local.example .env.local
   ```
   - Fill in your Firebase configuration details in `.env.local`

5. **Run the development server**

   ```bash
   npm run dev
   # or
   yarn dev
   ```

   Open [http://localhost:3000](http://localhost:3000) to see your app in action!

## Key Components

### Real-time Chat

The application uses Firebase Firestore for real-time message synchronization, ensuring instant delivery and updates.

### User Presence System

WhatsFire implements a sophisticated online presence system that shows when users are active and tracks their last seen time.

### End-to-End Encryption (Simulated)

While this is a demo application, it includes simulated end-to-end encryption to demonstrate how real messaging apps protect user privacy.

### WebRTC Video & Audio Calls

Leveraging WebRTC technology and Firebase for signaling, WhatsFire enables high-quality peer-to-peer audio and video calls.

## Project Structure

```
whatsfire/
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/       # Reusable UI components
│   ├── context/          # React Context for state management
│   └── lib/              # Utility functions and Firebase setup
├── public/               # Static files
└── ...config files
```

## Technologies Used

- **Frontend**
  - Next.js 14
  - React
  - TypeScript
  - Tailwind CSS
  - shadcn/ui

- **Backend & Infrastructure**
  - Firebase Authentication
  - Firestore Database
  - Firebase Realtime Database
  - Firebase Storage
  - Firebase Cloud Messaging

- **Real-time Communication**
  - WebRTC
  - Firebase for signaling

## License

This project is licensed under the MIT License - see the LICENSE file for details.