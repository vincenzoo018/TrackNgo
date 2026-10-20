import { Loader2 } from 'lucide-react';
import {
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from 'react';
import type { Ref } from 'react';

/** Form field the token is posted in (App\Services\Security\Turnstile::FIELD) */
export const TURNSTILE_FIELD = 'turnstile_token';

/** Must be loaded from this exact address: a proxied or cached copy breaks when Cloudflare updates it */
const SCRIPT_URL =
    'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

type TurnstileTheme = 'light' | 'dark' | 'auto';

type TurnstileApi = {
    render: (
        container: HTMLElement,
        options: {
            sitekey: string;
            action: string;
            theme: TurnstileTheme;
            size: 'flexible';
            execution: 'execute';
            appearance: 'execute';
            'refresh-expired': 'manual';
            'response-field-name': string;
            callback: (token: string) => void;
            'expired-callback': () => void;
            'timeout-callback': () => void;
            'error-callback': () => void;
        },
    ) => string | null | undefined;
    execute: (container: HTMLElement) => void;
    reset: (widgetId: string) => void;
    remove: (widgetId: string) => void;
};

declare global {
    interface Window {
        turnstile?: TurnstileApi;
    }
}

let scriptLoading: Promise<TurnstileApi> | null = null;

/** Adds Cloudflare's script once; every widget on later pages reuses it */
function loadTurnstile(): Promise<TurnstileApi> {
    if (window.turnstile) {
        return Promise.resolve(window.turnstile);
    }

    scriptLoading ??= new Promise<TurnstileApi>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = SCRIPT_URL;
        script.async = true;
        script.onload = () =>
            window.turnstile
                ? resolve(window.turnstile)
                : reject(new Error('Turnstile did not start'));
        script.onerror = () => {
            // Let the next page try again, e.g. once the connection is back
            script.remove();
            scriptLoading = null;
            reject(new Error('Turnstile could not be loaded'));
        };
        document.head.appendChild(script);
    });

    return scriptLoading;
}

export type TurnstileHandle = {
    /** Clears the tick: each token passes only once, so call it after every submit */
    reset: () => void;
};

type TurnstileWidgetProps = {
    siteKey: string;
    /** The form, checked by the server: 'login' or 'password_reset' */
    action: string;
    /** The current token, or '' while there is none (not ticked yet, expired or failed) */
    onTokenChange?: (token: string) => void;
    theme?: TurnstileTheme;
    className?: string;
    ref?: Ref<TurnstileHandle>;
};

/**
 * Cloudflare Turnstile captcha with an "I'm not a robot" box: Cloudflare's check starts only when the person ticks
 * it, then Cloudflare's own widget takes its place (Verifying… → Success!, or its checkbox for a suspicious visitor).
 * Inside a form it also adds a hidden `turnstile_token` input, so a plain <Form> posts the token by itself; with
 * useForm, keep it in the form data through onTokenChange.
 */
export default function TurnstileWidget({
    siteKey,
    action,
    onTokenChange,
    theme = 'auto',
    className,
    ref,
}: TurnstileWidgetProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const onTokenChangeRef = useRef(onTokenChange);
    const [ready, setReady] = useState(false);
    const [ticked, setTicked] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);

    useEffect(() => {
        onTokenChangeRef.current = onTokenChange;
    }, [onTokenChange]);

    /** Back to the unticked box, with Cloudflare's widget waiting for the next tick */
    const untick = useCallback(() => {
        onTokenChangeRef.current?.('');
        setTicked(false);

        if (widgetIdRef.current && window.turnstile) {
            window.turnstile.reset(widgetIdRef.current);
        }
    }, []);

    useImperativeHandle(ref, () => ({ reset: untick }), [untick]);

    useEffect(() => {
        let cancelled = false;
        let widgetId: string | null = null;
        const emit = (token: string) => onTokenChangeRef.current?.(token);

        loadTurnstile()
            .then((turnstile) => {
                if (cancelled || !containerRef.current) {
                    return;
                }

                widgetId =
                    turnstile.render(containerRef.current, {
                        sitekey: siteKey,
                        action,
                        theme,
                        size: 'flexible',
                        // Nothing runs, and Cloudflare's widget stays hidden, until the box is ticked
                        execution: 'execute',
                        appearance: 'execute',
                        'refresh-expired': 'manual',
                        'response-field-name': TURNSTILE_FIELD,
                        callback: emit,
                        // An expired token (5 minutes) or an unsolved challenge needs a fresh tick
                        'expired-callback': untick,
                        'timeout-callback': untick,
                        // Cloudflare's widget shows the error itself and retries on its own
                        'error-callback': () => emit(''),
                    }) ?? null;
                widgetIdRef.current = widgetId;
                setTicked(false);
                setReady(widgetId !== null);
            })
            .catch(() => {
                if (!cancelled) {
                    setLoadFailed(true);
                }
            });

        return () => {
            cancelled = true;

            if (widgetId && window.turnstile) {
                window.turnstile.remove(widgetId);
            }

            widgetIdRef.current = null;
        };
    }, [siteKey, action, theme, untick]);

    const tick = () => {
        if (
            !widgetIdRef.current ||
            !containerRef.current ||
            !window.turnstile
        ) {
            return;
        }

        setTicked(true);
        window.turnstile.execute(containerRef.current);
    };

    const dark = theme === 'dark';

    return (
        <div className={className}>
            <div className={loadFailed ? undefined : 'relative min-h-[65px]'}>
                <div ref={containerRef} />
                {!ticked && !loadFailed && (
                    <button
                        type="button"
                        role="checkbox"
                        aria-checked="false"
                        aria-label="I'm not a robot"
                        disabled={!ready}
                        onClick={tick}
                        className={`group absolute inset-0 flex w-full cursor-pointer items-center justify-between gap-3 rounded-[4px] border px-3.5 text-left outline-none focus-visible:ring-4 focus-visible:ring-[var(--tng-blue-600)]/20 disabled:cursor-wait ${dark ? 'border-[#3b3b3b] bg-[#232323] text-[#f2f2f2]' : 'border-[#e0e0e0] bg-[#fafafa] text-[#232323]'}`}
                    >
                        <span className="flex items-center gap-3">
                            {ready ? (
                                <span
                                    aria-hidden="true"
                                    className={`h-[26px] w-[26px] shrink-0 rounded-[3px] border-2 transition-colors ${dark ? 'border-[#8a8a8a] bg-[#2c2c2c] group-hover:border-[#c2c2c2]' : 'border-[#8a8a8a] bg-white group-hover:border-[#4a4a4a]'}`}
                                />
                            ) : (
                                <Loader2
                                    aria-hidden="true"
                                    className="h-[26px] w-[26px] shrink-0 animate-spin text-[#8a8a8a]"
                                />
                            )}
                            <span className="text-[14px]">I'm not a robot</span>
                        </span>
                        <span
                            className={`shrink-0 text-right text-[10px] leading-tight ${dark ? 'text-[#b5b5b5]' : 'text-[#6b6b6b]'}`}
                        >
                            Protected by
                            <br />
                            <span className="font-semibold tracking-wide">
                                Cloudflare
                            </span>
                        </span>
                    </button>
                )}
            </div>
            {loadFailed && (
                <p
                    role="alert"
                    className="mt-1.5 text-[13px] font-medium text-red-600"
                >
                    The security check couldn't load. Check your internet
                    connection, then refresh the page.
                </p>
            )}
        </div>
    );
}
