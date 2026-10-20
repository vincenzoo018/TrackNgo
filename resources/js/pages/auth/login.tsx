import { Head, useForm, Link } from '@inertiajs/react';
import { Mail, Lock, Eye, EyeOff, Loader2, ArrowRight, Search, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useRef, useState } from 'react';
import type { FormEventHandler } from 'react';
import TurnstileWidget from '@/components/turnstile-widget';
import type { TurnstileHandle } from '@/components/turnstile-widget';
import { Checkbox } from '@/components/ui/checkbox';

interface LoginProps {
    status?: string;
    canResetPassword?: boolean;
    /** Cloudflare Turnstile public key; null when the captcha is off */
    turnstileSiteKey?: string | null;
}

const inputClass =
    'block h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 text-[15px] text-slate-900 shadow-xs outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-[var(--tng-blue-600)] focus:ring-4 focus:ring-[var(--tng-blue-600)]/15 aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:ring-red-500/15';

const iconClass =
    'pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[var(--tng-blue-600)]';

function FieldError({ id, message }: { id: string; message?: string }) {
    if (!message) return null;
    return (
        <p id={id} className="mt-1.5 flex items-center gap-1.5 text-[13px] font-medium text-red-600">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {message}
        </p>
    );
}

export default function Login({ status, canResetPassword = true, turnstileSiteKey = null }: LoginProps) {
    const [showPassword, setShowPassword] = useState(false);
    const captcha = useRef<TurnstileHandle>(null);
    const year = new Date().getFullYear();

    const { data, setData, post, processing, errors, setError, clearErrors } = useForm({
        email: '',
        password: '',
        remember: false,
        turnstile_token: '',
    });

    const handleCaptchaToken = (token: string) => {
        setData('turnstile_token', token);

        if (token) {
            clearErrors('turnstile_token');
        }
    };

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        if (turnstileSiteKey && !data.turnstile_token) {
            setError('turnstile_token', 'Please complete the security check.');

            return;
        }

        try {
            sessionStorage.removeItem('tng_login_toasts_shown_for_session');
            sessionStorage.setItem('tng_just_logged_in', 'true');
        } catch (err) {}

        // A token passes only once: get a fresh one whenever the login does not go through
        post('/login', { onFinish: () => captcha.current?.reset() });
    };

    return (
        <div className="flex min-h-dvh flex-col bg-white font-sans lg:flex-row">
            <Head title="Log in — TrackNGo Mati" />

            {/* Brand panel (desktop) */}
            <aside className="relative isolate hidden overflow-hidden bg-[linear-gradient(155deg,#0a1a40_0%,#12317a_55%,#1e40af_100%)] text-white lg:flex lg:w-[48%] lg:flex-col lg:justify-between lg:p-12 xl:p-14">
                <div className="absolute -left-1/4 -top-1/4 -z-10 size-[80%] rounded-full bg-blue-400/20 blur-3xl" aria-hidden="true" />
                <div
                    className="absolute inset-0 -z-10 bg-[radial-gradient(rgba(255,255,255,0.5)_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.12] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]"
                    aria-hidden="true"
                />
                <img
                    src="/image/mati-seal.png"
                    alt=""
                    aria-hidden="true"
                    className="absolute -bottom-[22%] -right-[22%] -z-10 w-[70%] opacity-[0.04] grayscale"
                />

                <p className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-blue-100/80">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-300" aria-hidden="true" />
                    Office of the Mayor &middot; City of Mati
                </p>

                <div className="flex flex-col items-center text-center">
                    <div className="relative grid place-items-center">
                        <span className="absolute aspect-square w-[150%] rounded-full border border-white/10" aria-hidden="true" />
                        <span className="absolute aspect-square w-[205%] rounded-full border border-white/[0.06]" aria-hidden="true" />
                        <span className="absolute aspect-square w-[115%] rounded-full bg-blue-300/15 blur-2xl" aria-hidden="true" />
                        <img
                            src="/image/mati-seal.png"
                            alt="Seal of the City of Mati"
                            className="relative w-[clamp(160px,15vw,232px)] drop-shadow-[0_20px_35px_rgba(0,0,0,0.45)]"
                        />
                    </div>
                    <h1 className="mt-14 text-[40px] font-bold leading-none tracking-tight xl:text-[44px]">TrackNGo</h1>
                    <span className="mt-4 h-[3px] w-10 rounded-full bg-amber-300" aria-hidden="true" />
                    <p className="mt-4 text-[17px] text-blue-100/85">Document Management System</p>
                </div>

                <p className="text-xs text-blue-200/60">
                    &copy; {year} City Government of Mati. All rights reserved.
                </p>
            </aside>

            {/* Brand header (mobile / tablet) */}
            <header className="relative isolate overflow-hidden bg-[linear-gradient(155deg,#0a1a40_0%,#12317a_55%,#1e40af_100%)] px-5 py-5 text-white sm:px-8 lg:hidden">
                <div className="absolute -right-10 -top-16 -z-10 size-48 rounded-full bg-blue-400/25 blur-3xl" aria-hidden="true" />
                <div className="mx-auto flex max-w-[400px] items-center gap-3.5">
                    <img src="/image/mati-seal.png" alt="Seal of the City of Mati" className="h-12 w-auto drop-shadow-md" />
                    <div className="min-w-0">
                        <p className="text-lg font-bold leading-tight tracking-tight">TrackNGo</p>
                        <p className="truncate text-xs text-blue-100/80">Office of the Mayor &middot; City of Mati</p>
                    </div>
                </div>
            </header>

            {/* Login form */}
            <main className="flex flex-1 flex-col">
                <div className="flex flex-1 items-start justify-center px-5 py-10 sm:items-center sm:px-8 lg:px-12">
                    <div className="tng-fade-in w-full max-w-[400px]">
                        <h2 className="text-[28px] font-bold leading-tight tracking-tight text-slate-900">Welcome back</h2>
                        <p className="mt-2 text-[15px] text-slate-500">Sign in to your TrackNGo account.</p>

                        {status && (
                            <div className="mt-6 flex items-start gap-2.5 rounded-lg border border-green-200 bg-green-50 px-3.5 py-3 text-[14px] text-green-800">
                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-hidden="true" />
                                <span>{status}</span>
                            </div>
                        )}

                        <form onSubmit={submit} className="mt-8 space-y-5" aria-label="Login form">
                            <div>
                                <label htmlFor="email" className="mb-1.5 block text-[14px] font-medium text-slate-700">
                                    Email address
                                </label>
                                <div className="group relative">
                                    <Mail className={iconClass} aria-hidden="true" />
                                    <input
                                        id="email"
                                        type="email"
                                        name="email"
                                        required
                                        autoFocus
                                        value={data.email}
                                        onChange={(e) => setData('email', e.target.value)}
                                        placeholder="name@trackngo.gov.ph"
                                        autoComplete="username"
                                        aria-invalid={errors.email ? 'true' : 'false'}
                                        aria-describedby={errors.email ? 'email-error' : undefined}
                                        className={`${inputClass} pr-3.5`}
                                    />
                                </div>
                                <FieldError id="email-error" message={errors.email} />
                            </div>

                            <div>
                                <div className="mb-1.5 flex items-center justify-between">
                                    <label htmlFor="password" className="block text-[14px] font-medium text-slate-700">
                                        Password
                                    </label>
                                    {canResetPassword && (
                                        <Link
                                            href="/forgot-password"
                                            className="rounded text-[13px] font-medium text-[var(--tng-blue-700)] hover:text-[var(--tng-blue-800)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tng-blue-600)]"
                                        >
                                            Forgot password?
                                        </Link>
                                    )}
                                </div>
                                <div className="group relative">
                                    <Lock className={iconClass} aria-hidden="true" />
                                    <input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        name="password"
                                        required
                                        value={data.password}
                                        onChange={(e) => setData('password', e.target.value)}
                                        placeholder="Enter your password"
                                        autoComplete="current-password"
                                        aria-invalid={errors.password ? 'true' : 'false'}
                                        aria-describedby={errors.password ? 'password-error' : undefined}
                                        className={`${inputClass} pr-11`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                        tabIndex={-1}
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                <FieldError id="password-error" message={errors.password} />
                            </div>

                            <div className="flex items-center gap-2.5">
                                <Checkbox
                                    id="remember"
                                    checked={data.remember}
                                    onCheckedChange={(checked) => setData('remember', checked === true)}
                                    className="border-slate-300"
                                />
                                <label htmlFor="remember" className="cursor-pointer select-none text-[14px] text-slate-600">
                                    Remember me
                                </label>
                            </div>

                            {turnstileSiteKey && (
                                <div>
                                    <TurnstileWidget
                                        ref={captcha}
                                        siteKey={turnstileSiteKey}
                                        action="login"
                                        theme="light"
                                        onTokenChange={handleCaptchaToken}
                                    />
                                    <FieldError id="turnstile-error" message={errors.turnstile_token} />
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={processing}
                                className="group flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[var(--tng-blue-800)] px-4 text-[15px] font-semibold text-white shadow-md shadow-blue-900/20 outline-none transition hover:bg-[#1e3a8a] focus-visible:ring-4 focus-visible:ring-[var(--tng-blue-600)]/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                {processing ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Logging in…</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Log in</span>
                                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="my-7 flex items-center gap-3 text-[12px] font-medium uppercase tracking-wider text-slate-400">
                            <span className="h-px flex-1 bg-slate-200" />
                            or
                            <span className="h-px flex-1 bg-slate-200" />
                        </div>

                        <Link
                            href="/track"
                            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-[15px] font-medium text-slate-700 shadow-xs transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--tng-blue-600)]/20"
                        >
                            <Search className="h-4 w-4 text-slate-500" aria-hidden="true" />
                            Track a document
                        </Link>

                        <p className="mt-8 text-center text-[13px] text-slate-500">
                            Need an account? Contact the{' '}
                            <span className="font-medium text-slate-700">System Administrator</span>.
                        </p>
                    </div>
                </div>

                <p className="pb-6 text-center text-[12px] text-slate-400 lg:hidden">
                    &copy; {year} City Government of Mati
                </p>
            </main>
        </div>
    );
}
