/**
 * Live updates without per-page polling. One check of /api/changes every 15 seconds (paused while the tab is
 * hidden, checked again as soon as it is shown) compares light stamps and announces what changed as window events:
 *   tng:changed:documents | trail | comments | attachments | notifications
 * Pages listen with useLiveUpdates() and reload only their own props, so the server is not hit every few seconds
 * by every open page.
 */
import { useEffect, useRef } from 'react';

export type LiveUpdateKey = 'documents' | 'trail' | 'comments' | 'attachments' | 'notifications';

const INTERVAL_MS = 15_000;

let started = false;
let last: Record<string, string> | null = null;
let inFlight = false;

async function check(): Promise<void> {
    if (inFlight || typeof document === 'undefined' || document.visibilityState !== 'visible') {
        return;
    }

    inFlight = true;

    try {
        const res = await fetch('/api/changes', { headers: { Accept: 'application/json' }, credentials: 'same-origin' });

        if (!res.ok) {
            return;
        }

        const { stamps } = (await res.json()) as { stamps: Record<string, string> };

        if (last) {
            const changed = Object.keys(stamps).filter((key) => stamps[key] !== last?.[key]);
            changed.forEach((key) => window.dispatchEvent(new CustomEvent(`tng:changed:${key}`)));
        }

        last = stamps;
    } catch {
        // Offline for a moment: try again at the next check
    } finally {
        inFlight = false;
    }
}

/** Starts the shared check once per page load (the layout calls it; useLiveUpdates does too). */
export function startLiveUpdates(): void {
    if (started || typeof window === 'undefined') {
        return;
    }

    started = true;
    void check();
    window.setInterval(() => void check(), INTERVAL_MS);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            void check();
        }
    });
}

/** Runs onChange whenever one of the given kinds of data changed somewhere in the system. */
export function useLiveUpdates(keys: LiveUpdateKey[], onChange: () => void): void {
    const callback = useRef(onChange);

    useEffect(() => {
        callback.current = onChange;
    });

    const signature = keys.join(',');

    useEffect(() => {
        startLiveUpdates();
        const handler = () => callback.current();
        const names = signature.split(',').filter(Boolean).map((key) => `tng:changed:${key}`);
        names.forEach((name) => window.addEventListener(name, handler));

        return () => names.forEach((name) => window.removeEventListener(name, handler));
    }, [signature]);
}
