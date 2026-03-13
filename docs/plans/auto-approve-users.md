# Auto-Approve Trusted Users — Implementation Plan

> **GitHub Issue**: #55
> **Goal**: Allow admins to designate certain users as "trusted" so their requests are automatically approved and sent to Radarr/Sonarr without waiting in the admin queue.

---

## Table of Contents

1. [Backend: UserPreferences Table](#1-backend-userpreferences-table)
2. [Backend: Admin User Management Endpoints](#2-backend-admin-user-management-endpoints)
3. [Backend: Auto-Approve on Request Creation](#3-backend-auto-approve-on-request-creation)
4. [Shared Types](#4-shared-types)
5. [Frontend: Admin Users Page](#5-frontend-admin-users-page)
6. [Frontend: Auto-Approve Badge](#6-frontend-auto-approve-badge)
7. [Frontend: Navigation Update](#7-frontend-navigation-update)

---

## 1. Backend: UserPreferences Table

### 1a. DynamoDB Table

**File**: `backend/serverless.yml`

Add a new table under `resources.Resources`:

```yaml
UserPreferencesTable:
  Type: AWS::DynamoDB::Table
  Properties:
    TableName: ${self:service}-${self:provider.stage}-user-preferences
    BillingMode: PAY_PER_REQUEST
    AttributeDefinitions:
      - AttributeName: userId
        AttributeType: S
    KeySchema:
      - AttributeName: userId
        KeyType: HASH
```

Add environment variable:
```yaml
USER_PREFERENCES_TABLE: ${self:service}-${self:provider.stage}-user-preferences
```

Add IAM permissions for the new table (GetItem, PutItem, Scan).

### 1b. DynamoDB Helper

**File**: `backend/lib/dynamodb.ts`

Export the new table name:
```typescript
export const USER_PREFERENCES_TABLE = process.env.USER_PREFERENCES_TABLE!;
```

---

## 2. Backend: Admin User Management Endpoints

### 2a. `GET /admin/users` (admin only)

**File**: `backend/functions/admin/users/list.ts` (new)

**Logic**:
1. Call Cognito `ListUsers` to get all registered users (email, sub, status, created date).
2. Scan `UserPreferencesTable` to get auto-approve flags.
3. For each Cognito user, look up their request count from the Requests table (query UserIndex GSI, count only).
4. Merge into a response: `{ users: AdminUser[] }`.

**Note**: Cognito `ListUsers` has a default limit of 60; use pagination token if needed. For a small user base this is fine.

**IAM**: Needs `cognito-idp:ListUsers` permission (already partially present in serverless.yml for `AdminGetUser`).

### 2b. `PUT /admin/users/:userId/auto-approve` (admin only)

**File**: `backend/functions/admin/users/updateAutoApprove.ts` (new)

**Body**: `{ autoApprove: boolean }`

**Logic**:
1. Validate the userId exists in Cognito (call `AdminGetUser`).
2. Put/update item in `UserPreferencesTable` with `{ userId, autoApprove, updatedAt }`.
3. Return the updated preference.

### 2c. Serverless Configuration

**File**: `backend/serverless.yml`

```yaml
  adminListUsers:
    handler: functions/admin/users/list.handler
    events:
      - httpApi:
          path: /admin/users
          method: GET
          authorizer:
            name: jwtAuthorizer

  adminUpdateAutoApprove:
    handler: functions/admin/users/updateAutoApprove.handler
    events:
      - httpApi:
          path: /admin/users/{userId}/auto-approve
          method: PUT
          authorizer:
            name: jwtAuthorizer
```

---

## 3. Backend: Auto-Approve on Request Creation

### 3a. Modified Request Creation

**File**: `backend/functions/requests/create.ts`

After the existing duplicate check and before inserting the request, add:

```typescript
// Check if user has auto-approve enabled
const userPref = await getItem({
  TableName: USER_PREFERENCES_TABLE,
  Key: { userId: user.userId },
});

let initialStatus: RequestStatus = 'requested';
let autoApproved = false;
let integrationIds: { radarrId?: number; sonarrId?: number } = {};

if (userPref?.autoApprove) {
  try {
    // Reuse the same handleApproval logic from updateStatus.ts
    // Extract handleApproval into a shared module first
    integrationIds = await handleApproval(requestData);
    initialStatus = 'approved';
    autoApproved = true;
  } catch (error) {
    // If integration fails, fall back to manual approval
    console.error('Auto-approve integration failed, falling back to manual:', error);
    initialStatus = 'requested';
    // Optionally set adminNote with failure reason
  }
}
```

### 3b. Extract Shared Approval Logic

**File**: `backend/lib/approval.ts` (new)

Move the `handleApproval` function and `getServiceSetting` helper from `updateStatus.ts` into a shared module so both `create.ts` and `updateStatus.ts` can use it.

```typescript
// backend/lib/approval.ts
export async function handleApproval(request: MediaRequest): Promise<{ radarrId?: number; sonarrId?: number }> {
  // Same logic currently in updateStatus.ts
}
```

Update `updateStatus.ts` to import from `backend/lib/approval.ts` instead of having it inline.

### 3c. New Field on MediaRequest

**File**: `backend/types/index.ts`

Add to `MediaRequest`:
```typescript
autoApproved?: boolean;
```

---

## 4. Shared Types

### Backend types

**File**: `backend/types/index.ts`

```typescript
/** User preferences stored in UserPreferences table */
export interface UserPreference {
  userId: string;
  autoApprove: boolean;
  updatedAt: string;
}

/** Admin view of a user (merged from Cognito + UserPreferences + request stats) */
export interface AdminUser {
  userId: string;
  email: string;
  status: string;           // Cognito user status (CONFIRMED, etc.)
  autoApprove: boolean;
  requestCount: number;
  createdAt: string;        // Cognito create date
}
```

### Frontend types

**File**: `frontend/src/types/index.ts`

Mirror `AdminUser` interface. Add `autoApproved?: boolean` to `MediaRequest`.

---

## 5. Frontend: Admin Users Page

**File**: `frontend/src/pages/admin/UsersPage.tsx` (new)

### Layout

- Page title: "Users"
- Table with columns: Email, Status, Requests, Auto-Approve, Joined
- Auto-Approve column: toggle switch (shadcn Switch component)
- Confirmation dialog when toggling: "Enable auto-approve for user@example.com? Their future requests will skip the approval queue."

### API Service

**File**: `frontend/src/services/api.ts`

Add to `admin` namespace:

```typescript
users: {
  list: () => request<{ users: AdminUser[] }>('/admin/users'),

  updateAutoApprove: (userId: string, autoApprove: boolean) =>
    request<UserPreference>(`/admin/users/${userId}/auto-approve`, {
      method: 'PUT',
      body: JSON.stringify({ autoApprove }),
    }),
},
```

---

## 6. Frontend: Auto-Approve Badge

### Request Card

**File**: `frontend/src/components/RequestCard.tsx`

When `request.autoApproved === true`, show a small badge or icon next to the status badge:
- Lightning bolt icon (Lucide `Zap`) with tooltip "Auto-approved"
- Differentiate from admin-approved visually

### Admin Request Queue

**File**: `frontend/src/pages/admin/RequestQueuePage.tsx`

Same badge in the admin view. Helps admins see which requests were auto-approved.

---

## 7. Frontend: Navigation Update

### Admin Sidebar

**File**: `frontend/src/components/AdminLayout.tsx` (or equivalent)

Add "Users" link between "Issues" and "Settings" in the admin sidebar navigation.

### App.tsx

Add route:
```tsx
<Route path="/admin/users" element={<UsersPage />} />
```

---

## Security Considerations

- Only admins can view/modify auto-approve settings (enforced by `requireAdmin`)
- Auto-approve still validates that Radarr/Sonarr are configured before approving
- If integration fails during auto-approve, request falls back to `requested` status — nothing is silently lost
- Auto-approved requests are auditable via the `autoApproved` field
- Revoking auto-approve takes immediate effect (next request uses normal flow)

---

## Implementation Order

1. DynamoDB UserPreferences table (serverless.yml + dynamodb.ts)
2. Backend types (UserPreference, AdminUser)
3. Extract `handleApproval` into shared `lib/approval.ts`
4. `GET /admin/users` endpoint
5. `PUT /admin/users/:userId/auto-approve` endpoint
6. Modify `POST /requests` to check auto-approve
7. Add `autoApproved` field to MediaRequest type
8. Frontend types + API service
9. Admin Users page
10. Auto-approve badge on request cards
11. Admin nav + routing update
12. Deploy + test
