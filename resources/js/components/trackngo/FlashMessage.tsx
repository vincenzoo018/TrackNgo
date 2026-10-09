import { usePage } from '@inertiajs/react';
import { CheckCircle2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * The server's success / error message after a form on the page (flash.success / flash.error), shown as a toast that
 * hides itself after a few seconds. Used by the configuration pages; document pages show their own toasts.
 */
export function FlashMessage() {
    const { flash } = usePage<any>().props;
    const text: string | null = flash?.error || flash?.success || null;
    const isError = Boolean(flash?.error);
    const [hidden, setHidden] = useState<string | null>(null);

    useEffect(() => {
        if (!text) {
            return;
        }
        const timer = setTimeout(() => setHidden(text), 4500);

        return () => clearTimeout(timer);
    }, [text]);

    if (!text || hidden === text) {
        return null;
    }

    return (
        <div
            role="status"
            className={`fixed top-4 right-4 z-[60] flex max-w-md items-start gap-2 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${isError ? 'bg-red-600' : 'bg-emerald-600'}`}
        >
            {!isError && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
            <span className="min-w-0 flex-1">{text}</span>
            <button type="button" onClick={() => setHidden(text)} className="shrink-0 rounded p-0.5 hover:bg-white/15" aria-label="Dismiss">
                <X className="h-4 w-4" />
            </button>
        </div>
    );
}
