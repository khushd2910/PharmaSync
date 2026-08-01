// Builds an absolute URL for a medicine image served from the server's
// /uploads static folder. VITE_API_URL points at the API (e.g.
// "https://api.example.com/api"), but uploaded images are served from the
// same host's root (e.g. "https://api.example.com/uploads/..."), so we
// strip a trailing "/api" to get the origin the images actually live on.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const IMAGE_ORIGIN = API_URL.replace(/\/api\/?$/, '');

// Resolves a medicine's relative imageUrl (e.g. "/uploads/xyz.jpg") into an
// absolute URL. Returns null if no imageUrl is present so callers can fall
// back to a placeholder image.
export const resolveImageUrl = (imageUrl) => {
  if (!imageUrl) return null;
  return `${IMAGE_ORIGIN}${imageUrl}`;
};
