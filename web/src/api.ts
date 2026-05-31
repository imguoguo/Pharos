const BASE_URL = '/api';

let authToken = '';

async function request(method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  const options: RequestInit = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE_URL}${path}`, options);
  if (res.status === 401) {
    localStorage.removeItem('pharos-token');
    window.location.reload();
    return null;
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  get: (path: string) => request('GET', path),
  post: (path: string, body: unknown) => request('POST', path, body),
  put: (path: string, body: unknown) => request('PUT', path, body),
  delete: (path: string) => request('DELETE', path),
  setToken: (token: string) => { authToken = token; },
};
