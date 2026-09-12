import { Head, useForm, Link } from '@inertiajs/react';
import { useState, FormEventHandler } from 'react';
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
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
        <div className="flex min-h-screen bg-[var(--tng-slate-50)] lg:flex-row flex-col font-sans">
            <Head title="Log in — TrackNGo Mati" />

            {/* Left Half: City of Mati Image Panel */}
            <div className="relative flex flex-col items-center justify-between bg-[var(--tng-blue-900)] p-6 lg:p-10 text-center text-white lg:w-1/2 lg:min-h-screen overflow-hidden">
                {/* Background radial highlight */}
                <div className="absolute inset-0 opacity-15 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-400 via-transparent to-transparent pointer-events-none" />

                {/* Top Subtle Header */}
                <div className="relative z-10 w-full text-center lg:text-left pt-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-xs border border-white/10 text-xs font-semibold text-blue-100 tracking-wide">
                        <span>Office of the Mayor &bull; City of Mati</span>
                    </div>
                </div>

                {/* City of Mati Image: scaled to fit half-page layout */}
                <div className="relative z-10 flex flex-1 items-center justify-center py-6 w-full max-w-[960px]">
                    <img 
                        src="/image/login-half-page-seal-transparent.png" 
                        alt="City of Mati" 
                        className="max-h-[50vh] sm:max-h-[60vh] lg:max-h-[75vh] xl:max-h-[82vh] w-auto max-w-full object-contain drop-shadow-[0_25px_40px_rgba(0,0,0,0.5)] transition-transform duration-500 hover:scale-[1.015]" 
                    />
                </div>

                {/* Bottom Footer & System Tagline */}
                <div className="relative z-10 w-full text-center pb-2">
                    <h1 className="text-[20px] font-bold tracking-wide">TrackNGo</h1>
                    <p className="text-sm font-normal text-blue-200/90 mt-1">
                        Document Management System
                    </p>
                    <p className="text-xs text-blue-300/60 mt-3 hidden lg:block">
                        &copy; {new Date().getFullYear()} City Government of Mati. All rights reserved.
                    </p>
                </div>
            </div>

            {/* Right Half: Redesigned Login Form Panel */}
            <div className="flex w-full flex-col items-center justify-center p-6 lg:w-1/2 min-h-screen relative">
                {/* Card-style container: 8px radius, 32px padding, subtle shadow (0 2px 6px rgba(0,0,0,0.1)) */}
                <div 
                    className="w-full max-w-[420px] bg-white rounded-[8px] p-[32px] border border-slate-200/80 shadow-[0_2px_6px_rgba(0,0,0,0.1)] transition-all"
                    style={{ boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)' }}
                >
                    {/* Typography: Heading 22px bold & Subtext 14px regular */}
                    <div className="mb-6 text-center">
                        <h2 className="text-[22px] font-bold text-slate-900 leading-tight">
                            Welcome back
                        </h2>
                        <p className="mt-1.5 text-[14px] font-normal text-slate-500 leading-relaxed">
                            Please enter your credentials to securely log in
                        </p>
                    </div>

                    <form onSubmit={submit} className="space-y-4" role="form" aria-label="Login form">
                        {/* Email Input Field */}
                        <div className="space-y-1.5">
                            <label 
                                htmlFor="email" 
                                className="block text-[14px] font-semibold text-slate-700"
                            >
                                Email address
                            </label>
                            <div className="relative">
                                <Mail 
                                    className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999] pointer-events-none" 
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
                                    className="block w-full h-[44px] rounded-[6px] border border-slate-300 bg-white pl-10 pr-3.5 text-[14px] font-normal text-slate-800 placeholder:text-[#999] focus:border-[#0066cc] focus:ring-2 focus:ring-[#0066cc]/20 focus:outline-none transition-all"
                                />
                            </div>
                            {errors.email && (
                                <p id="email-error" className="text-[12px] text-red-600 font-medium mt-1">
                                    {errors.email}
                                </p>
                            )}
                        </div>

                        {/* Password Input Field */}
                        <div className="space-y-1.5">
                            <label 
                                htmlFor="password" 
                                className="block text-[14px] font-semibold text-slate-700"
                            >
                                Password
                            </label>
                            <div className="relative">
                                <Lock 
                                    className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999] pointer-events-none" 
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
                                    className="block w-full h-[44px] rounded-[6px] border border-slate-300 bg-white pl-10 pr-10 text-[14px] font-normal text-slate-800 placeholder:text-[#999] focus:border-[#0066cc] focus:ring-2 focus:ring-[#0066cc]/20 focus:outline-none transition-all font-mono"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none focus:text-[#0066cc] cursor-pointer p-1"
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            {errors.password && (
                                <p id="password-error" className="text-[12px] text-red-600 font-medium mt-1">
                                    {errors.password}
                                </p>
                            )}

                            {/* “Forgot password?” → 12px, aligned right under password field */}
                            <div className="flex justify-end pt-0.5">
                                <Link 
                                    href="/forgot-password" 
                                    className="text-[12px] font-medium text-[#0066cc] hover:underline focus:outline-none focus:ring-1 focus:ring-[#0066cc] rounded transition-colors"
                                >
                                    Forgot password?
                                </Link>
                            </div>
                        </div>

                        {/* “Remember me for 30 days” → Checkbox styled with consistent blue accent */}
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

                        {/* Primary button: 16px bold, full width, 48px height, #0066cc blue, hover #004c99, disabled #ccc */}
                        <button
                            type="submit"
                            disabled={processing}
                            className="mt-2 flex w-full h-[48px] items-center justify-center gap-2 rounded-[6px] bg-[#0066cc] px-4 text-[16px] font-bold text-white shadow-xs transition-colors hover:bg-[#004c99] active:scale-[0.99] disabled:bg-[#ccc] disabled:text-slate-500 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#0066cc] focus:ring-offset-2"
                        >
                            {processing ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>Logging in...</span>
                                </>
                            ) : (
                                'Log in'
                            )}
                        </button>
                    </form>

                    {/* Secondary links (“Need an account?”, “Track a Document”) → 12px, muted gray, hover underline */}
                    <div className="mt-8 text-center border-t border-slate-100 pt-6 space-y-2.5">
                        <p className="text-[12px] text-slate-500">
                            Need an account? Contact the{' '}
                            <span className="font-semibold text-slate-700">System Administrator</span>
                        </p>
                        <p>
                            <Link 
                                href="/track" 
                                className="text-[12px] text-slate-500 hover:text-[#0066cc] hover:underline transition-colors inline-flex items-center gap-1 font-medium"
                            >
                                <span>Track a Document (Public Portal)</span>
                                <span aria-hidden="true">&rarr;</span>
                            </Link>
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
