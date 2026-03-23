# (CCS) Commodity Control System

Commodity Control System (CCS) by Adezmold Business Consulting. Manage cocoa, cashew, and palm kernel operations.

## Features

- **Inventory Management**: Track stock across multiple warehouses.
- **Supplier Management**: Manage supplier relationships and transactions.
- **Financial Tracking**: Monitor payments, journal entries, and financial health.
- **Staff Management**: Role-based access control for staff, auditors, and accountants.
- **Reporting**: Generate PDF reports for inventory, transactions, and more.
- **Training Mode**: A secure demo environment for staff training.

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS, Lucide Icons, Motion.
- **Backend**: Firebase (Firestore, Authentication).
- **Visualization**: Recharts.
- **PDF Generation**: jsPDF.

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- A Firebase project

### Setup

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd <repository-directory>
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Firebase**:
   - Create a new project in the [Firebase Console](https://console.firebase.google.com/).
   - Enable **Firestore Database** and **Authentication** (Google Sign-in and Anonymous Auth).
   - You can configure Firebase in two ways:
     - **Option A (Recommended for Local Dev)**: Create a `firebase-applet-config.json` file in the root directory based on the `firebase-applet-config.example.json` template.
     - **Option B (Recommended for CI/CD/GitHub)**: Set environment variables in your `.env` file or deployment environment (prefixed with `VITE_` as shown in `.env.example`).

4. **Environment Variables**:
   - Create a `.env` file based on `.env.example`.
   - Add your `GEMINI_API_KEY` if you plan to use AI features.

5. **Deploy Firestore Rules**:
   - Copy the content of `firestore.rules` and deploy it to your Firestore instance via the Firebase Console or CLI.

6. **Run the development server**:
   ```bash
   npm run dev
   ```

## Roles and Permissions

- **Super Admin**: Full system access, company approval.
- **Admin**: Company-level management, staff registration.
- **Accountant**: Financial records, payments, journal entries.
- **Auditor**: Read-only access to financial and inventory data.
- **Staff**: Basic operations (inventory, transactions).

## Deployment

To build the project for production:
```bash
npm run build
```
The output will be in the `dist/` directory.

## License

This project is private and proprietary.
