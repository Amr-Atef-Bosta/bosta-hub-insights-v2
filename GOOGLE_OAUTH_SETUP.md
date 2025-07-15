# Google OAuth Setup Guide

This guide will help you set up Google OAuth authentication with MongoDB-based role mapping for the Bosta Insight Hub.

## ⚠️ Quick Fix for "Missing required parameter: redirect_uri" Error

If you're getting a "Missing required parameter: redirect_uri" error, it means your Google OAuth environment variables are not properly configured. Here's how to fix it:

### Immediate Fix:
1. Open your `.env` file
2. Replace these placeholder values:
   ```env
   GOOGLE_CLIENT_ID=your_google_client_id_here.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your_google_client_secret_here
   ```
   
3. **For development/testing only**, you can temporarily use demo login instead:
   - Go to `http://localhost:5173/login`
   - Use the "Demo Login" buttons (Admin, Leader, AM, Analyst)

### To properly configure Google OAuth:
1. Follow the complete setup steps below
2. Get real credentials from Google Cloud Console
3. Replace the placeholder values in your `.env` file

---

## Prerequisites

1. Google Workspace account with admin access
2. Google Cloud Console project
3. MongoDB database with users collection

## Step 1: Google Cloud Console Setup

### 1.1 Create OAuth 2.0 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project or create a new one
3. Navigate to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth 2.0 Client IDs**
5. Configure the OAuth consent screen if not already done
6. Set application type to **Web application**
7. Add authorized redirect URIs:
   - Development: `http://localhost:3000/api/auth/google/callback`
   - Production: Replace with your actual domain, e.g., `https://insight.bosta.co/api/auth/google/callback`
8. Save and note down the **Client ID** and **Client Secret**

### 1.2 Enable Required APIs

Enable the following APIs in your Google Cloud project:
- **Google+ API** (for basic user info)
- **Admin SDK API** (for organizational units - optional, not currently used)

## Step 2: MongoDB Setup

### 2.1 Users Collection Structure

Your MongoDB `users` collection should have documents with the following structure:

```json
{
  "_id": "ObjectId",
  "email": "user@bosta.co",
  "adminGroup": {
    "name": "ENGINEERING_DEVELOPER"
  },
  // ... other user fields
}
```

### 2.2 Role Mapping

The system maps `adminGroup.name` values to application roles as follows:

```typescript
'EXECUTIVES_MEMBER': 'admin',
'ENGINEERING_DEVELOPER': 'admin', 
'ACCOUNT_MANAGEMENT_MEMBER': 'am',
'ACCOUNT_MANAGEMENT_MANAGER': 'am',
'FINANCE_REVENUE_SUPERVISOR': 'analyst',
'OPERATIONS_DIRECTOR': 'leader'
```

**Default Role**: If `adminGroup.name` is not found in the mapping or doesn't exist, the user will be assigned the default role of `'am'`.

## Step 3: Environment Configuration

### 3.1 Development Environment

For development, update your `.env` file:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your_oauth_client_id
GOOGLE_CLIENT_SECRET=your_oauth_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
GOOGLE_DOMAIN=bosta.co

# MongoDB
MONGODB_URI=mongodb://localhost:27017/bosta-insights-hub
# OR for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/bosta-insights-hub

# Frontend URL for redirects
FRONTEND_URL=http://localhost:5173
```

### 3.2 Production Environment

For production, you need to define your actual domain in these environment variables:

```env
# Google OAuth - Production
GOOGLE_REDIRECT_URI=https://YOUR_ACTUAL_DOMAIN/api/auth/google/callback
FRONTEND_URL=https://YOUR_ACTUAL_DOMAIN

# MongoDB - Production
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/bosta-insights-hub

# Example for Bosta:
# GOOGLE_REDIRECT_URI=https://insight.bosta.co/api/auth/google/callback
# FRONTEND_URL=https://insight.bosta.co
```

**Important**: Replace `YOUR_ACTUAL_DOMAIN` with your real domain name.

## Step 4: OAuth Consent Screen

Configure the OAuth consent screen in Google Cloud Console:
1. Set **User Type** to **Internal** (for Workspace users only)
2. Add your domain(s)
3. Configure scopes:
   - `userinfo.email`
   - `userinfo.profile`
   - `admin.directory.group.readonly` (optional)
   - `cloud-platform.read-only` (optional)

## Step 5: Domain Configuration

### 5.1 Allowed Domains

The system only accepts users from these domains:
- `@bosta.co`
- `@bosta.email`

## Step 6: Database Migration

Run the database migration to add Google OAuth support:

```bash
# The migration will be applied automatically when the server starts
npm run dev:backend
```

The migration adds the following columns to the `users` table:
- `google_id` - Google user ID
- `avatar_url` - Profile picture URL
- `auth_provider` - Authentication method (email/google/demo)
- `org_unit` - Organizational unit from MongoDB
- `last_login` - Last login timestamp

## Step 7: Testing

### 7.1 Development Testing

1. Ensure MongoDB is running and contains user documents with `adminGroup.name` fields
2. Start the development servers:
   ```bash
   npm run dev
   ```

3. Navigate to `http://localhost:5173/login`
4. Click "Continue with Google"
5. Complete the OAuth flow
6. Verify user is created with correct role based on MongoDB lookup

### 7.2 Sample MongoDB Data

Insert sample user data for testing:

```javascript
// MongoDB shell or application
db.users.insertMany([
  {
    email: "admin@bosta.co",
    adminGroup: { name: "EXECUTIVES_MEMBER" }
  },
  {
    email: "developer@bosta.co", 
    adminGroup: { name: "ENGINEERING_DEVELOPER" }
  },
  {
    email: "manager@bosta.co",
    adminGroup: { name: "ACCOUNT_MANAGEMENT_MANAGER" }
  },
  {
    email: "analyst@bosta.co",
    adminGroup: { name: "FINANCE_REVENUE_SUPERVISOR" }
  }
]);
```

## Step 8: Authentication Flow

### 8.1 How It Works

1. User clicks "Continue with Google"
2. Google OAuth redirects to Google for authentication
3. User authenticates with Google Workspace
4. Google redirects back with authorization code
5. System exchanges code for user info (email, name, etc.)
6. System queries MongoDB `users` collection for user by email
7. System extracts `adminGroup.name` from user document
8. System maps `adminGroup.name` to application role using `ORG_UNIT_ROLE_MAPPING`
9. If mapping not found, assigns default role `'am'`
10. User is logged in with assigned role

### 8.2 Role Assignment Logic

```typescript
// Priority order:
1. If user found in MongoDB with adminGroup.name in mapping → use mapped role
2. If user found in MongoDB with adminGroup.name NOT in mapping → use 'am' role
3. If user NOT found in MongoDB → use 'am' role
4. If any error occurs → fallback to 'am' role
```

## Troubleshooting

### Common Issues

1. **"User must belong to an authorized domain"**
   - Ensure user's email ends with @bosta.co or @bosta.email
   - Check GOOGLE_DOMAIN environment variable

2. **"MONGODB_URI environment variable is not set"**
   - Ensure MONGODB_URI is properly configured in .env file
   - Verify MongoDB connection string is correct

3. **Users getting default 'am' role**
   - Check MongoDB users collection has documents with matching emails
   - Verify adminGroup.name field exists and has correct values
   - Check ORG_UNIT_ROLE_MAPPING for exact string matches

4. **OAuth redirect mismatch**
   - Verify redirect URI in Google Cloud Console matches exactly
   - Check GOOGLE_REDIRECT_URI environment variable
   - Ensure production domain matches what's configured in Google Cloud Console

### Logs

Monitor server logs for detailed information:
```bash
npm run dev:backend
```

Check for:
- MongoDB connection status
- User lookup results
- Role mapping decisions
- Google OAuth errors

## Security Considerations

1. **Environment Variables**: Never commit sensitive environment variables to version control
2. **MongoDB Security**: Use proper authentication and connection encryption
3. **Token Expiration**: JWT tokens expire after 7 days
4. **Domain Restriction**: Only users from authorized domains can authenticate
5. **Role Validation**: Roles are determined by MongoDB data, ensure data integrity

## API Endpoints

The following endpoints are available:

- `GET /api/auth/google` - Initiate Google OAuth flow
- `GET /api/auth/google/callback` - Handle OAuth callback
- `POST /api/auth/demo-login` - Demo login for testing
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/verify` - Verify JWT token

## Frontend Routes

- `/login` - Login page with Google OAuth button
- `/auth/callback` - OAuth callback handler
- `/chat` - Main application (requires authentication)

## Next Steps

1. Test the integration thoroughly in development
2. Configure production environment variables with your actual domain
3. Set up monitoring and logging
4. Train users on the new authentication flow
5. Consider implementing additional security measures like 2FA 