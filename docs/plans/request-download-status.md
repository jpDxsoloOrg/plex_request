# Request Download Status Tracking — Implementation Plan

> **GitHub Issue**: #54
> **Goal**: Show live download status from Radarr/Sonarr on the requests page so users and admins can see progress without checking external tools.

---

## Table of Contents

1. [Backend: Radarr/Sonarr Queue Client Extensions](#1-backend-radarrsonarr-queue-client-extensions)
2. [Backend: Download Status Endpoint](#2-backend-download-status-endpoint)
3. [Backend: Auto-Complete Sync (Optional)](#3-backend-auto-complete-sync-optional)
4. [Shared Types](#4-shared-types)
5. [Frontend: Enhanced Request Cards](#5-frontend-enhanced-request-cards)
6. [Frontend: Admin View Updates](#6-frontend-admin-view-updates)

---

## 1. Backend: Radarr/Sonarr Queue Client Extensions

### 1a. Radarr Client — add queue query

**File**: `backend/lib/integrations/radarr.ts`

Add new interfaces and functions:

```typescript
interface RadarrQueueItem {
  id: number;
  movieId: number;
  title: string;
  status: string;           // 'downloading' | 'paused' | 'queued' | 'completed' | 'failed' | 'warning'
  trackedDownloadStatus: string;
  trackedDownloadState: string;
  size: number;
  sizeleft: number;
  timeleft: string;         // "00:15:30" format
  estimatedCompletionTime: string; // ISO timestamp
  downloadClient: string;
}

interface RadarrQueueResponse {
  page: number;
  pageSize: number;
  totalRecords: number;
  records: RadarrQueueItem[];
}

export async function getQueue(config: RadarrConfig): Promise<RadarrQueueItem[]> {
  const response = await radarrFetch<RadarrQueueResponse>(config, '/api/v3/queue?pageSize=100&includeMovie=false');
  return response.records;
}
```

### 1b. Sonarr Client — add queue query

**File**: `backend/lib/integrations/sonarr.ts`

Add matching interfaces and function:

```typescript
interface SonarrQueueItem {
  id: number;
  seriesId: number;
  episodeId: number;
  title: string;
  status: string;
  trackedDownloadStatus: string;
  trackedDownloadState: string;
  size: number;
  sizeleft: number;
  timeleft: string;
  estimatedCompletionTime: string;
  downloadClient: string;
}

interface SonarrQueueResponse {
  page: number;
  pageSize: number;
  totalRecords: number;
  records: SonarrQueueItem[];
}

export async function getQueue(config: SonarrConfig): Promise<SonarrQueueItem[]> {
  const response = await sonarrFetch<SonarrQueueResponse>(config, '/api/v3/queue?pageSize=100&includeSeries=false&includeEpisode=false');
  return response.records;
}
```

---

## 2. Backend: Download Status Endpoint

### 2a. `GET /requests/download-status` (authenticated)

**File**: `backend/functions/requests/downloadStatus.ts` (new)

This endpoint returns download status for all of the current user's active requests (approved/downloading).

**Logic**:

1. Query Requests table by userId (UserIndex GSI) for status IN (`approved`, `downloading`).
2. Separate into movie requests (have `radarrId`) and TV requests (have `sonarrId`).
3. Fetch Radarr config and Sonarr config from settings table.
4. In parallel:
   - Call `radarr.getQueue(config)` — get all active Radarr downloads
   - Call `sonarr.getQueue(config)` — get all active Sonarr downloads
   - For each movie request: call `radarr.getMovie(config, radarrId)` to check `hasFile`
   - For each TV request: call `sonarr.getSeries(config, sonarrId)` to check episode statistics
5. Match queue items to requests by `movieId`/`seriesId`.
6. Build a map of `requestId → DownloadStatus` and return it.

**Response**:
```typescript
{
  statuses: Record<string, DownloadStatus>
}
```

### 2b. `GET /admin/requests/download-status` (admin)

**File**: `backend/functions/admin/requests/downloadStatus.ts` (new)

Same logic but for ALL approved/downloading requests (not filtered by userId). Admin-only.

### 2c. Serverless Configuration

**File**: `backend/serverless.yml`

```yaml
  requestDownloadStatus:
    handler: functions/requests/downloadStatus.handler
    events:
      - httpApi:
          path: /requests/download-status
          method: GET
          authorizer:
            name: jwtAuthorizer

  adminRequestDownloadStatus:
    handler: functions/admin/requests/downloadStatus.handler
    events:
      - httpApi:
          path: /admin/requests/download-status
          method: GET
          authorizer:
            name: jwtAuthorizer
```

---

## 3. Backend: Auto-Complete Sync (Optional)

**File**: `backend/functions/requests/syncStatus.ts` (new)

A scheduled Lambda that runs every 5 minutes to auto-transition requests:

1. Scan for all requests with status `approved` or `downloading`.
2. For each movie request with `radarrId`: check if `radarr.getMovie()` returns `hasFile: true` → update status to `complete`.
3. For each TV request with `sonarrId`: check if `sonarr.getSeries()` shows all monitored episodes have files → update status to `complete`.
4. Update status to `downloading` for requests found in the Radarr/Sonarr queue.

**Serverless config**:
```yaml
  syncRequestStatus:
    handler: functions/requests/syncStatus.handler
    events:
      - schedule: rate(5 minutes)
```

This eliminates the need for admins to manually transition requests.

---

## 4. Shared Types

### Backend + Frontend

**File**: `backend/types/index.ts` and `frontend/src/types/index.ts`

```typescript
/** Download status for a single request */
export interface DownloadStatus {
  requestId: string;
  downloadState: 'queued' | 'downloading' | 'importing' | 'completed' | 'failed' | 'warning' | 'pending';
  percentComplete: number;       // 0-100
  sizeTotal?: number;            // bytes
  sizeRemaining?: number;        // bytes
  estimatedCompletion?: string;  // ISO timestamp
  downloadClient?: string;       // e.g. "SABnzbd"
}
```

---

## 5. Frontend: Enhanced Request Cards

### 5a. API Service

**File**: `frontend/src/services/api.ts`

```typescript
// Add to requests namespace
getDownloadStatus: () =>
  request<{ statuses: Record<string, DownloadStatus> }>('/requests/download-status'),

// Add to admin.requests namespace
getDownloadStatus: () =>
  request<{ statuses: Record<string, DownloadStatus> }>('/admin/requests/download-status'),
```

### 5b. Request Card Enhancement

**File**: `frontend/src/components/RequestCard.tsx`

For requests with status `approved` or `downloading`, replace the static status badge with:

1. **Progress bar** — horizontal bar showing percent complete (shadcn Progress component)
2. **Status text** — "Downloading 65%" or "Queued" or "Importing..."
3. **ETA** — "~15 min remaining" (if available)
4. **Completed state** — green checkmark with "Downloaded" when percentComplete = 100

For requests without a matching download status entry (approved but not yet in queue):
- Show "Waiting for download to start..."

### 5c. Polling Integration

**File**: `frontend/src/pages/RequestsPage.tsx`

- Existing 30s polling already fetches requests. Add a parallel call to `getDownloadStatus()`.
- Merge statuses into request cards via a `Map<requestId, DownloadStatus>`.
- Consider polling download status more frequently (15s) since it changes faster than request status.

---

## 6. Frontend: Admin View Updates

**File**: `frontend/src/pages/admin/RequestQueuePage.tsx`

- Same download status display as user view.
- Auto-complete sync means admins rarely need to manually click "Complete" — it happens automatically.
- Show a small "Auto-synced" indicator when a request was auto-completed by the sync Lambda.

---

## Implementation Order

1. Radarr/Sonarr client extensions (queue API)
2. Backend types (DownloadStatus)
3. `GET /requests/download-status` endpoint
4. `GET /admin/requests/download-status` endpoint
5. Auto-complete sync Lambda (scheduled)
6. Frontend types + API service
7. Request card progress bar component
8. Polling integration on both pages
9. Serverless routes + deploy
