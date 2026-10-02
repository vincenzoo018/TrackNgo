/**
 * QR codes drawn in the app itself (no online QR service, so they also work offline). Document QR codes open
 * the public tracking page, e.g. http://192.168.1.5:8000/track?tn=RS-2026-0042, so a phone camera can scan them.
 */
import { usePage } from '@inertiajs/react';
import { create } from 'qrcode';
import { useCallback } from 'react';

/** SVG markup of a QR code (black modules on white, `margin` modules of quiet zone). */
export function qrSvg(value: string, margin = 2): string {
    const { modules } = create(value || ' ', { errorCorrectionLevel: 'M' });
    const size = modules.size;
    const full = size + margin * 2;
    let path = '';

    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            if (modules.data[row * size + col]) {
                path += `M${col + margin} ${row + margin}h1v1h-1z`;
            }
        }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${full} ${full}" shape-rendering="crispEdges"><rect width="${full}" height="${full}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}

/** Image URL of a QR code, usable in <img src>, downloads and print windows. */
export function qrDataUrl(value: string): string {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg(value))}`;
}

/** Public tracking page link for a tracking / reference number. */
export function trackingLink(baseUrl: string, trackingNumber: string): string {
    return `${baseUrl.replace(/\/$/, '')}/track?tn=${encodeURIComponent(trackingNumber)}`;
}

/**
 * Builds tracking links from the server-provided address (the LAN IP instead of "localhost", or TRACKING_URL),
 * falling back to the address the page is open on.
 */
export function useTrackingLink(): (trackingNumber: string) => string {
    const base =
        (usePage().props as any).tracking?.base_url ||
        (typeof window !== 'undefined' ? window.location.origin : '');

    return useCallback(
        (trackingNumber: string) => trackingLink(base, trackingNumber),
        [base],
    );
}
