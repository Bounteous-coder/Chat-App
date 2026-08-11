export const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5006';

let accessToken = null;

export const setAccessToken = (token) => {
    accessToken = token;
};

export const getAccessToken = () => accessToken;

export const refresh = async () => {
    const res = await fetch(`${BASE}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
        accessToken = null;
        throw new Error('Unable to refresh session');
    }

    const data = await res.json();
    accessToken = data.accessToken;
    return data;
};

const request = async (path, { method = 'GET', body, isForm = false, _retried = false } = {}) => {
    const headers = {};
    if (!isForm) headers['Content-Type'] = 'application/json';
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    const res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        credentials: 'include',
        body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401 && !_retried && path !== '/api/auth/refresh') {
        try {
            await refresh();
            return request(path, { method, body, isForm, _retried: true });
        } catch {
            // fall through — surface the original 401 to the caller
        }
    }

    let data = null;
    try {
        data = await res.json();
    } catch {
        // empty body, e.g. 204
    }

    if (!res.ok) {
        const error = new Error(data?.error || `Request failed with status ${res.status}`);
        error.status = res.status;
        error.body = data;
        throw error;
    }

    return data;
};

export const api = {
    get: (path) => request(path),
    post: (path, body) => request(path, { method: 'POST', body }),
    postForm: (path, formData) => request(path, { method: 'POST', body: formData, isForm: true }),
    patch: (path, body) => request(path, { method: 'PATCH', body }),
    delete: (path) => request(path, { method: 'DELETE' }),
};
