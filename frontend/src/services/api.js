import axios from 'axios';

const trimTrailingSlash = (value) => (value || '').trim().replace(/\/+$/, '');

// Cloudflare Pages only has the compiled frontend, so it must call the Railway
// API. config.js and VITE_API_BASE_URL are both supported; a host-only value is
// normalised to include /api/v1 so either form works without extra edits.
const normalizeApiBase = (value) => {
  const base = trimTrailingSlash(value);
  if (!base) return '';
  return /\/api\/v\d+$/.test(base) ? base : `${base}/api/v1`;
};

// public/config.js can override the API URL after a build, which keeps
// Cloudflare's drag-and-drop/direct-upload flow usable without rebuilding.
const runtimeBase = normalizeApiBase(
  typeof window !== 'undefined' ? window.__ROADWATCH_API_BASE_URL__ : ''
);

const envBase = runtimeBase || normalizeApiBase(import.meta.env.VITE_API_BASE_URL);

// Resolve the API base URL from wherever the app happens to be served.
// This keeps a copy of the project runnable from any folder name without edits.
const resolveApiBaseUrl = () => {
  if (envBase) {
    return envBase;
  }

  if (typeof window === 'undefined') {
    return 'http://localhost:8000/api/v1';
  }

  const { origin, pathname } = window.location;
  const lowerPath = pathname.toLowerCase();

  // XAMPP/Apache: app served as a static build at <project-root>/frontend/dist/
  const distMarker = '/frontend/dist/';
  const distIndex = lowerPath.indexOf(distMarker);
  if (distIndex !== -1) {
    const projectRoot = pathname.slice(0, distIndex);
    return `${origin}${projectRoot}/backend/public/api/v1`;
  }

  // XAMPP/Apache: page served from within <project-root>/backend/public/
  const backendMarker = '/backend/public/';
  const backendIndex = lowerPath.indexOf(backendMarker);
  if (backendIndex !== -1) {
    const projectRoot = pathname.slice(0, backendIndex);
    return `${origin}${projectRoot}/backend/public/api/v1`;
  }

  // Cloudflare Pages (or any other static host): same-origin fallback. This
  // only works when Cloudflare proxies /api to Railway. Otherwise set
  // VITE_API_BASE_URL during the Pages build, or edit dist/config.js.
  if (import.meta.env.PROD) {
    console.error(
      '[RoadWatch] No backend URL is configured. The frontend will call ' +
      `${origin}/api/v1 instead of the Railway backend. Set ` +
      'VITE_API_BASE_URL in the Cloudflare Pages environment (or edit ' +
      'config.js) and redeploy.'
    );
    return `${origin}/api/v1`;
  }

  // Local Vite development server.
  return 'http://localhost:8000/api/v1';
};

export const API_BASE_URL = resolveApiBaseUrl();

const backendBaseUrl = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

export const getPhotoUrl = (photo) => {
  if (!photo) return '';

  // Serve through the API file endpoint so photos work without the
  // machine-specific `storage:link` symlink.
  if (photo.id) {
    return `${API_BASE_URL}/photos/${photo.id}/file`;
  }

  const url = photo.url || photo.file_path;
  if (!url) return '';

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  const cleanPath = url.replace(/^\/?(storage\/)?/, '');
  return `${backendBaseUrl}/storage/${cleanPath}`;
};

export const getPhotoFallbackUrl = (photo) => {
  if (!photo || !photo.id) return '';
  return `${API_BASE_URL}/photos/${photo.id}/file`;
};

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Accept': 'application/json',
  },
  withCredentials: true,
});

// Attach bearer token if present
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('roadwatch_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

// Extract human-friendly error messages
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    let message = 'An unexpected error occurred.';
    if (error.response?.data?.message) {
      message = error.response.data.message;
    } else if (error.message) {
      message = error.message;
    }
    error.friendlyMessage = message;
    // Laravel 422 field errors: { email: ['...'], phone: ['...'] }
    // Exposed so forms can render messages next to the offending input.
    error.fieldErrors = error.response?.status === 422 ? error.response.data?.errors ?? null : null;
    return Promise.reject(error);
  }
);

export const api = {
  // Auth
  register: (payload) => apiClient.post('/auth/register', payload),
  login: (payload) => apiClient.post('/auth/login', payload),
  logout: () => apiClient.post('/auth/logout'),
  getMe: () => apiClient.get('/auth/me'),
  updateProfile: (payload) => apiClient.put('/auth/profile', payload),

  // Public & Categories
  getCategories: () => apiClient.get('/categories'),
  getPublicMap: () => apiClient.get('/reports/public-map'),
  submitReport: (formData) => apiClient.post('/reports', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),

  // Citizen
  getMyReports: (params) => apiClient.get('/my-reports', { params }),
  getMyDashboard: (params) => apiClient.get('/my-reports/dashboard', { params }),
  getReport: (id) => apiClient.get(`/reports/${id}`),
  supplementReport: (id, formData) => apiClient.put(`/reports/${id}/supplement`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),

  // Notifications
  getNotifications: () => apiClient.get('/notifications'),
  markNotificationRead: (id) => apiClient.put(`/notifications/${id}/read`),
  markAllNotificationsRead: () => apiClient.post('/notifications/mark-all-read'),

  // Admin
  admin: {
    getStats: () => apiClient.get('/admin/dashboard/stats'),
    getReports: (params) => apiClient.get('/admin/reports', { params }),
    getVerificationQueue: (params) => apiClient.get('/admin/verification-queue', { params }),
    assignOfficer: (id, payload) => apiClient.put(`/admin/reports/${id}/assign`, payload),
    requestInfo: (id, payload) => apiClient.put(`/admin/reports/${id}/request-info`, payload),
    deleteReport: (id) => apiClient.delete(`/admin/reports/${id}`),

    getUsers: (params) => apiClient.get('/admin/users', { params }),
    getUser: (id) => apiClient.get(`/admin/users/${id}`),
    createOfficer: (payload) => apiClient.post('/admin/users/officers', payload),
    updateUser: (id, payload) => apiClient.put(`/admin/users/${id}`, payload),
    updateUserRole: (id, payload) => apiClient.put(`/admin/users/${id}/role`, payload),
    updateUserStatus: (id, payload) => apiClient.put(`/admin/users/${id}/status`, payload),
    getOfficers: () => apiClient.get('/admin/officers'),

    getCategories: () => apiClient.get('/admin/categories'),
    createCategory: (payload) => apiClient.post('/admin/categories', payload),
    updateCategory: (id, payload) => apiClient.put(`/admin/categories/${id}`, payload),
    deleteCategory: (id) => apiClient.delete(`/admin/categories/${id}`),

    getAuditLogs: (params) => apiClient.get('/admin/audit-logs', { params }),

    // Exports must be fetched through the authenticated axios client: a bare
    // window.open() does not carry the bearer token and would return 401.
    downloadCsv: (params) => apiClient.get('/admin/exports/csv', { params, responseType: 'blob' }),
    downloadPdf: (params) => apiClient.get('/admin/exports/pdf', { params, responseType: 'blob' }),
  },

  // Officer
  officer: {
    getStats: () => apiClient.get('/officer/dashboard/stats'),
    getAssignedReports: (params) => apiClient.get('/officer/assigned-reports', { params }),
    getVerificationQueue: (params) => apiClient.get('/officer/verification-queue', { params }),
    verifyReport: (id, payload) => apiClient.put(`/officer/reports/${id}/verify`, payload),
    rejectReport: (id, payload) => apiClient.put(`/officer/reports/${id}/reject`, payload),
    updateStatus: (id, payload) => apiClient.put(`/officer/reports/${id}/status`, payload),
  },
};

export default apiClient;
