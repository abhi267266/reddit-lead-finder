import { fetchAuthSession } from 'aws-amplify/auth';

export async function authFetch(url: string, options: RequestInit = {}) {
  try {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString() || session.tokens?.accessToken?.toString();

    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    return fetch(url, {
      ...options,
      headers,
    });
  } catch (err) {
    // If auth session fails (e.g., not logged in), just send regular fetch
    // so the backend can return a proper 401
    return fetch(url, options);
  }
}
