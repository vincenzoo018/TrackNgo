/**
 * CSRF header for raw fetch() calls. The app has no csrf meta tag, so Laravel's XSRF-TOKEN cookie
 * (the same source Inertia/axios use) is sent as X-XSRF-TOKEN.
 */
export function csrfHeaders(): Record<string, string> {
    const cookie = document.cookie.split('; ').find(c => c.startsWith('XSRF-TOKEN='));
    if (cookie) {
        return { 'X-XSRF-TOKEN': decodeURIComponent(cookie.slice('XSRF-TOKEN='.length)) };
    }
    const meta = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null)?.content;
    return meta ? { 'X-CSRF-TOKEN': meta } : {};
}
