# MiniLedger

MiniLedger is a lightweight React Native application for tracking money lent to friends. It provides phone-based demo OTP login, loan management, repayment tracking, and an overdue summary.

## Features

- Phone number login with a mock OTP printed in the backend terminal.
- Add loans with a friend's name, amount, and due date.
- View loans and highlight overdue entries.
- Mark loans as repaid.
- Summary of total lent, total repaid, and overdue amounts.
- PostgreSQL persistence using Neon.
- Input validation for loan details.

## Tech Stack

- **Mobile:** React Native, Expo
- **Backend:** Node.js, Express, TypeScript
- **Database:** PostgreSQL (Neon)
- **Database driver:** node-postgres (`pg`)

## Prerequisites

- Node.js and npm
- PostgreSQL database on Neon
- Android Studio with an Android emulator
- Expo CLI through `npx expo`

## Setup

### 1. Clone the repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd miniledger
```

### 2. Configure the backend

```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory:

```env
DATABASE_URL="YOUR_NEON_POSTGRESQL_CONNECTION_STRING"
PORT=4000
```

Start the backend:

```bash
npm run dev
```

The API creates the required `loans` table at startup.

### 3. Start the mobile app

Open a second terminal:

```bash
cd mobile
npm install
npx expo start
```

Start an Android emulator and press `a` in the Expo terminal.

The app connects to the development computer through:

```text
http://10.0.2.2:4000/api
```

Keep the backend running while using the app.

## API Endpoints

| Method | Endpoint                 | Purpose                  |
| ------ | ------------------------ | ------------------------ |
| GET    | `/api/health`            | Check API status         |
| POST   | `/api/auth/request-otp`  | Generate demo OTP        |
| POST   | `/api/auth/verify-otp`   | Verify demo OTP          |
| GET    | `/api/loans?phone=...`   | List a user's loans      |
| POST   | `/api/loans`             | Create a loan            |
| PATCH  | `/api/loans/:id/repay`   | Mark a loan as repaid    |
| GET    | `/api/summary?phone=...` | Retrieve lending summary |

## Demo Login

Enter a valid phone number and request an OTP. The generated OTP appears in the backend terminal. Enter it in the app to continue.

## Limitations and Security Notes

This project is an assignment MVP. OTPs are stored in memory and are not delivered by SMS. Authentication is not production-grade, and the loan endpoints do not enforce authenticated sessions. Use only demo data.

The local development API uses HTTP. Production deployment requires HTTPS, secure authentication and authorization, rate limiting, and appropriate database connection security.

## Future Improvements

- Receipt image uploads
- Automated API tests
- Secure token-based authentication
- Improved date picker and form UX
- Production deployment and HTTPS

## Author

Created as a full-stack development internship assignment.
