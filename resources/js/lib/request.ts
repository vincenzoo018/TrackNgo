import { csrfHeaders } from '@/lib/csrf';

/**
 * Send a form to a JSON endpoint with fetch(). Throws an Error carrying the server's first validation error or
 * its message (e.g. why a 403 was refused), so the dialog that sent it can show the reason.
 */
export async function requestJson<T = any>(url: string, method: 'POST' | 'PUT', body: FormData | Record<string, unknown>): Promise<T> {
    const isForm = body instanceof FormData;
    const res = await fetch(url, {
        method,
        headers: { ...csrfHeaders(), Accept: 'application/json', ...(isForm ? {} : { 'Content-Type': 'application/json' }) },
        credentials: 'same-origin',
        body: isForm ? body : JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
        const firstError = data?.errors ? Object.values(data.errors).flat()[0] : null;

        throw new Error(
            (firstError as string)
                || data?.message
                || (res.status === 419 ? 'Your session expired. Refresh the page and try again.' : `The request failed (HTTP ${res.status}).`),
        );
    }

    return data as T;
}
