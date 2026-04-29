# 👥 User Management Tool - Complete Guide

## Overview

The User Management Tool is a web-based interface for the **HOL USER ADMIN v0.3** collection, designed for managing Azure Active Directory users with Adobe IMS synchronization. This tool eliminates the need for Postman knowledge while providing all the same functionality through an intuitive web interface.

## 🎯 Purpose

This tool enables consultants and administrators to:
- Create lab users in Azure Entra ID (formerly Active Directory)
- Manage user passwords across groups
- Provision users with Adobe IMS integration
- Shutdown lab environments safely
- Manage user display names

## 🔐 Authentication Requirements

### Two Authentication Systems Required

#### 1. Adobe IMS Authentication (24-hour tokens)
- **Purpose**: Adobe Identity Management System integration
- **Duration**: 24 hours
- **Used for**: IMS user provisioning and product configurations

#### 2. Microsoft Azure Authentication (1-hour tokens)  
- **Purpose**: Azure Entra ID (Active Directory) operations
- **Duration**: 1 hour
- **Used for**: User creation, password resets, group management

> **Important**: Both tokens are required before any operations can be performed.

## 🏗️ Architecture

### Azure Entra ID Integration
- **App Resource ID**: Identifies the Azure Entra ID integration with Adobe IMS
- **App Role ID**: Defines the role for the Azure Entra ID integration with Adobe IMS
- **Tenant**: The IMS tenant name (e.g., `adobedemoamericas275`)

### Environments Available
- **MA1HOL**: Americas 275 environment (`ma1.aephandsonlabs.com`)
- **POT5HOL**: Americas POT5 environment (`pot5.aephandsonlabs.com`)

## 📋 How to Use the Web App

### Step 1: Configuration
1. **Select Environment**: Choose MA1HOL or POT5HOL
2. **Set Sandbox Name**: Enter your sandbox identifier (e.g., `sandbox99`)
3. **Configure Test Mode**: 
   - ✅ **Enabled**: Preview operations without executing
   - ❌ **Disabled**: Execute actual operations
4. **Session Management**: Name and save your configuration for reuse

### Step 2: Authentication
1. **Adobe IMS Login**: Click to authenticate with Adobe IMS (24-hour token)
2. **Microsoft Login**: Click to authenticate with Microsoft Azure (1-hour token)
3. **Status Verification**: Ensure both show "✅ Authenticated"

### Step 3: Operations

#### 👥 Create Lab Users

**Purpose**: Add new users to Azure Entra ID with Adobe IMS sync

**Required Fields**:
- **Group Name**: Following naming convention (Instance + Sandbox Slot)
  - Examples: `MA1HOL8`, `POT5HOL15`, `POT6HOL4`
- **Email Prefix**: Prefix for user email addresses
  - Examples: `hol8`, `pot5hol15`
- **Number of Users**: How many users to create (1-50)
- **Default Password**: Initial password for all users

**User Email Format**:
- Users created as: `{emailPrefix}u01@{domain}`, `{emailPrefix}u02@{domain}`, etc.
- Example: `hol8u01@ma1.aephandsonlabs.com`, `hol8u02@ma1.aephandsonlabs.com`

**Group Management**:
- If group doesn't exist, it will be created automatically
- No need to pre-create groups in IMS Admin Console

#### 🔑 Password Management

**Purpose**: Reset passwords for all users in a group

**Required Fields**:
- **Group Name**: Existing group name
- **New Lab Password**: Password to set for all users in the group

#### 🛑 Lab Shutdown

**Purpose**: Deactivate users and remove product configurations

**Required Fields**:
- **Group Name**: Group to shutdown

**Warning**: This will:
- Reset all user passwords to default
- Deactivate users (optional)
- Remove product configurations

## 📊 Understanding Results

### Test Mode Responses

#### Create Users (Test Mode)
- **`1_currentUserCount`**: Existing users matching your criteria
- **`2_createdUserCount`**: New users that would be created
- **`3_currentMaxUser`**: Highest existing user number (e.g., hol8**u16**)
- **`4_currentUsers`**: List of current users matching criteria
- **`5_proposedGroupAdd`**: Group that will be created (if new)
- **`6_proposedUserAdds`**: List of users that will be added
- **`9_NextSteps`**: Recommended next actions

#### Password Reset (Test Mode)
- **`1_currentUserCount`**: Users in the group
- **`2_proposedResets`**: Users whose passwords will be reset
- **`9_NextSteps`**: Recommended next actions

#### Lab Shutdown (Test Mode)
- **`1_currentUserCount`**: Users that will be affected
- **`2_proposedResets`**: Users that will be reset/deactivated
- **`9_NextSteps`**: Recommended next actions

### Production Mode Responses

#### Create Users (Production)
- **`1_groups`**: Groups that were created
- **`2_users`**: Users that were created
- **`9_NextSteps`**: Recommended next actions

#### Password Reset (Production)
- **`resetIds`**: List of users whose passwords were reset

#### Lab Shutdown (Production)  
- **`resetIds`**: List of users that were reset/deactivated

## 🎛️ Advanced Features

### Session Management
- **Auto-Save**: Configurations saved every 5 seconds
- **Named Sessions**: Save multiple configurations with custom names
- **Load/Delete**: Manage saved sessions easily

### Safety Features
- **Test Mode Default**: Always defaults to test mode for safety
- **Authentication Checks**: All operations disabled until authenticated
- **Status Indicators**: Clear visual feedback on authentication and readiness
- **Confirmation Warnings**: Especially for destructive operations like shutdown

## 📝 Best Practices

### Naming Conventions

#### Groups
Use format: **Instance + Sandbox Slot**
- ✅ Good: `MA1HOL8`, `POT5HOL15`, `POT6HOL4`
- ❌ Avoid: Random names that don't follow convention

#### Email Prefixes
Use sandbox slot names or descriptive prefixes:
- ✅ Good: `hol8`, `pot5hol15`, `ma1test`
- ❌ Avoid: Special characters or spaces

### Workflow Recommendations

1. **Always Test First**: Run operations in Test Mode before production
2. **Check Authentication**: Verify both tokens are valid and authenticated
3. **Review Results**: Carefully examine test mode results before proceeding
4. **Save Sessions**: Use session management for repeated operations
5. **Document Groups**: Keep track of group names and purposes

### Security Considerations

- **Token Expiry**: Microsoft tokens expire in 1 hour, Adobe IMS in 24 hours
- **Credential Rotation**: Be aware of when authentication needs renewal
- **Test Mode**: Use for all initial operations and verification
- **Audit Trail**: Results are logged for compliance and troubleshooting

## 🔧 Troubleshooting

### Common Issues

#### Authentication Failures
- **Symptom**: "Authentication Required" status
- **Solution**: Re-authenticate with the failing service
- **Check**: Ensure tokens haven't expired

#### User Creation Discrepancies
- **Symptom**: Seeing more users than requested (e.g., 30 vs 20)
- **Explanation**: `1_currentUserCount` shows total users (existing + new)
- **Look for**: `2_createdUserCount` for actual new users created

#### CORS Errors
- **Symptom**: Browser blocks requests
- **Solution**: App uses backend authentication actions to avoid CORS
- **Note**: Direct API calls from browser are not supported

#### Group Already Exists
- **Symptom**: Unexpected behavior when group exists
- **Solution**: Tool handles existing groups automatically
- **Check**: Review `5_proposedGroupAdd` in test mode

### Getting Help

1. **Check Results Tab**: Review detailed API responses
2. **Test Mode First**: Always run test mode to identify issues
3. **Authentication Status**: Verify both services are authenticated
4. **Session Management**: Try loading a fresh session
5. **Contact Support**: Include results data when reporting issues

## 🚀 Advanced Operations

### CJA Provisioning
Available through the Postman collection but not yet implemented in the web interface:
- Product configuration provisioning
- Role-based access management
- Custom user mappings

### Display Name Personalization
Available through the Postman collection:
- Custom display names for users
- Bulk display name updates
- User mapping operations

## 📖 API Reference

### Base Endpoints
- **User Creation**: `/api/v1/web/postmirror/waaduser`
- **Password Reset**: `/api/v1/web/postmirror/waadpass`
- **Lab Shutdown**: `/api/v1/web/postmirror/waadshutdown`
- **IMS Provisioning**: `/api/v1/web/postmirror/imsuser`
- **Display Names**: `/api/v1/web/postmirror/waaddisplay`

### Authentication Endpoints
- **Adobe IMS**: Custom backend action `adobe-auth`
- **Microsoft**: Custom backend action `microsoft-auth`

## 🏁 Quick Start Checklist

- [ ] Select correct environment (MA1HOL/POT5HOL)
- [ ] Configure sandbox name
- [ ] Enable Test Mode
- [ ] Authenticate with Adobe IMS
- [ ] Authenticate with Microsoft
- [ ] Verify both tokens show "✅ Authenticated"
- [ ] Fill in operation details
- [ ] Run in Test Mode first
- [ ] Review results carefully
- [ ] Disable Test Mode for production run
- [ ] Execute operation
- [ ] Verify results in Admin Console

---

*This tool replaces the need for Postman knowledge while maintaining all the functionality of the original HOL USER ADMIN v0.3 collection. For technical support or feature requests, contact the development team.* 