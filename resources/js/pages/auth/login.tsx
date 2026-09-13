import { Head, useForm, Link } from '@inertiajs/react';
import { useState, FormEventHandler } from 'react';
import { Mail, Lock, Eye, EyeOff, Loader2, ShieldCheck, QrCode, Search, ArrowRight } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

export default function Login() {
    const [showPassword, setShowPassword] = useState(false);

    const { data, setData, post, processing, errors } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post('/login');
    };

    return (
        <div className="flex min-h-screen bg-slate-100 lg:flex-row flex-col font-sans selection:bg-[#0066cc] selection:text-white">
            <Head title="Log in — TrackNGo Mati" />

            {/* ── Left Half: Civic Tech Brand & Trust Experience ─────────────────── */}
            <div className="relative flex flex-col items-center justify-between bg-gradient-to-br from-[#06142a] via-[#0c2244] to-[#08172e] p-8 lg:p-12 text-center text-white lg:w-1/2 lg:min-h-screen overflow-hidden">
                {/* Modern subtle ambient light orbs */}
                <div className="absolute top-[-10%] left-[-10%] h-[350px] w-[350px] rounded-full bg-blue-500/15 blur-[100px] pointer-events-none" />
                <div className="absolute bottom-[-10%] right-[-10%] h-[400px] w-[400px] rounded-full bg-cyan-400/10 blur-[120px] pointer-events-none" />
                <div className="absolute inset-0 bg-[radial-gradient(#1e40af_1px,transparent_1px)] [background-size:24px_24px] opacity-15 pointer-events-none" />

                {/* Top Pill Badge */}
                <div className="relative z-10 w-full flex justify-center lg:justify-start pt-2">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 shadow-sm text-xs font-semibold text-blue-100 tracking-wide">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Republic of the Philippines</span>
                        <span className="text-white/40">•</span>
                        <span>City of Mati</span>
                    </div>
                </div>

                {/* Center Showcase: Illuminated Seal + Brand Typography */}
                <div className="relative z-10 flex flex-col items-center justify-center py-8 w-full max-w-lg my-auto">
                    {/* Seal with soft ambient luminous halo */}
                    <div className="relative flex items-center justify-center group mb-6">
                        <div className="absolute inset-0 rounded-full bg-blue-500/25 blur-2xl transition-all duration-700 group-hover:bg-blue-400/35" />
                        <div className="relative rounded-full p-2 bg-gradient-to-b from-white/15 to-white/5 backdrop-blur-sm border border-white/20 shadow-2xl">
                            <img 
                                src="/image/login-half-page-seal-transparent.png" 
                                alt="City of Mati Seal" 
                                className="h-[170px] sm:h-[200px] xl:h-[230px] w-auto object-contain drop-shadow-[0_15px_25px_rgba(0,0,0,0.6)] transition-transform duration-500 group-hover:scale-105" 
                            />
                        </div>
                    </div>

                    {/* Brand Name & Tagline */}
                    <div className="space-y-2 text-center">
                        <div className="inline-flex items-center gap-2.5">
                            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white drop-shadow-md">
                                Track<span className="text-blue-400">N</span>Go
                            </h1>
                            <span className="px-2.5 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[11px] font-bold uppercase tracking-wider">
                                LGU Portal
                            </span>
                        </div>
                        <p className="text-sm sm:text-base font-medium text-blue-100/80 max-w-sm mx-auto leading-relaxed">
                            Document Management &amp; Tracking System
                        </p>
                        <p className="text-xs text-blue-300/60 font-normal">
                            Office of the City Mayor • Davao Oriental
                        </p>
                    </div>

                    {/* 3 Modern Trust & Feature Highlight Badges */}
                    <div className="grid grid-cols-3 gap-2.5 sm:gap-3 w-full max-w-md mt-8">
                        <div className="rounded-xl bg-white/[0.07] border border-white/10 p-3 backdrop-blur-sm text-left transition-all hover:bg-white/10">
                            <div className="h-7 w-7 rounded-lg bg-blue-500/20 flex items-center justify-center mb-2 text-blue-300">
                                <ShieldCheck className="h-4 w-4" />
                            </div>
                            <p className="text-xs font-bold text-white">ARTA Ready</p>
                            <p className="text-[11px] text-blue-200/60 leading-tight mt-0.5">Automated SLAs</p>
                        </div>
                        <div className="rounded-xl bg-white/[0.07] border border-white/10 p-3 backdrop-blur-sm text-left transition-all hover:bg-white/10">
                            <div className="h-7 w-7 rounded-lg bg-cyan-500/20 flex items-center justify-center mb-2 text-cyan-300">
                                <QrCode className="h-4 w-4" />
                            </div>
                            <p className="text-xs font-bold text-white">QR Slips</p>
                            <p className="text-[11px] text-blue-200/60 leading-tight mt-0.5">Instant routing</p>
                        </div>
                        <div className="rounded-xl bg-white/[0.07] border border-white/10 p-3 backdrop-blur-sm text-left transition-all hover:bg-white/10">
                            <div className="h-7 w-7 rounded-lg bg-emerald-500/20 flex items-center justify-center mb-2 text-emerald-300">
                                <Lock className="h-4 w-4" />
                            </div>
                            <p className="text-xs font-bold text-white">Encrypted</p>
                            <p className="text-[11px] text-blue-200/60 leading-tight mt-0.5">Digital audit trail</p>
                        </div>
                    </div>
                </div>

                {/* Bottom Footer & System Tagline */}
                <div className="relative z-10 w-full text-center pt-2">
                    <p className="text-xs text-blue-300/50">
                        &copy; {new Date().getFullYear()} City Government of Mati. All rights reserved.
                    </p>
                </div>
            </div>

            {/* ── Right Half: Modern Elevated Login Card ─────────────────────────── */}
            <div className="flex w-full flex-col items-center justify-center p-6 sm:p-10 lg:w-1/2 min-h-screen relative bg-gradient-to-b from-slate-50 to-slate-100/80">
                {/* Subtle ambient light accents behind the card */}
                <div className="absolute top-1/4 right-1/4 h-[300px] w-[300px] rounded-full bg-blue-200/30 blur-[100px] pointer-events-none" />

                {/* Modern Elevated Card Container */}
                <div className="w-full max-w-[440px] bg-white/95 backdrop-blur-md rounded-2xl p-8 sm:p-10 border border-slate-200/80 shadow-[0_20px_50px_-15px_rgba(15,23,42,0.1),0_0_0_1px_rgba(226,232,240,0.8)] relative z-10 transition-all">
                    {/* Header with Civic Shield Icon */}
                    <div className="mb-7 text-center">
                        <div className="mx-auto mb-3.5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#0066cc] to-blue-500 text-white shadow-md shadow-blue-600/25">
                            <Lock className="h-5 w-5" />
                        </div>
                        <h2 className="text-[24px] font-extrabold text-slate-900 tracking-tight">
                            Welcome back
                        </h2>
                        <p className="mt-1 text-[14px] font-normal text-slate-500 leading-relaxed">
                            Sign in with your official account credentials
                        </p>
                    </div>

                    <form onSubmit={submit} className="space-y-4" role="form" aria-label="Login form">
                        {/* Email Input Field */}
                        <div className="space-y-1.5">
                            <label 
                                htmlFor="email" 
                                className="block text-[13px] font-semibold text-slate-700"
                            >
                                Email address
                            </label>
                            <div className="relative group">
                                <Mail 
                                    className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 group-focus-within:text-[#0066cc] transition-colors pointer-events-none" 
                                    aria-hidden="true" 
                                />
                                <input
                                    id="email"
                                    type="email"
                                    name="email"
                                    required
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                    placeholder="name@trackngo.gov.ph"
                                    autoComplete="username"
                                    aria-invalid={errors.email ? 'true' : 'false'}
                                    aria-describedby={errors.email ? 'email-error' : undefined}
                                    className="block w-full h-[46px] rounded-xl border border-slate-300 bg-slate-50/50 hover:bg-slate-50 focus:bg-white pl-10 pr-3.5 text-[14px] font-medium text-slate-900 placeholder:text-slate-400 focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/15 focus:outline-none transition-all shadow-2xs"
                                />
                            </div>
                            {errors.email && (
                                <p id="email-error" className="text-[12px] text-rose-600 font-medium mt-1">
                                    {errors.email}
                                </p>
                            )}
                        </div>

                        {/* Password Input Field */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label 
                                    htmlFor="password" 
                                    className="block text-[13px] font-semibold text-slate-700"
                                >
                                    Password
                                </label>
                                <Link 
                                    href="/forgot-password" 
                                    className="text-[12px] font-semibold text-[#0066cc] hover:text-[#004c99] hover:underline focus:outline-none transition-colors"
                                >
                                    Forgot password?
                                </Link>
                            </div>
                            <div className="relative group">
                                <Lock 
                                    className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 group-focus-within:text-[#0066cc] transition-colors pointer-events-none" 
                                    aria-hidden="true" 
                                />
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    required
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    aria-invalid={errors.password ? 'true' : 'false'}
                                    aria-describedby={errors.password ? 'password-error' : undefined}
                                    className="block w-full h-[46px] rounded-xl border border-slate-300 bg-slate-50/50 hover:bg-slate-50 focus:bg-white pl-10 pr-10 text-[14px] font-medium text-slate-900 placeholder:text-slate-400 focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/15 focus:outline-none transition-all font-mono shadow-2xs"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none focus:text-[#0066cc] cursor-pointer p-1 rounded-md hover:bg-slate-100 transition-colors"
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            {errors.password && (
                                <p id="password-error" className="text-[12px] text-rose-600 font-medium mt-1">
                                    {errors.password}
                                </p>
                            )}
                        </div>

                        {/* “Remember me for 30 days” */}
                        <div className="flex items-center space-x-2.5 pt-1">
                            <Checkbox
                                id="remember"
                                checked={data.remember}
                                onCheckedChange={(checked) => setData('remember', checked as boolean)}
                                className="h-4 w-4 rounded-[4px] border-slate-300 data-[state=checked]:bg-[#0066cc] data-[state=checked]:border-[#0066cc] data-[state=checked]:text-white focus-visible:ring-[#0066cc]/30"
                                aria-label="Remember me for 30 days"
                            />
                            <label 
                                htmlFor="remember" 
                                className="text-[13px] font-normal text-slate-600 cursor-pointer select-none"
                            >
                                Remember me for 30 days
                            </label>
                        </div>

                        {/* Primary Button */}
                        <button
                            type="submit"
                            disabled={processing}
                            className="mt-3 flex w-full h-[48px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0066cc] via-[#005fb8] to-[#0052a3] hover:from-[#0059b3] hover:to-[#00478f] px-4 text-[15px] font-bold text-white shadow-[0_4px_16px_rgba(0,102,204,0.32)] hover:shadow-[0_6px_22px_rgba(0,102,204,0.42)] active:scale-[0.99] disabled:bg-slate-300 disabled:from-slate-300 disabled:to-slate-300 disabled:text-slate-500 disabled:shadow-none disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-4 focus:ring-[#0066cc]/30 transition-all"
                        >
                            {processing ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>Signing in...</span>
                                </>
                            ) : (
                                'Sign in'
                            )}
                        </button>
                    </form>

                    {/* Public Portal Shortcut Banner */}
                    <div className="mt-6 rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50/80 to-indigo-50/60 p-3.5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0066cc] text-white shadow-xs">
                                <Search className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[12px] font-bold text-slate-900 truncate">Public Document Tracking</p>
                                <p className="text-[11px] text-slate-500 truncate">Track tracking status without login</p>
                            </div>
                        </div>
                        <Link
                            href="/track"
                            className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-[12px] font-semibold text-[#0066cc] border border-blue-200 shadow-2xs hover:bg-blue-50 transition-colors"
                        >
                            <span>Track</span>
                            <ArrowRight className="h-3 w-3" />
                        </Link>
                    </div>

                    {/* Secondary links */}
                    <div className="mt-6 text-center border-t border-slate-100 pt-5 space-y-2">
                        <p className="text-[12px] text-slate-500">
                            Need an account? Contact the{' '}
                            <span className="font-semibold text-slate-700">System Administrator</span>
                        </p>
                        <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
                            <Lock className="h-3 w-3 text-slate-400" />
                            <span>Authorized Personnel Access • 256-Bit SSL Encrypted</span>
                        </p>
                    </div>
                </div>

                {/* Mobile Footer */}
                <div className="text-[12px] text-slate-400 mt-6 lg:hidden block text-center">
                    &copy; {new Date().getFullYear()} Office of the Mayor, City of Mati.
                </div>
            </div>
        </div>
    );
}
