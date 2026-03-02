# Plex Request - Implementation Plan

## Phase 1: Project Scaffolding & Infrastructure Foundation

### 1.1 Backend Setup
- Initialize `backend/` with `package.json`, TypeScript config, Serverless Framework
- Configure `serverless.yml` with:
  - Provider: AWS, Node.js 20, region `us-east-1`
  - DynamoDB tables (on-demand billing):
    - **Requests** table (PK: `requestId`) - stores all media requests
    - **Settings** table (PK: `settingKey`) - stores Radarr/Sonarr connection config
  - Cognito User Pool with self-registration enabled and admin group
  - API Gateway with CORS
  - Lambda authorizer for JWT validation
  - S3 bucket + CloudFront for frontend hosting
  - Environment variables for TMDB API key, Radarr/Sonarr URLs (stored in SSM Parameter Store)

### 1.2 Frontend Setup
- Initialize `frontend/` with Vite + React + TypeScript
- Install dependencies: React Router, AWS Amplify (Cognito auth), i18next (optional)
- Configure Vite proxy for local dev against backend on port 3001
- Create `.env` files for local, dev, and prod environments

### 1.3 Shared Config
- `.gitignore` for node_modules, .env, .serverless, dist
- ESLint + Prettier config for both frontend and backend
- GitHub Actions workflows (deploy-dev, deploy-prod) - can mirror league_szn patterns

---

## Phase 2: Authentication (Cognito)

### 2.1 Cognito User Pool Configuration (serverless.yml)
- Username-based or email-based sign-up (recommend email for this app)
- Self-registration enabled (users can sign up themselves)
- Email verification required
- Password policy: minimum 8 chars, requires mixed case + number
- Admin group: `admins` - members get admin privileges
- Token validity: 1hr access token, 30-day refresh token

### 2.2 Lambda Authorizer
- `functions/auth/authorizer.ts` - validates JWT using `aws-jwt-verify`
- Extracts user ID and group membership from token claims
- Returns IAM policy with `cognito:groups` in context for downstream Lambdas
- Two authorization levels:
  - **authenticated**: any valid token (for user endpoints)
  - **admin**: token must include `admins` group (for admin endpoints)

### 2.3 Auth Lambda Functions
- `POST /auth/signup` - proxy to Cognito sign-up (or let Amplify handle client-side)
- `POST /auth/confirm` - confirm email verification code
- `POST /auth/login` - authenticate and return tokens
- `POST /auth/refresh` - refresh expired access token
- `GET /auth/me` - return current user profile and group membership

### 2.4 Frontend Auth
- Auth context provider wrapping the app
- Login page, registration page, email confirmation page
- Protected routes (redirect to login if unauthenticated)
- Admin routes (redirect to home if not in admins group)
- Token management: store in memory, refresh on expiry

---

## Phase 3: Data Model & Core API

### 3.1 DynamoDB Table Design

#### Requests Table
| Attribute | Type | Description |
|-----------|------|-------------|
| `requestId` | String (PK) | UUID |
| `userId` | String | Cognito user sub |
| `userName` | String | Display name from Cognito |
| `mediaType` | String | `movie` or `tv` |
| `tmdbId` | Number | TMDB ID of the media |
| `title` | String | Media title |
| `year` | String | Release year |
| `overview` | String | Plot summary |
| `posterPath` | String | TMDB poster URL path |
| `status` | String | `requested`, `approved`, `downloading`, `complete`, `rejected` |
| `adminNote` | String | Optional note from admin |
| `radarrId` | Number | Radarr movie ID (after approval, movies only) |
| `sonarrId` | Number | Sonarr series ID (after approval, TV only) |
| `requestedAt` | String | ISO timestamp |
| `updatedAt` | String | ISO timestamp |

**GSIs:**
- **UserIndex**: PK=`userId`, SK=`requestedAt` - query user's own requests
- **StatusIndex**: PK=`status`, SK=`requestedAt` - query requests by status (admin queue)

#### Settings Table
| Attribute | Type | Description |
|-----------|------|-------------|
| `settingKey` | String (PK) | e.g. `radarr`, `sonarr`, `tmdb` |
| `baseUrl` | String | Service URL |
| `apiKey` | String | API key (encrypted at rest) |
| `qualityProfileId` | Number | Default quality profile |
| `rootFolderPath` | String | Root folder for downloads |
| `enabled` | Boolean | Whether integration is active |

### 3.2 Search API (TMDB Proxy)
- `GET /search?query=<term>&type=<movie|tv>` (authenticated)
- Lambda proxies to TMDB API:
  - Movies: `https://api.themoviedb.org/3/search/movie?query=<term>`
  - TV: `https://api.themoviedb.org/3/search/tv?query=<term>`
- Returns normalized results: `{ id, title, year, overview, posterUrl, mediaType }`
- TMDB API key stored in SSM Parameter Store, read at Lambda cold start

### 3.3 Request API
- `POST /requests` (authenticated) - create new request
  - Body: `{ mediaType, tmdbId, title, year, overview, posterPath }`
  - Check for duplicate (same tmdbId + mediaType not already requested/approved/downloading)
  - Sets status to `requested`, captures userId from JWT
- `GET /requests` (authenticated) - get current user's requests
  - Queries UserIndex GSI by userId
  - Sorted by requestedAt descending
- `GET /requests/:id` (authenticated) - get single request detail
  - Verify request belongs to user OR user is admin

### 3.4 Admin Request API
- `GET /admin/requests?status=<status>` (admin) - get all requests, filterable by status
  - Queries StatusIndex GSI
  - Default: show `requested` (pending queue)
- `PUT /admin/requests/:id/status` (admin) - update request status
  - Body: `{ status, adminNote? }`
  - Valid transitions: `requested` -> `approved`/`rejected`, `approved` -> `downloading`, `downloading` -> `complete`
  - **On transition to `approved`**: trigger Radarr/Sonarr integration (see Phase 4)
- `GET /admin/requests/stats` (admin) - dashboard stats
  - Count by status, recent activity

### 3.5 Admin Settings API
- `GET /admin/settings` (admin) - get all integration settings
- `PUT /admin/settings/:key` (admin) - update a setting (radarr, sonarr, tmdb)
- `POST /admin/settings/test/:key` (admin) - test connection to Radarr/Sonarr

---

## Phase 4: Radarr & Sonarr Integration

### 4.1 Integration Library (`lib/integrations/`)

#### Radarr Client (`lib/integrations/radarr.ts`)
- `testConnection()` - `GET /api/v3/system/status`
- `lookupMovie(tmdbId)` - `GET /api/v3/movie/lookup/tmdb?tmdbId=<id>`
- `addMovie(tmdbId, qualityProfileId, rootFolderPath)` - `POST /api/v3/movie` with `addOptions.searchForMovie: true`
- `getMovie(radarrId)` - `GET /api/v3/movie/<id>` (for status checks)
- `getQualityProfiles()` - `GET /api/v3/qualityprofile`
- `getRootFolders()` - `GET /api/v3/rootfolder`

#### Sonarr Client (`lib/integrations/sonarr.ts`)
- `testConnection()` - `GET /api/v3/system/status`
- `lookupSeries(tvdbId)` - `GET /api/v3/series/lookup?term=tvdb:<id>`
- `addSeries(tvdbId, qualityProfileId, rootFolderPath)` - `POST /api/v3/series` with `addOptions.searchForMissingEpisodes: true`
- `getSeries(sonarrId)` - `GET /api/v3/series/<id>`
- `getQualityProfiles()` - `GET /api/v3/qualityprofile`
- `getRootFolders()` - `GET /api/v3/rootfolder`

### 4.2 Approval Flow
When admin sets status to `approved`:
1. Read Radarr/Sonarr settings from Settings table
2. If `mediaType === 'movie'`: call Radarr `addMovie(tmdbId, ...)`
3. If `mediaType === 'tv'`: call Sonarr `addSeries(tvdbId, ...)`
   - Note: TMDB ID needs to be mapped to TVDB ID. TMDB API provides `external_ids` endpoint, or Sonarr lookup supports TMDB IDs via `term=tmdb:<id>`
4. Store returned `radarrId`/`sonarrId` on the request record
5. If API call fails: keep status as `requested`, return error to admin

### 4.3 TMDB-to-TVDB Mapping
- For TV shows, Sonarr uses TVDB IDs internally
- Options:
  - Use TMDB `/tv/{id}/external_ids` to get TVDB ID before calling Sonarr
  - Or use Sonarr's lookup which accepts TMDB IDs: `GET /api/v3/series/lookup?term=tmdb:<tmdbId>`
- Recommend: use Sonarr's lookup directly with TMDB ID to avoid extra API call

---

## Phase 5: Frontend Implementation

### 5.1 Layout & Navigation
- **Navbar**: Logo, Search, My Requests, Admin (if admin), Login/Logout
- **Responsive**: Mobile-first, works on phones (similar to LunaSea experience)
- **Theme**: Dark theme (media apps convention)

### 5.2 Pages

#### Public/Auth Pages
- `/login` - Email + password login form
- `/register` - Self-registration with email verification
- `/confirm` - Email confirmation code entry

#### User Pages (authenticated)
- `/search` - Search bar + results grid (movie posters with title/year)
  - Toggle between Movies and TV Shows
  - Click a result to see detail and request button
- `/search/:mediaType/:tmdbId` - Media detail page (poster, overview, year, cast)
  - "Request" button (disabled if already requested)
  - Shows existing request status if already in system
- `/requests` - My Requests list
  - Shows all user's requests with status badges
  - Color-coded: blue=requested, orange=approved, yellow=downloading, green=complete, red=rejected
  - Sorted newest first

#### Admin Pages (admin group)
- `/admin` - Admin dashboard with request stats
- `/admin/requests` - Request queue with status filter tabs
  - Approve/reject buttons on each pending request
  - Status update dropdown for approved/downloading items
  - Admin note field
- `/admin/settings` - Integration settings
  - Radarr: URL, API key, quality profile, root folder + test button
  - Sonarr: URL, API key, quality profile, root folder + test button
  - TMDB: API key + test button

### 5.3 Components
- `SearchBar` - debounced search input
- `MediaCard` - poster thumbnail with title, year, media type badge
- `MediaDetail` - full detail view with request action
- `RequestCard` - request with status badge and admin actions
- `StatusBadge` - colored badge component for request statuses
- `AdminRequestQueue` - filterable request list with bulk actions
- `SettingsForm` - form for Radarr/Sonarr/TMDB connection config
- `ProtectedRoute` - route wrapper checking auth
- `AdminRoute` - route wrapper checking admin group

---

## Phase 6: Infrastructure & Deployment

### 6.1 Serverless.yml Resources
```yaml
# Cognito User Pool with self-registration
# Cognito User Pool Client
# Cognito Admin Group
# DynamoDB: Requests table with GSIs
# DynamoDB: Settings table
# S3 bucket for frontend
# CloudFront distribution
# SSM Parameters for secrets (TMDB key)
# IAM roles for Lambda functions
```

### 6.2 Environment Strategy
| Environment | Stage | API URL | Frontend URL |
|-------------|-------|---------|--------------|
| Local | offline | localhost:3001 | localhost:3000 |
| Dev | devtest | API Gateway devtest | dev S3 bucket |
| Prod | dev | API Gateway dev | prod S3 bucket |

### 6.3 CI/CD (GitHub Actions)
- **PR to main**: Deploy to dev (backend devtest stage + dev frontend bucket)
- **Merge to main**: Deploy to prod (backend dev stage + prod frontend bucket + CloudFront invalidation)

### 6.4 Secrets Management
- TMDB API key: SSM Parameter Store (`/plex-request/{stage}/tmdb-api-key`)
- Radarr/Sonarr API keys: stored in DynamoDB Settings table (encrypted at rest via DynamoDB default encryption)
- Cognito client secret: not needed (public client for SPA)

---

## Phase 7: Polish & Enhancements

### 7.1 UX Polish
- Loading skeletons while fetching data
- Toast notifications for actions (request submitted, approved, etc.)
- Empty states for no results / no requests
- Error boundaries and friendly error pages
- Pagination for request lists

### 7.2 SABnzbd Integration (Stretch Goal)
Live download status display by integrating with SABnzbd's API. This is a **stretch goal** and not an initial priority - the core app works fine with admin-managed statuses.

#### SABnzbd Client (`lib/integrations/sabnzbd.ts`)
- `testConnection()` - `GET /api?mode=version&apikey=<key>`
- `getQueue()` - `GET /api?mode=queue&apikey=<key>&output=json` - returns active downloads with progress %, speed, ETA
- `getHistory(limit)` - `GET /api?mode=history&apikey=<key>&output=json` - returns completed downloads
- `getStatus(nzbName)` - match a request's title against queue/history entries to find download progress

#### How It Works
1. Admin configures SABnzbd connection in Settings (URL + API key)
2. When a request is in `approved` or `downloading` status, the frontend can poll a new endpoint to check SABnzbd queue
3. `GET /admin/downloads/status` (admin) or `GET /requests/:id/download-status` (user) - Lambda calls SABnzbd API, matches against the request's title/tmdbId
4. Frontend displays: download %, speed, ETA, or "queued" / "not found in SABnzbd"
5. Optionally auto-transition status to `downloading` when found in SABnzbd queue, and to `complete` when found in history

#### Settings Table Addition
| Attribute | Type | Description |
|-----------|------|-------------|
| `settingKey` = `sabnzbd` | String (PK) | SABnzbd config |
| `baseUrl` | String | SABnzbd URL (e.g. `http://jpcoder.duckdns.org:38080`) |
| `apiKey` | String | SABnzbd API key |
| `enabled` | Boolean | Whether integration is active |

#### Frontend Addition
- Download progress bar on request cards (when SABnzbd is configured and status is approved/downloading)
- SABnzbd connection settings in admin settings page
- Graceful fallback: if SABnzbd is not configured or unreachable, just show the manual status as usual

#### Considerations
- SABnzbd, Radarr, and Sonarr are all accessible via public HTTP addresses, so Lambda functions can call them directly without VPC configuration
- Matching downloads to requests may be fuzzy (title-based) - Radarr/Sonarr download IDs could help with more precise matching

### 7.3 Other Optional Enhancements (Future)
- Push notifications when request status changes (SNS + email or web push)
- Request comments / conversation between user and admin
- Auto-status updates via Radarr/Sonarr webhooks (Radarr/Sonarr can POST to a webhook URL when download completes)
- Request limits per user (e.g., max 5 pending requests)
- Popular/trending media on home page (TMDB trending endpoint)
- Multi-language support (i18next)

---

## Implementation Order

| Order | Phase | Estimated Effort | Dependencies |
|-------|-------|-----------------|--------------|
| 1 | Phase 1 - Scaffolding | Foundation | None |
| 2 | Phase 2 - Auth | Foundation | Phase 1 |
| 3 | Phase 3.1 - Data Model | Backend | Phase 1 |
| 4 | Phase 3.2 - Search API | Backend | Phase 3.1 |
| 5 | Phase 3.3 - Request API | Backend | Phase 3.1 |
| 6 | Phase 3.4 - Admin API | Backend | Phase 3.3 |
| 7 | Phase 5.1-5.2 - Frontend Shell | Frontend | Phase 2 |
| 8 | Phase 5.2 - Search Pages | Frontend | Phase 3.2 |
| 9 | Phase 5.2 - Request Pages | Frontend | Phase 3.3 |
| 10 | Phase 5.2 - Admin Pages | Frontend | Phase 3.4 |
| 11 | Phase 4 - Radarr/Sonarr | Backend | Phase 3.4 |
| 12 | Phase 3.5 - Settings API | Backend | Phase 4 |
| 13 | Phase 5.2 - Settings Page | Frontend | Phase 3.5 |
| 14 | Phase 6 - Deploy | DevOps | All above |
| 15 | Phase 7.1 - Polish | UX | Phase 14 |
| 16 | Phase 7.2 - SABnzbd (Stretch) | Backend + Frontend | Phase 14 |

---

## API Endpoint Summary

### Public
| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/signup` | Register new user |
| POST | `/auth/confirm` | Confirm email |
| POST | `/auth/login` | Login |
| POST | `/auth/refresh` | Refresh token |

### Authenticated (any user)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/me` | Current user profile |
| GET | `/search?query=&type=` | Search TMDB |
| POST | `/requests` | Submit request |
| GET | `/requests` | My requests |
| GET | `/requests/:id` | Request detail |

### Admin
| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/requests?status=` | All requests (filterable) |
| PUT | `/admin/requests/:id/status` | Update request status |
| GET | `/admin/requests/stats` | Request statistics |
| GET | `/admin/settings` | Get integration settings |
| PUT | `/admin/settings/:key` | Update setting |
| POST | `/admin/settings/test/:key` | Test connection |

### Admin - SABnzbd (Stretch Goal)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/downloads/status` | All active SABnzbd downloads |
| GET | `/requests/:id/download-status` | Download progress for a specific request |

---

## External API References

- [TMDB API Docs](https://developer.themoviedb.org/docs)
- [Radarr API Docs](https://radarr.video/docs/api/)
- [Sonarr API Docs](https://sonarr.tv/docs/api/)
- [SABnzbd API Docs](https://sabnzbd.org/wiki/configuration/4.4/api)
- [LunaSea App](https://www.lunasea.app/) (UX reference)
