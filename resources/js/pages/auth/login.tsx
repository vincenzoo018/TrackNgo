import { Head, useForm, Link } from '@inertiajs/react';
import { FormEventHandler } from 'react';
import { Mail, Lock } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

export default function Login() {
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
        <div className="flex min-h-screen bg-[var(--tng-slate-50)] lg:flex-row flex-col">
            <Head title="Log in — TrackNGo Mati" />

            {/* Left Half: City of Mati Image Panel (960px x 1080px scaled to fit half-page layout) */}
            <div className="relative flex flex-col items-center justify-between bg-[var(--tng-blue-900)] p-6 lg:p-10 text-center text-white lg:w-1/2 lg:min-h-screen overflow-hidden">
                {/* Background radial highlight */}
                <div className="absolute inset-0 opacity-15 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-400 via-transparent to-transparent pointer-events-none" />

                {/* Top Subtle Header */}
                <div className="relative z-10 w-full text-center lg:text-left pt-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-xs border border-white/10 text-xs font-semibold text-blue-100 tracking-wide">
                        <span>Office of the Mayor &bull; City of Mati</span>
                    </div>
                </div>

                {/* City of Mati Image: 960x1080 full height, scaled to fit half-page layout */}
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

            {/* Login Form Panel */}
            <div className="flex w-full items-center justify-center p-6 lg:w-1/2 lg:p-12">
                <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.2)]">
                    <div className="mb-8 text-center">
                        <h2 className="text-[20px] font-bold tracking-tight text-[var(--tng-slate-900)]">Welcome back</h2>
                        <p className="mt-2 text-sm text-[var(--tng-slate-500)]">
                            Please enter your credentials to securely log in.
                        </p>
                    </div>

                    <form onSubmit={submit} className="space-y-5">
                        {/* Email Input */}
                        <div className="space-y-1.5">
                            <label htmlFor="email" className="block text-[14px] font-medium text-[var(--tng-slate-700)]">
                                Email address
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--tng-slate-400)]" />
                                <input
                                    id="email"
                                    type="email"
                                    name="email"
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                    className="block w-full rounded-[6px] border border-[var(--tng-slate-200)] py-2.5 pl-10 pr-4 text-[15px] text-[var(--tng-slate-900)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20 transition-colors placeholder:text-[var(--tng-slate-400)]"
                                    autoComplete="username"
                                    placeholder="name@trackngo.gov.ph"
                                />
                            </div>
                            {errors.email && <p className="text-sm text-red-600">{errors.email}</p>}
                        </div>

                        {/* Password Input */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label htmlFor="password" className="block text-[14px] font-medium text-[var(--tng-slate-700)]">
                                    Password
                                </label>
                                <Link href="/forgot-password" className="text-sm font-medium text-[var(--tng-blue-600)] hover:underline">
                                    Forgot password?
                                </Link>
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--tng-slate-400)]" />
                                <input
                                    id="password"
                                    type="password"
                                    name="password"
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    className="block w-full rounded-[6px] border border-[var(--tng-slate-200)] py-2.5 pl-10 pr-4 text-[15px] text-[var(--tng-slate-900)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20 transition-colors"
                                    autoComplete="current-password"
                                    placeholder="••••••••"
                                />
                            </div>
                            {errors.password && <p className="text-sm text-red-600">{errors.password}</p>}
                        </div>

                        {/* Remember Me */}
                        <div className="flex items-center space-x-2 pt-1">
                            <Checkbox
                                id="remember"
                                checked={data.remember}
                                onCheckedChange={(checked) => setData('remember', checked as boolean)}
                            />
                            <label htmlFor="remember" className="text-[14px] font-normal text-[var(--tng-slate-600)] cursor-pointer select-none">
                                Remember me for 30 days
                            </label>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={processing}
                            className="mt-2 flex w-full items-center justify-center rounded-[6px] bg-[var(--tng-blue-600)] px-4 py-3 text-[16px] font-bold text-white shadow-md shadow-blue-600/20 transition-all hover:bg-[var(--tng-blue-700)] disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            Log in
                        </button>
                    </form>

                    <div className="mt-8 text-center text-sm text-[var(--tng-slate-500)] border-t border-[var(--tng-slate-100)] pt-6">
                        <p>Need an account? Contact the <span className="font-semibold text-[var(--tng-slate-700)]">System Administrator</span></p>
                        <p className="mt-4">
                            <Link href="/track" className="font-medium text-[var(--tng-blue-600)] hover:underline">
                                Track a Document (Public Portal) &rarr;
                            </Link>
                        </p>
                    </div>
                </div>
                
                {/* Mobile Footer */}
                <div className="relative z-10 text-sm text-[var(--tng-slate-400)] mt-8 lg:hidden block text-center absolute bottom-4">
                    &copy; {new Date().getFullYear()} Office of the Mayor, City of Mati.
                </div>
            </div>
        </div>
    );
}
