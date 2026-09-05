/* ============================================================
   firebase-config.js — YOUR Firebase project credentials

   This file is what turns on Login + Cross-Device Sync + Cloud Backup.
   Without filling this in, the app works exactly as before: fully
   offline, local storage only, no login screen shown.

   HOW TO GET THESE VALUES (~10 minutes, free, no credit card):
   1. Go to https://console.firebase.google.com and sign in with any
      Google account.
   2. Click "Add project", give it any name (e.g. "boq-tracker"), and
      finish the wizard (you can turn off Google Analytics, not needed).
   3. In the left sidebar: Build -> Authentication -> Get Started ->
      enable the "Email/Password" sign-in method.
   4. In the left sidebar: Build -> Firestore Database -> Create database
      -> Start in production mode -> pick any region close to you.
   5. Go to Project Settings (gear icon, top left) -> scroll to
      "Your apps" -> click the </> (web) icon -> register the app (any
      nickname) -> it shows a `firebaseConfig` object. Copy those 6
      values into the object below, replacing the YOUR_... placeholders.
   6. In Firestore -> Rules tab, paste this and click Publish, so each
      person can only read/write their own data:

        rules_version = '2';
        service cloud.firestore {
          match /databases/{database}/documents {
            match /users/{userId}/{document=**} {
              allow read, write: if request.auth != null && request.auth.uid == userId;
            }
          }
        }

   That's it — reload the app and you'll see a Sign Up option under
   More -> Cloud Backup & Sync.
   ============================================================ */

window.FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};
