# Firebase Setup Guide

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Name it "outfit-generator" (or any name you like)
4. Disable Google Analytics (or enable if you want)
5. Click "Create project"

## Step 2: Enable Authentication

1. In your Firebase project, click "Authentication" in the left menu
2. Click "Get started"
3. Click on "Email/Password" under Sign-in providers
4. Enable it and click "Save"

## Step 3: Enable Firestore Database

1. Click "Firestore Database" in the left menu
2. Click "Create database"
3. Choose "Start in production mode"
4. Select a location closest to you
5. Click "Enable"

### Set Firestore Rules

Click on "Rules" tab and paste this:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // User documents
    match /users/{userId} {
      allow read: if true; // Anyone can read to view shared closets
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Username mappings
    match /usernames/{username} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

Click "Publish"

## Step 4: Enable Storage

1. Click "Storage" in the left menu
2. Click "Get started"
3. Use default rules for now
4. Click "Done"

### Set Storage Rules

Click on "Rules" tab and paste this:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /clothes/{userId}/{allPaths=**} {
      allow read: if true; // Anyone can read to view shared closets
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Click "Publish"

## Step 5: Get your Firebase Config

1. Click on the gear icon (⚙️) next to "Project Overview"
2. Click "Project settings"
3. Scroll down to "Your apps"
4. Click the Web icon `</>`
5. Register your app with nickname "outfit-generator-web"
6. Copy the `firebaseConfig` object

## Step 6: Update firebase-config.js

Open `docs/firebase-config.js` and replace the config values:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

## Step 7: Deploy to GitHub Pages

1. Commit and push your changes
2. Your site will be live!

## Usage

### For Users:
1. Go to `https://YOUR_USERNAME.github.io/outfits/auth.html`
2. Sign up with email/password and choose a username
3. Upload your clothes at `/upload.html`
4. View your personalized outfit generator at `/`
5. Share your closet with: `https://YOUR_USERNAME.github.io/outfits/?user=YOUR_USERNAME`

### URLs:
- **Login/Signup**: `/auth.html`
- **Upload clothes**: `/upload.html`
- **Your generator**: `/` or `/?user=YOUR_USERNAME`
- **Share closet**: `/?user=THEIR_USERNAME`

That's it! Your outfit generator now supports multiple users! 🎉

