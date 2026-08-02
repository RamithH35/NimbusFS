const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * Custom fetch wrapper that adds Authorization headers and handles 401s.
 * 
 * @param {string} path - URL path relative to baseUrl
 * @param {Object} options - Standard fetch options
 * @returns {Promise<any>}
 */
export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('nimbusfs_token');
  const headers = { ...options.headers };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Set content-type for standard objects, but not form-data (which needs browser boundaries)
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    localStorage.removeItem('nimbusfs_token');
    const currentPath = window.location.pathname;
    if (currentPath !== '/login' && currentPath !== '/register' && currentPath !== '/forgot-password') {
      window.location.href = '/login';
    }
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || 'Unauthorized');
  }

  if (res.status === 204) {
    return null;
  }

  const text = await res.text();
  let parsed = {};
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new Error('Invalid response from server');
    }
  }

  if (!res.ok) {
    throw new Error(parsed.error || `HTTP error! Status: ${res.status}`);
  }

  return parsed;
}

export default apiFetch;
