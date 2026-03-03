# Features V2 — Plan

> Five new features for the Plex Request app.

---

## Table of Contents

1. [Feature 1: TV Season Selection](#feature-1-tv-season-selection)
2. [Feature 2: Email Notifications on Status Change](#feature-2-email-notifications-on-status-change)
3. [Feature 3: Auto-Refresh Requests Page](#feature-3-auto-refresh-requests-page)
4. [Feature 4: Redirect to Login on Token Expiry](#feature-4-redirect-to-login-on-token-expiry)
5. [Feature 5: Report Media Issue](#feature-5-report-media-issue)

---

## Feature 1: TV Season Selection

**Goal**: When requesting a TV show, let users choose specific season(s) instead of requesting the entire series.

### Current Behavior

- User searches for a TV show, clicks "Request This Title", confirms — the entire series is added to Sonarr with all seasons monitored.
- `MediaSearchResult` has no season information.
- `MediaRequest` has no season field.
- `sonarr.addSeries()` sets `monitored: true` on every season.

### Changes Required

#### Backend

**1. Search API — return season count for TV results**

File: `backend/functions/search/search.ts`

- When normalizing Sonarr lookup results, include the `seasons` array from the Sonarr response.
- Add to the normalized search result: `seasonCount: number` and `seasons: Array<{ seasonNumber: number }>` (exclude specials/season 0 from the selectable list, but still include it for display).

**2. Types — add seasons to request model**

File: `backend/types/index.ts`

- Add to `MediaRequest`:
  ```typescript
  seasons?: number[];  // e.g. [1, 3, 4] — undefined means "all seasons"
  ```

File: `frontend/src/types/index.ts`

- Mirror the change: add `seasons?: number[]` to `MediaRequest`.
- Add to `MediaSearchResult`:
  ```typescript
  seasonCount?: number;
  seasons?: Array<{ seasonNumber: number }>;
  ```

**3. Request creation — accept and store seasons**

File: `backend/functions/requests/create.ts`  (or wherever create lives)

- Accept optional `seasons: number[]` in the request body.
- Validate that each season number is a positive integer.
- Store the array on the DynamoDB item (undefined = all seasons).

**4. Sonarr client — selective season monitoring**

File: `backend/lib/integrations/sonarr.ts`

- Change `addSeries()` signature:
  ```typescript
  async function addSeries(
    config: SonarrConfig,
    tvdbId: number,
    qualityProfileId: number,
    rootFolderPath: string,
    monitoredSeasons?: number[]   // NEW — undefined means all
  ): Promise<SonarrSeries>
  ```
- In the POST body, map seasons:
  ```typescript
  seasons: series.seasons?.map((s) => ({
    ...s,
    monitored: monitoredSeasons
      ? monitoredSeasons.includes(s.seasonNumber)
      : true,
  })) ?? [],
  ```

**5. Approval flow — pass seasons through**

File: `backend/functions/admin/requests/updateStatus.ts`

- In `handleApproval()`, when calling `sonarr.addSeries()`, pass `request.seasons` as the new parameter.

#### Frontend

**6. Media detail page — season picker for TV shows**

File: `frontend/src/pages/MediaDetailPage.tsx`

- When `media.mediaType === 'tv'` and `media.seasons` exists, render a season selection UI inside the confirm dialog:
  - A "Select All" toggle (default: on).
  - A list of checkboxes, one per season (e.g. "Season 1", "Season 2", ...).
  - At least one season must be selected to enable the Confirm button.
- Pass the selected season numbers in the `requestsApi.create()` call.

**7. API client — pass seasons**

File: `frontend/src/services/api.ts`

- Add `seasons?: number[]` to the `create` payload type.

**8. Request display — show selected seasons**

Files: `frontend/src/pages/RequestsPage.tsx`, `frontend/src/pages/admin/RequestQueuePage.tsx`

- If `request.seasons` is set, display "Seasons 1, 3, 4" or similar below the title. If undefined, show "All Seasons".

---

## Feature 2: Email Notifications on Status Change

**Goal**: Notify users via email when their request status changes (approved, rejected, downloading, complete).

### Approach: AWS SES (Simple Email Service)

SES is the natural fit — it's serverless, pay-per-email, and integrates natively with Lambda. No new infrastructure beyond SES verification.

### Changes Required

#### Infrastructure

**1. SES identity verification**

- Verify a sender address (e.g. `noreply@jpdxsolo.com`) or the domain `jpdxsolo.com` in SES.
- If still in the SES sandbox, verify recipient addresses for testing, or request production access.

**2. IAM permissions**

File: `backend/serverless.yml`

- Add `ses:SendEmail` permission to the Lambda role:
  ```yaml
  - Effect: Allow
    Action:
      - ses:SendEmail
      - ses:SendRawEmail
    Resource: "arn:aws:ses:us-east-1:435238036810:identity/*"
  ```
- Add environment variable: `SENDER_EMAIL: noreply@jpdxsolo.com`

#### Backend

**3. Email helper module**

New file: `backend/lib/email.ts`

- Use `@aws-sdk/client-ses` (`SESClient`, `SendEmailCommand`).
- Export a function:
  ```typescript
  async function sendStatusChangeEmail(params: {
    recipientEmail: string;
    title: string;
    mediaType: 'movie' | 'tv';
    oldStatus: RequestStatus;
    newStatus: RequestStatus;
    adminNote?: string;
  }): Promise<void>
  ```
- Build an HTML email with the media title, new status, and optional admin note.
- Include a text fallback.

**4. Trigger email on status update**

File: `backend/functions/admin/requests/updateStatus.ts`

- After the status update succeeds, call `sendStatusChangeEmail()`.
- The recipient email is `request.userName` (which is the user's email from Cognito).
- Wrap in try/catch — email failure should log an error but NOT fail the status update.

**5. Email opt-out (optional, future consideration)**

- For V2 launch, all users get emails. A future iteration could add a user preferences table with an `emailNotifications` toggle.

---

## Feature 3: Auto-Refresh Requests Page

**Goal**: The user's "My Requests" page refreshes data every 5 minutes so status changes appear without manual reload.

### Changes Required

#### Frontend

**1. Polling hook**

File: `frontend/src/hooks/usePolling.ts` (new)

```typescript
import { useEffect, useRef } from 'react';

export function usePolling(callback: () => void, intervalMs: number, enabled = true) {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => savedCallback.current(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
}
```

**2. Apply to Requests page**

File: `frontend/src/pages/RequestsPage.tsx`

- Import `usePolling`.
- Call `usePolling(fetchRequests, 5 * 60 * 1000)` where `fetchRequests` is the existing data-fetch function.
- Optionally show a subtle "Last updated: X" timestamp so the user knows data is fresh.

**3. Apply to Admin Request Queue**

File: `frontend/src/pages/admin/RequestQueuePage.tsx`

- Same pattern — poll every 5 minutes.

---

## Feature 4: Redirect to Login on Token Expiry

**Goal**: When an API call returns 401 (expired/invalid token), automatically log the user out and redirect to `/login` with a message.

### Changes Required

#### Frontend

**1. Detect 401 in API client**

File: `frontend/src/services/api.ts`

- In the `request()` function, before throwing on non-OK responses, check for status 401:
  ```typescript
  if (response.status === 401) {
    // Attempt token refresh first
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      try {
        const tokens = await authApi.refresh(refreshToken);
        localStorage.setItem('idToken', tokens.idToken);
        localStorage.setItem('accessToken', tokens.accessToken);
        // Retry the original request with new token
        return retryRequest(path, options);
      } catch {
        // Refresh failed — force logout
      }
    }
    // Clear tokens and redirect
    localStorage.removeItem('idToken');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.href = '/login?expired=true';
    throw new Error('Session expired');
  }
  ```

**2. Login page — show expiry message**

File: `frontend/src/pages/LoginPage.tsx`

- Check for `?expired=true` query param on mount.
- If present, show a toast or inline message: "Your session has expired. Please log in again."

**3. Prevent infinite retry loops**

- Add a flag (e.g. `let isRefreshing = false`) in the API module to prevent multiple concurrent refresh attempts.
- If a refresh is already in progress, queue the request or reject immediately.

---

## Feature 5: Report Media Issue

**Goal**: Users can search for a movie or TV show episode that already exists in their Plex library and report an issue with it (wrong language, corrupt file, etc.).

### Data Model

#### New DynamoDB Table: `MediaIssues`

| Attribute | Type | Description |
|-----------|------|-------------|
| `issueId` | String (PK) | UUID |
| `userId` | String | Cognito user sub |
| `userName` | String | User's email |
| `mediaType` | `'movie' \| 'tv'` | What kind of media |
| `tmdbId` | Number | TMDB/Radarr/Sonarr ID |
| `title` | String | Media title |
| `year` | String | Release year |
| `posterPath` | String | Poster URL |
| `seasonNumber` | Number (optional) | For TV — which season |
| `episodeNumber` | Number (optional) | For TV — which episode |
| `episodeTitle` | String (optional) | Episode name for display |
| `issueType` | String | `'wrong_language' \| 'corrupt' \| 'missing_subtitles' \| 'wrong_content' \| 'other'` |
| `description` | String (optional) | Free-text detail (required when issueType is `other`) |
| `status` | String | `'open' \| 'acknowledged' \| 'resolved'` |
| `adminNote` | String (optional) | Admin response |
| `reportedAt` | String | ISO timestamp |
| `updatedAt` | String | ISO timestamp |

**GSIs**:
- `UserIssueIndex`: PK=`userId`, SK=`reportedAt` — user's reported issues
- `StatusIssueIndex`: PK=`status`, SK=`reportedAt` — admin queue

#### Infrastructure

File: `backend/serverless.yml`

- Add `MediaIssues` table definition with the above schema and GSIs.
- Add new Lambda functions (below).

### Backend API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/issues` | User | Report a new issue |
| `GET` | `/issues` | User | List my reported issues |
| `DELETE` | `/issues/{id}` | User | Delete my issue (only if open) |
| `GET` | `/admin/issues` | Admin | List all issues (filterable by status) |
| `PUT` | `/admin/issues/{id}/status` | Admin | Update issue status + admin note |
| `DELETE` | `/admin/issues/{id}` | Admin | Delete any issue |

**New files:**
- `backend/functions/issues/create.ts`
- `backend/functions/issues/list.ts`
- `backend/functions/issues/delete.ts`
- `backend/functions/admin/issues/list.ts`
- `backend/functions/admin/issues/updateStatus.ts`
- `backend/functions/admin/issues/delete.ts`

#### Issue Type Enum

File: `backend/types/index.ts` and `frontend/src/types/index.ts`

```typescript
export type IssueType = 'wrong_language' | 'corrupt' | 'missing_subtitles' | 'wrong_content' | 'other';
export type IssueStatus = 'open' | 'acknowledged' | 'resolved';

export interface MediaIssue {
  issueId: string;
  userId: string;
  userName: string;
  mediaType: MediaType;
  tmdbId: number;
  title: string;
  year: string;
  posterPath: string;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeTitle?: string;
  issueType: IssueType;
  description?: string;
  status: IssueStatus;
  adminNote?: string;
  reportedAt: string;
  updatedAt: string;
}
```

### Frontend

**1. "Report Issue" page**

New file: `frontend/src/pages/ReportIssuePage.tsx`

Route: `/report-issue`

- Step 1: Search bar (reuse existing search component) — user searches for a movie or TV show.
- Step 2: Results show only items that exist in the library (use `requestsApi.checkMedia()` to filter, or add a new endpoint that searches the existing Radarr/Sonarr library directly).
- Step 3 (TV only): If the user selects a TV show, show a season/episode picker. Fetch episode list from Sonarr's API (`/api/v3/episode?seriesId=X`).
- Step 4: Issue type dropdown with these options:
  - "Wrong Language"
  - "Corrupt File"
  - "Missing Subtitles"
  - "Wrong Content"
  - "Other"
- Step 5: If "Other" is selected, show a text area for a custom description (required). For preset types, the text area is optional (for additional details).
- Step 6: Submit button.

**2. New Sonarr endpoint — get episodes for a series**

File: `backend/lib/integrations/sonarr.ts`

```typescript
export async function getEpisodes(
  config: SonarrConfig,
  seriesId: number
): Promise<Array<{
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  hasFile: boolean;
}>>
```

New Lambda: `backend/functions/issues/episodes.ts`
- `GET /issues/episodes?sonarrId={id}` — returns episode list for the series.
- Protected (user auth required).

**3. "My Issues" section**

File: `frontend/src/pages/RequestsPage.tsx` (or a new `/issues` page)

- Add a tab or section showing the user's reported issues with status badges.

**4. Admin issue queue**

New file: `frontend/src/pages/admin/IssueQueuePage.tsx`

Route: `/admin/issues`

- Table of reported issues, filterable by status.
- Admin can acknowledge, resolve, or add a note.
- Add navigation link in the admin sidebar.

**5. API client**

File: `frontend/src/services/api.ts`

- Add `issues` namespace with `create`, `list`, `delete`.
- Add `admin.issues` namespace with `list`, `updateStatus`, `delete`.

**6. Navigation**

- Add "Report Issue" link to the user navbar.
- Add "Issues" link to the admin sidebar.

---

## Implementation Order

These features have minimal dependencies on each other and can largely be worked in parallel. Suggested order:

| Priority | Feature | Reason |
|----------|---------|--------|
| 1 | Feature 4: Token Expiry Redirect | Small change, improves all authenticated flows — do first |
| 2 | Feature 3: Auto-Refresh | Small change, immediate UX improvement |
| 3 | Feature 1: Season Selection | Medium scope, high user value |
| 4 | Feature 2: Email Notifications | Medium scope, requires SES setup |
| 5 | Feature 5: Report Media Issue | Largest scope — new table, new pages, new API endpoints |

---

## GitHub Issues to Create

| # | Title | Labels | Feature |
|---|-------|--------|---------|
| 46 | Redirect to login on expired token + auto-refresh | `frontend` | F4 + F3 |
| 47 | TV season selection — backend (search, request, Sonarr client) | `backend` | F1 |
| 48 | TV season selection — frontend (season picker, display) | `frontend` | F1 |
| 49 | Email notifications on request status change (SES) | `backend`, `infra` | F2 |
| 50 | Report media issue — data model and backend API | `backend`, `infra` | F5 |
| 51 | Report media issue — frontend (report page, admin queue) | `frontend` | F5 |
