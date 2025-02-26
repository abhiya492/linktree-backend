# Linktree Backend with Referral System

This is a backend implementation for a Linktree-like service with a built-in referral system, user authentication, and rewards.

## Features

- User registration and authentication
- JWT-based authentication
- Secure password handling (bcrypt)
- Referral system with unique codes
- Rewards for successful referrals
- Password reset with email verification
- Rate limiting for sensitive endpoints
- CSRF protection
- Caching for improved performance
- Comprehensive test suite

## API Endpoints

### Authentication

- `POST /api/register` - Register a new user
- `POST /api/login` - Authenticate user
- `POST /api/forgot-password` - Request password reset
- `POST /api/reset-password` - Reset password with token

### Referrals

- `GET /api/referrals` - Get list of referrals made by the user
- `GET /api/referral-stats` - Get statistics about user's referrals

### Rewards

- `GET /api/rewards` - Get user's rewards

### Security

- `GET /api/csrf-token` - Get CSRF token for secure form submission

## Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Set up environment variables in `.env`:
   ```
   DATABASE_URL="postgresql://username:password@localhost:5432/linktree"
   JWT_SECRET="your-secret-key"
   EMAIL_USER="your-email@gmail.com"
   EMAIL_PASS="your-email-password"
   FRONTEND_URL="http://localhost:3001"
   NODE_ENV="development"
   ```
4. Run database migrations:
   ```
   npx prisma migrate dev
   ```
5. Start the server:
   ```
   npm start
   ```

## Testing

Run the test suite:

```
npm test
```

## Database Schema

### Users
- id (PK)
- email (unique)
- username (unique)
- password_hash
- referral_code (unique)
- created_at

### Referrals
- id (PK)
- referrer_id (FK -> Users.id)
- referred_user_id (FK -> Users.id)
- date_referred
- status (pending, successful, expired)

### Rewards
- id (PK)
- user_id (FK -> Users.id)
- amount
- description
- created_at

## Security Features

- Password hashing with bcrypt
- JWT tokens for authentication
- CSRF protection
- Rate limiting
- Secure cookies
- Input validation
- Error handling

## Packages Used

- Express - Web framework
- Prisma - ORM for database access
- jsonwebtoken - JWT authentication
- bcryptjs - Password hashing
- express-validator - Input validation
- express-rate-limit - Rate limiting
- nodemailer - Email sending
- jest, supertest - Testing
- node-cache - Caching
- helmet - Security headers
- cors - Cross-Origin Resource Sharing