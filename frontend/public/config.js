// Runtime configuration for deployments that upload the prebuilt dist folder
// (Cloudflare Pages direct upload, a static file host, etc.).
//
// Set this to your Railway API base URL, then upload dist/. This avoids
// rebuilding the frontend just to change the backend address.
//
// Example:
//   window.__ROADWATCH_API_BASE_URL__ = 'https://your-service.up.railway.app/api/v1';
//
// Leave it empty to use VITE_API_BASE_URL (baked in at build time) or the
// automatic XAMPP/localhost detection in src/services/api.js.
window.__ROADWATCH_API_BASE_URL__ = '';
