import { API_URL } from '../constants/Config';

/**
 * Resolve a relative image URL (e.g. "/static/meal-images/abc.png")
 * to an absolute URL using the backend base URL.
 *
 * If the URL is already absolute (starts with http), returns as-is.
 * Returns null if no URL provided.
 */
export function resolveImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;

  // Already absolute
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }

  // API_URL ends with "/api", so strip it to get the server base
  const baseUrl = API_URL.replace(/\/api\/?$/, '');
  return `${baseUrl}${imageUrl}`;
}
