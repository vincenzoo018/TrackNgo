import { Head, useForm, Link } from '@inertiajs/react';
import { FormEventHandler } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
        <div className="flex min-h-screen bg-[var(--tng-slate-50)]">
            <Head title="Log in — TrackNGo Mati" />

            {/* Left Side - Image/Brand */}
            <div className="hidden w-1/2 flex-col justify-between bg-[var(--tng-blue-900)] p-12 text-white lg:flex relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent bg-[length:20px_20px]" />

                <div className="relative z-10 flex items-center gap-3">
                    <img src="/mati-logo.png" alt="Mati Logo" className="h-12 w-12" onError={(e) => (e.currentTarget.style.display = 'none')} />
                    <div>
                        <h1 className="text-xl font-bold tracking-wide">TrackNGo</h1>
                        <p className="text-xs text-blue-200 uppercase tracking-widest">City of Mati</p>
                    </div>
                </div>

                <div className="relative z-10 space-y-4 max-w-lg">
                    <h2 className="text-4xl font-bold leading-tight">Document Management & Monitoring System</h2>
                    <p className="text-lg text-blue-200">
                        A secure, efficient, and transparent way to track documents across the City Government of Mati.
                    </p>
                </div>

                <div className="relative z-10 text-sm text-blue-300">
                    &copy; {new Date().getFullYear()} Office of the Mayor, City of Mati.
                </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="flex w-full items-center justify-center p-8 lg:w-1/2">
                <div className="w-full max-w-sm space-y-8">
                    <div className="text-center lg:text-left">
                        <div className="lg:hidden flex items-center justify-center gap-3 mb-6">
                             <img src="/mati-logo.png" alt="Mati Logo" className="h-10 w-10" onError={(e) => (e.currentTarget.style.display = 'none')} />
                             <div className="text-left">
                                <h1 className="text-lg font-bold text-[var(--tng-blue-900)] tracking-wide">TrackNGo</h1>
                                <p className="text-[10px] text-[var(--tng-blue-600)] uppercase tracking-widest">City of Mati</p>
                            </div>
                        </div>
                        <h2 className="text-3xl font-bold tracking-tight text-[var(--tng-slate-900)]">Welcome back</h2>
                        <p className="mt-2 text-sm text-[var(--tng-slate-500)]">
                            Please enter your credentials to access your account.
                        </p>
                    </div>

                    <form onSubmit={submit} className="space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    name="email"
                                    value={data.email}
                                    className="mt-1 block w-full h-11"
                                    autoComplete="username"
                                    onChange={(e) => setData('email', e.target.value)}
                                    placeholder="name@trackngo.gov.ph"
                                />
                                {errors.email && <p className="text-sm text-red-600">{errors.email}</p>}
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password">Password</Label>
                                    <Link href="/forgot-password" className="text-sm font-medium text-[var(--tng-blue-600)] hover:underline">
                                        Forgot password?
                                    </Link>
                                </div>
                                <Input
                                    id="password"
                                    type="password"
                                    name="password"
                                    value={data.password}
                                    className="mt-1 block w-full h-11"
                                    autoComplete="current-password"
                                    onChange={(e) => setData('password', e.target.value)}
                                />
                                {errors.password && <p className="text-sm text-red-600">{errors.password}</p>}
                            </div>
                        </div>

                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="remember"
                                checked={data.remember}
                                onCheckedChange={(checked) => setData('remember', checked as boolean)}
                            />
                            <Label htmlFor="remember" className="text-sm font-normal text-[var(--tng-slate-600)] cursor-pointer">
                                Remember me for 30 days
                            </Label>
                        </div>

                        <button
                            disabled={processing}
                            className="flex w-full items-center justify-center rounded-lg bg-[var(--tng-blue-600)] px-4 py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/25 transition-all hover:bg-[var(--tng-blue-700)] disabled:opacity-50"
                        >
                            Log in
                        </button>
                    </form>

                    <div className="mt-8 text-center text-sm text-[var(--tng-slate-500)]">
                        <p>Need an account? Contact the <span className="font-semibold text-[var(--tng-slate-700)]">System Administrator</span></p>
                        <p className="mt-4">
                            <Link href="/track" className="font-medium text-[var(--tng-blue-600)] hover:underline">
                                Track a Document (Public Portal) &rarr;
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
