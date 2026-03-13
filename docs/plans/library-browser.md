# Media Library Browser — Implementation Plan

> **GitHub Issue**: #53
> **Goal**: Let users browse all monitored movies and TV shows from Radarr/Sonarr with download status, and drill into TV shows by season/episode.

---

## Table of Contents

1. [Backend: API Endpoints](#1-backend-api-endpoints)
2. [Backend: Radarr/Sonarr Client Extensions](#2-backend-radarrsonarr-client-extensions)
3. [Shared Types](#3-shared-types)
4. [Frontend: API Service](#4-frontend-api-service)
5. [Frontend: Library Page — Movies Tab](#5-frontend-library-page--movies-tab)
6. [Frontend: Library Page — TV Shows Tab](#6-frontend-library-page--tv-shows-tab)
7. [Frontend: Show Detail & Episode Drill-Down](#7-frontend-show-detail--episode-drill-down)
8. [Frontend: Navigation & Routing](#8-frontend-navigation--routing)

---

## 1. Backend: API Endpoints

### 1a. `GET /library/movies` (public, no auth)

**File**: `backend/functions/library/movies.ts` (new)

- Read Radarr config from settings table (fall back to env vars).
- Call `radarr.getAllMovies(config)`.
- Normalize each movie into a `LibraryMovie` shape (see types below).
- Support query params:
  - `?search=<term>` — filter by title (case-insensitive substring match, done server-side after fetch).
  - `?status=downloaded|missing|all` — filter by hasFile. Default: `all`.
  - `?page=1&pageSize=48` — paginate the response. Return `{ movies: LibraryMovie[], total: number, page: number, pageSize: number }`.
- Sort by title alphabetically (default).

### 1b. `GET /library/shows` (public, no auth)

**File**: `backend/functions/library/shows.ts` (new)

- Read Sonarr config from settings table (fall back to env vars).
- Call `sonarr.getAllSeries(config)`.
- Normalize each series into a `LibraryShow` shape (see types below).
- Support same query params as movies: `?search=`, `?status=downloaded|missing|partial|all`, `?page=`, `?pageSize=`.
  - `downloaded` = all monitored episodes have files.
  - `missing` = zero episode files.
  - `partial` = some but not all.
- Sort by title alphabetically (default).

### 1c. `GET /library/shows/:sonarrId/episodes` (public, no auth)

**File**: `backend/functions/library/episodes.ts` (new)

- Read Sonarr config from settings table.
- Call `sonarr.getEpisodes(config, sonarrId)` (new client method — see below).
- Optional query param `?seasonNumber=N` to filter to a single season.
- Return `{ episodes: LibraryEpisode[] }`.

### 1d. Serverless Configuration

**File**: `backend/serverless.yml`

Add three new functions under `functions:`:

```yaml
  libraryMovies:
    handler: functions/library/movies.handler
    events:
      - httpApi:
          path: /library/movies
          method: GET

  libraryShows:
    handler: functions/library/shows.handler
    events:
      - httpApi:
          path: /library/shows
          method: GET

  libraryShowEpisodes:
    handler: functions/library/episodes.handler
    events:
      - httpApi:
          path: /library/shows/{sonarrId}/episodes
          method: GET
```

These are **public** endpoints — no authorizer needed.

---

## 2. Backend: Radarr/Sonarr Client Extensions

### 2a. Radarr Client — no changes needed

`radarr.getAllMovies()` already exists and returns `RadarrMovie[]` which includes `hasFile`, `sizeOnDisk`, `monitored`, `images`, `title`, `year`, `tmdbId`.

### 2b. Sonarr Client — add `getEpisodes`

**File**: `backend/lib/integrations/sonarr.ts`

Add a new exported function:

```typescript
export interface SonarrEpisode {
  id: number;
  seriesId: number;
  tvdbId: number;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  airDate: string;
  airDateUtc: string;
  overview: string;
  hasFile: boolean;
  monitored: boolean;
}

export async function getEpisodes(config: SonarrConfig, seriesId: number): Promise<SonarrEpisode[]> {
  return sonarrFetch<SonarrEpisode[]>(config, `/api/v3/episode?seriesId=${seriesId}`);
}
```

The existing `SonarrSeries` interface needs extending to include `statistics`:

```typescript
interface SonarrSeriesStatistics {
  seasonCount: number;
  episodeFileCount: number;
  episodeCount: number;
  totalEpisodeCount: number;
  sizeOnDisk: number;
  percentOfEpisodes: number;
}

interface SonarrSeasonStatistics {
  episodeFileCount: number;
  episodeCount: number;
  totalEpisodeCount: number;
  sizeOnDisk: number;
  percentOfEpisodes: number;
}
```

Update `SonarrSeries.seasons` type to:
```typescript
seasons?: Array<{
  seasonNumber: number;
  monitored: boolean;
  statistics?: SonarrSeasonStatistics;
}>;
```

And add to `SonarrSeries`:
```typescript
statistics?: SonarrSeriesStatistics;
```

---

## 3. Shared Types

### Backend types

**File**: `backend/types/index.ts`

Add:

```typescript
/** Library movie returned from GET /library/movies */
export interface LibraryMovie {
  radarrId: number;
  tmdbId: number;
  title: string;
  year: number;
  posterUrl: string;
  status: 'downloaded' | 'missing';
  sizeOnDisk: number;
  monitored: boolean;
}

/** Library show returned from GET /library/shows */
export interface LibraryShow {
  sonarrId: number;
  tvdbId: number;
  title: string;
  year: number;
  posterUrl: string;
  status: 'downloaded' | 'partial' | 'missing';
  monitored: boolean;
  episodeFileCount: number;
  episodeCount: number;
  totalEpisodeCount: number;
  sizeOnDisk: number;
  percentComplete: number;
  seasons: LibraryShowSeason[];
}

/** Per-season summary within a library show */
export interface LibraryShowSeason {
  seasonNumber: number;
  monitored: boolean;
  episodeFileCount: number;
  episodeCount: number;
  totalEpisodeCount: number;
  percentComplete: number;
}

/** Episode returned from GET /library/shows/:id/episodes */
export interface LibraryEpisode {
  episodeId: number;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  airDate: string;
  overview: string;
  hasFile: boolean;
  monitored: boolean;
}
```

### Frontend types

**File**: `frontend/src/types/index.ts`

Mirror the same `LibraryMovie`, `LibraryShow`, `LibraryShowSeason`, `LibraryEpisode` interfaces.

---

## 4. Frontend: API Service

**File**: `frontend/src/services/api.ts`

Add a new `library` namespace:

```typescript
export const library = {
  getMovies: (params?: { search?: string; status?: string; page?: number; pageSize?: number }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    const qs = query.toString();
    return request<{ movies: LibraryMovie[]; total: number; page: number; pageSize: number }>(
      `/library/movies${qs ? `?${qs}` : ''}`
    );
  },

  getShows: (params?: { search?: string; status?: string; page?: number; pageSize?: number }) => {
    const query = new URLSearchParams();
    // same pattern as movies
    const qs = query.toString();
    return request<{ shows: LibraryShow[]; total: number; page: number; pageSize: number }>(
      `/library/shows${qs ? `?${qs}` : ''}`
    );
  },

  getEpisodes: (sonarrId: number, seasonNumber?: number) => {
    const qs = seasonNumber !== undefined ? `?seasonNumber=${seasonNumber}` : '';
    return request<{ episodes: LibraryEpisode[] }>(`/library/shows/${sonarrId}/episodes${qs}`);
  },
};
```

---

## 5. Frontend: Library Page — Movies Tab

**File**: `frontend/src/pages/LibraryPage.tsx` (new)

### Layout

- Two tabs at top: **Movies** | **TV Shows** (using shadcn Tabs component)
- Search bar with debounced input (300ms)
- Filter dropdown: All / Downloaded / Missing
- Poster grid: responsive, 6 columns on desktop → 3 on tablet → 2 on mobile
- Pagination controls at bottom (Previous / Next / page indicator)

### Movie Card

- Poster image (from Radarr `images[]` where coverType=poster, use remoteUrl)
- Title + year overlay at bottom
- Status badge: green "Downloaded" or red "Missing"
- Size on disk (formatted, e.g., "4.2 GB") shown for downloaded movies

### Behavior

- Default page size: 48 items
- Search filters as user types (debounced)
- Status filter applied alongside search
- Loading skeleton while fetching

---

## 6. Frontend: Library Page — TV Shows Tab

### Show Card

- Poster image (from Sonarr `images[]` where coverType=poster, use remoteUrl)
- Title + year overlay at bottom
- Progress bar showing `episodeFileCount / episodeCount` (colored: green if 100%, yellow if partial, red if 0%)
- Text count: "50/100 episodes"
- Click opens show detail

### Behavior

- Same search/filter/pagination as movies tab
- Status filter options: All / Downloaded / Partial / Missing

---

## 7. Frontend: Show Detail & Episode Drill-Down

**File**: `frontend/src/pages/LibraryShowDetailPage.tsx` (new)

### Option A: Inline Expansion (recommended)

When a show card is clicked in the grid, expand below it (accordion-style) to show:

1. **Show header**: poster (larger), title, year, overall progress bar, "50/100 episodes downloaded"
2. **Season list**: One row per season showing:
   - Season number
   - Progress bar: `episodeFileCount / episodeCount`
   - Text: "8/10 episodes"
   - Click to expand episodes
3. **Episode list** (on season click): Table/list showing:
   - Episode number + title
   - Air date
   - Status icon: green check (downloaded) or red X (missing)

### Option B: Separate Page

Route: `/library/shows/:sonarrId`

Same content as Option A but on a dedicated page. Back button returns to shows grid.

**Recommendation**: Start with Option B (separate page) — simpler to implement and better for deep linking. The route already keeps context.

### Episode Fetch

- Fetch episodes lazily when a season is expanded (call `library.getEpisodes(sonarrId, seasonNumber)`)
- Cache episodes in component state so re-expanding doesn't re-fetch

---

## 8. Frontend: Navigation & Routing

### App.tsx

Add routes:

```tsx
<Route path="/library" element={<LibraryPage />} />
<Route path="/library/shows/:sonarrId" element={<LibraryShowDetailPage />} />
```

These are **public** routes (inside UserLayout, no ProtectedRoute wrapper).

### Navigation Component

**File**: `frontend/src/components/Navbar.tsx` (or equivalent)

Add "Library" link between "Search" and "My Requests" in the nav bar. This link is visible to all users (including unauthenticated).

---

## Performance Considerations

- **Radarr has ~1,277 movies, Sonarr has ~394 series** — both fit in a single API call but pagination is still needed on the frontend to avoid rendering 1,000+ cards.
- **Server-side filtering**: The Lambda fetches all data from Radarr/Sonarr, then filters/paginates before returning. This keeps the frontend payload small.
- **Caching**: Consider adding a short TTL cache (5 min) in the Lambda to avoid hitting Radarr/Sonarr on every request. The existing `LIBRARY_TABLE` in DynamoDB could be used for this, or a simple in-memory cache since Lambda may be reused.
- **Episode fetch is lazy**: Only called when user drills into a specific season, keeping initial page load fast.

---

## Implementation Order

1. Backend: Sonarr client extensions (add `getEpisodes`, extend `SonarrSeries` types)
2. Backend: Shared types (`LibraryMovie`, `LibraryShow`, `LibraryEpisode`)
3. Backend: `GET /library/movies` endpoint
4. Backend: `GET /library/shows` endpoint
5. Backend: `GET /library/shows/:sonarrId/episodes` endpoint
6. Backend: serverless.yml routes
7. Frontend: Types + API service
8. Frontend: `LibraryPage` with Movies tab
9. Frontend: TV Shows tab
10. Frontend: `LibraryShowDetailPage` with season/episode drill-down
11. Frontend: Navigation update
12. Deploy + test
