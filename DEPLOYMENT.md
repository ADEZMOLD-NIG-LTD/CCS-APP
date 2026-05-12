# 🚀 Deployment Checklist: Commodity Control System

Follow this guide to move your application from the AI Studio environment to your own production Firebase project and connect your Hostinger domain.

---

## 1. Prerequisites
- [ ] **Node.js & npm**: Installed on your local machine ([Download](https://nodejs.org/)).
- [ ] **Firebase CLI**: Installed globally.
  ```bash
  npm install -g firebase-tools
  ```
- [ ] **Firebase Account**: Access to the [Firebase Console](https://console.firebase.google.com/).
- [ ] **Hostinger Domain**: Access to your Hostinger DNS management panel.

---

## 2. Firebase Project Setup
- [ ] **Create Project**: Create a new project in the Firebase Console.
- [ ] **Enable Authentication**:
  - Go to **Build > Authentication**.
  - Click **Get Started**.
  - Enable **Google** as a Sign-in provider.
- [ ] **Enable Firestore**:
  - Go to **Build > Firestore Database**.
  - Click **Create Database**.
  - Choose **Enterprise Edition** (recommended for production).
  - Select a location close to your users (e.g., `europe-west2` for UK/Europe).
  - Start in **Production Mode**.
- [ ] **Create Web App**:
  - In Project Settings > General, click the `</>` icon to add a Web App.
  - Register the app (e.g., "Commodity Control System").
  - **Copy the `firebaseConfig` object** provided.

---

## 3. Local Environment Configuration
- [ ] **Download Source Code**: Export your code from AI Studio.
- [ ] **Install Dependencies**:
  ```bash
  npm install
  ```
- [ ] **Update Config**:
  - Open `firebase-applet-config.json`.
  - Replace the values with the ones from your **Firebase Web App** (Step 2).
  - **Crucial**: Ensure `firestoreDatabaseId` matches your database ID (usually `(default)` unless you named it differently).

---

## 4. Security Rules Deployment
- [ ] **Verify Rules**: Ensure `firestore.rules` contains the latest logic (including `SUSPENDED` and `DISMISSED` statuses).
- [ ] **Deploy Rules**:
  ```bash
  firebase deploy --only firestore:rules
  ```

---

## 5. Build & Hosting Deployment
- [ ] **Build the App**:
  ```bash
  npm run build
  ```
- [ ] **Initialize Hosting** (if not already done):
  ```bash
  firebase init hosting
  # Select "Use an existing project"
  # Public directory: dist
  # Configure as a single-page app: Yes
  # Set up automatic builds/deploys with GitHub: Optional
  ```
- [ ] **Deploy to Hosting**:
  ```bash
  firebase deploy --only hosting
  ```

---

## 6. Custom Domain (Hostinger)
- [ ] **Add Domain in Firebase**:
  - Go to **Build > Hosting**.
  - Click **Add Custom Domain**.
  - Enter your domain (e.g., `yourcompany.com`).
- [ ] **Update DNS in Hostinger**:
  - Log in to Hostinger > Domains > DNS / Nameservers.
  - Add the **A Records** provided by Firebase (usually two IP addresses).
  - Add the **TXT Record** if Firebase requires it for verification.
- [ ] **Wait for SSL**: Firebase will automatically provision an SSL certificate. This can take 10 minutes to a few hours.

---

## 7. Post-Deployment Verification
- [ ] **Login Test**: Verify you can sign in with Google.
- [ ] **Firestore Test**: Create a test staff member and verify it appears in the database.
- [ ] **Status Test**: Verify you can "Suspend" or "Dismiss" a staff member without permission errors.
- [ ] **Responsive Test**: Check the app on mobile and desktop via the custom domain.

---

## 8. CI/CD & Environment Isolation
The application is configured with a multi-environment CI/CD pipeline using GitHub Actions.

### Branch Mapping
- **`main`**: Deploys to **Production**.
- **`staging`**: Deploys to **Staging**.
- **`develop`**: Deploys to **Development**.

### Setup Environment Secrets
In your GitHub Repository, go to **Settings > Secrets and variables > Actions** and add the following secrets for each environment (using GitHub Environments is recommended):
- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`
- `FIREBASE_FIRESTORE_DATABASE_ID`
- `FIREBASE_SERVICE_ACCOUNT` (JSON from Google Cloud Console Service Account)
- `GEMINI_API_KEY`

### Multi-Project Configuration
If you use separate Firebase projects for each environment, update `.firebaserc`:
```json
{
  "projects": {
    "production": "commodity-prod-123",
    "staging": "commodity-staging-456",
    "development": "commodity-dev-789"
  }
}
```

---

## 🛠 Troubleshooting
- **"Missing or insufficient permissions"**: Check if your `firestore.rules` were deployed correctly.
- **"Firebase Config Error"**: Double-check `firebase-applet-config.json` for typos.
- **"Domain Not Found"**: DNS propagation can take time. Use [DNSChecker.org](https://dnschecker.org) to verify.
