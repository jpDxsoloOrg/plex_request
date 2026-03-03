import type {
  MediaRequest,
  MediaSearchResult,
  DashboardStats,
  IntegrationSetting,
  TestConnectionResult,
  QualityProfile,
  RootFolder,
  RequestStatus,
  User,
} from '@/types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

function getToken(): string | null {
  return localStorage.getItem('idToken');
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...options?.headers },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(body.message ?? `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

// Auth
export const auth = {
  signup: (email: string, password: string) =>
    request<{ message: string }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  confirm: (email: string, code: string) =>
    request<{ message: string }>('/auth/confirm', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }),

  login: (email: string, password: string) =>
    request<{ idToken: string; accessToken: string; refreshToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  refresh: (refreshToken: string) =>
    request<{ idToken: string; accessToken: string }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  me: () => request<User>('/auth/me'),
};

// Search
export const search = {
  query: (term: string, type: 'movie' | 'tv') =>
    request<MediaSearchResult[]>(`/search?query=${encodeURIComponent(term)}&type=${type}`),
};

// Requests
export const requests = {
  create: (data: {
    mediaType: 'movie' | 'tv';
    tmdbId: number;
    title: string;
    year: string;
    overview: string;
    posterPath: string;
  }) =>
    request<MediaRequest>('/requests', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  list: async () => {
    const data = await request<{ requests: MediaRequest[] }>('/requests');
    return data.requests;
  },

  get: (id: string) => request<MediaRequest>(`/requests/${id}`),

  delete: (id: string) =>
    request<{ message: string }>(`/requests/${id}`, { method: 'DELETE' }),

  checkMedia: (tmdbId: number, mediaType: 'movie' | 'tv') =>
    request<{ exists: boolean; hasFile?: boolean; message?: string }>(
      `/requests/check?tmdbId=${tmdbId}&mediaType=${mediaType}`
    ),
};

// Admin
export const admin = {
  requests: {
    list: async (status?: RequestStatus) => {
      const data = await request<{ requests: MediaRequest[] }>(
        `/admin/requests${status ? `?status=${status}` : ''}`
      );
      return data.requests;
    },

    delete: (id: string) =>
      request<{ message: string }>(`/admin/requests/${id}`, { method: 'DELETE' }),

    updateStatus: (id: string, status: RequestStatus, adminNote?: string) =>
      request<MediaRequest>(`/admin/requests/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status, adminNote }),
      }),

    stats: async () => {
      const data = await request<{ counts: Record<string, number>; total: number; recentRequests: MediaRequest[] }>(
        '/admin/requests/stats'
      );
      return {
        counts: data.counts as DashboardStats['counts'],
        total: data.total,
        recentPending: data.recentRequests,
      };
    },
  },

  settings: {
    getAll: () => request<{ settings: Record<string, IntegrationSetting> }>('/admin/settings'),

    update: (key: string, data: Partial<IntegrationSetting>) =>
      request<IntegrationSetting>(`/admin/settings/${key}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    testConnection: (key: string, data?: { baseUrl: string; apiKey: string }) =>
      request<TestConnectionResult>(
        `/admin/settings/test/${key}`,
        { method: 'POST', body: data ? JSON.stringify(data) : '{}' }
      ),

    getQualityProfiles: (key: 'radarr' | 'sonarr') =>
      request<QualityProfile[]>(`/admin/settings/${key}/profiles`),

    getRootFolders: (key: 'radarr' | 'sonarr') =>
      request<RootFolder[]>(`/admin/settings/${key}/folders`),
  },
};
