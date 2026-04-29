# Access Control Guide

This guide explains how to configure and use the access control system for the Americas275 Environment Management App.

## Overview

The access control system allows you to control access to specific features based on user email addresses using a **whitelist approach**. Currently, it supports controlling access to:

1. **User Management** - The User Management tab and component
2. **Admin Features** - All administrative features (future use)

## How It Works

The system uses a **whitelist approach** - only users whose email addresses are explicitly listed will have access to protected features. By default, all users are denied access unless they are specifically allowed.

## Configuration

### Adding Allowed Users for User Management

To allow users to access User Management, edit the `src/dx-excshell-1/web-src/src/utils/accessControl.js` file:

```javascript
// List of email addresses that are ALLOWED to access User Management
// Only users in this list will see the User Management tab
const ALLOWED_USER_MANAGEMENT_EMAILS = [
  'jmagana@adobe.com',
  'admin1@example.com',
  'admin2@example.com',
  // Add more allowed emails as needed
]
```

### Adding Allowed Users for Admin Features

To allow users to access all admin features, edit the same file:

```javascript
// List of email addresses that are ALLOWED to access all admin features
// Only users in this list will see admin features
const ALLOWED_ADMIN_EMAILS = [
  'jmagana@adobe.com',
  'superadmin@example.com',
  // Add more admin-allowed emails as needed
]
```

## Access Control Behavior

1. **Navigation Protection**: The User Management tab is only visible to users in the allowed list
2. **Route Protection**: Direct URL access to `/UserManagement` is blocked for non-allowed users and redirects to home
3. **Debug Information**: The home page shows the current user's email and access status
4. **Default Denial**: If a user's email is not in the allowed list, access is denied

## Debug Information

When you load the app, you'll see a debug section on the home page that displays:
- Your email address (from IMS profile)
- Whether you have access to User Management
- Access control status

## Console Logging

The system logs access control information to the browser console:
- User email
- Access permissions
- Allowed email lists
- Access denial reasons

## Adding New Protected Features

To protect additional features:

1. Add a new function to `accessControl.js`:
```javascript
export const hasFeatureAccess = (ims) => {
  if (!ims?.profile?.email) {
    return false
  }
  
  const userEmail = ims.profile.email.toLowerCase()
  const ALLOWED_FEATURE_EMAILS = [
    'user1@example.com',
    'user2@example.com'
  ]
  
  return ALLOWED_FEATURE_EMAILS.includes(userEmail)
}
```

2. Use it in your component:
```javascript
import { hasFeatureAccess } from '../utils/accessControl'

// In your JSX
{hasFeatureAccess(ims) && (
  <YourProtectedComponent />
)}
```

3. Add route protection in `App.js`:
```javascript
<ProtectedRoute 
  path="/YourFeature" 
  component={YourComponent} 
  runtime={props.runtime} 
  ims={props.ims} 
/>
```

## Security Notes

- Email addresses are compared case-insensitively
- If no email is found in the IMS profile, access is denied by default
- The system uses a whitelist approach - only explicitly allowed users have access
- The system logs all access control decisions for debugging
- Direct URL access is protected through route guards

## Testing

To test the access control:

1. **Test with allowed user**:
   - Add your email to the `ALLOWED_USER_MANAGEMENT_EMAILS` list
   - Refresh the app
   - Verify the User Management tab is visible
   - Navigate to `/UserManagement` - you should have access

2. **Test with non-allowed user**:
   - Remove your email from the `ALLOWED_USER_MANAGEMENT_EMAILS` list
   - Refresh the app
   - Verify the User Management tab is hidden
   - Try to navigate directly to `/UserManagement` - you should be redirected to home
   - Check the console for access control logs

## Current Configuration

The system is currently configured with:
- **User Management Access**: Only `jmagana@adobe.com`, `admin1@example.com`, and `admin2@example.com` have access
- **Admin Access**: Only `jmagana@adobe.com` and `superadmin@example.com` have access

To modify these lists, edit the `accessControl.js` file and update the email arrays as needed 