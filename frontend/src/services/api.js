import axios from 'axios';

const trimTrailingSlash = (value) => (value || '').replace(/\/+$/, '');

// Resolve the API base URL from wherever the app happens to be served.
// This keeps a copy of the project runnable from any folder name without edits.
const resolveApiBaseUrl = () => {
  const envBase = import.meta.env.VITE_API_BASE_URL;

  if (typeof window === 'undefined') {
    return trimTrailingSlash(envBase || 'http://localhost:8000/api/v1');
  }

  const { origin, pathname } = window.location;
  const lowerPath = pathname.toLowerCase();

  // Production/Apache: app served as a static build at <project-root>/frontend/dist/
  const distMarker = '/frontend/dist/';
  const distIndex = lowerPath.indexOf(distMarker);
  if (distIndex !== -1) {
    const projectRoot = pathname.slice(0, distIndex);
    return `${origin}${projectRoot}/backend/public/api/v1`;
  }

  // Apache: page served from within <project-root>/backend/public/
  const backendMarker = '/backend/public/';
  const backendIndex = lowerPath.indexOf(backendMarker);
  if (backendIndex !== -1) {
    const projectRoot = pathname.slice(0, backendIndex);
    return `${origin}${projectRoot}/backend/public/api/v1`;
  }

  // Development fallback (Vite dev server or explicit override)
  return trimTrailingSlash(envBase || 'http://localhost:8000/api/v1');
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
    verifyReport: (id, payload) => apiClient.put(`/admin/reports/${id}/verify`, payload),
    rejectReport: (id, payload) => apiClient.put(`/admin/reports/${id}/reject`, payload),
    assignOfficer: (id, payload) => apiClient.put(`/admin/reports/${id}/assign`, payload),
    requestInfo: (id, payload) => apiClient.put(`/admin/reports/${id}/request-info`, payload),
    closeReport: (id, payload) => apiClient.put(`/admin/reports/${id}/close`, payload),
    deleteReport: (id) => apiClient.delete(`/admin/reports/${id}`),

    getUsers: (params) => apiClient.get('/admin/users', { params }),
    updateUserRole: (id, payload) => apiClient.put(`/admin/users/${id}/role`, payload),
    getOfficers: () => apiClient.get('/admin/officers'),

    getCategories: () => apiClient.get('/admin/categories'),
    createCategory: (payload) => apiClient.post('/admin/categories', payload),
    updateCategory: (id, payload) => apiClient.put(`/admin/categories/${id}`, payload),
    deleteCategory: (id) => apiClient.delete(`/admin/categories/${id}`),

    getAuditLogs: (params) => apiClient.get('/admin/audit-logs', { params }),
    getCsvExportUrl: () => `${API_BASE_URL}/admin/exports/csv`,
    getPdfExportUrl: () => `${API_BASE_URL}/admin/exports/pdf`,
  },

  // Officer
  officer: {
    getStats: () => apiClient.get('/officer/dashboard/stats'),
    getAssignedReports: (params) => apiClient.get('/officer/assigned-reports', { params }),
    updateStatus: (id, payload) => apiClient.put(`/officer/reports/${id}/status`, payload),
  },
};

export default apiClient;
