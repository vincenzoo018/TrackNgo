import { Head, Link } from '@inertiajs/react';
import { Search, MapPin, CheckCircle2, Clock } from 'lucide-react';
import { useState } from 'react';
import { StepProgress } from '@/components/trackngo/StepProgress';

export default function TrackDocument() {
    const [trackingNo, setTrackingNo] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [result, setResult] = useState<any>(null); // Mock result for frontend demo

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSearching(true);

        setTimeout(() => {
            setIsSearching(false);
            if (trackingNo.includes('TRK')) {
                setResult({
                    trackingNo: 'TRK-20260702-001',
                    refNo: 'TNG-2026-0004',
                    title: 'Executive Order No. 12',
                    status: 'Endorsed',
                    currentLocation: 'City Engineering Office',
                    dateFiled: 'July 2, 2026',
                    stepProgress: 2,
                    totalSteps: 5,
                });
            } else {
                setResult(false); // not found
            }
        }, 800);
    };

    return (
        <div className="flex min-h-screen flex-col bg-[var(--tng-slate-50)]">
            <Head title="Track Document — TrackNGo Mati" />

            {/* Public Header */}
            <header className="flex h-16 shrink-0 items-center justify-between bg-[var(--tng-blue-900)] px-6 shadow-md">
                <div className="flex items-center gap-3">
                    <img src="/mati-logo.png" alt="Mati Logo" className="h-10 w-10" onError={(e) => (e.currentTarget.style.display = 'none')} />
                    <div className="text-white">
                        <h1 className="text-base font-bold tracking-wide">TrackNGo <span className="font-light">Mati</span></h1>
                        <p className="text-[10px] uppercase tracking-widest text-blue-200">Public Portal</p>
                    </div>
                </div>
                <Link href="/login" className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20">
                    Employee Login
                </Link>
            </header>

            <main className="flex flex-1 flex-col items-center justify-center p-6">
                <div className="w-full max-w-2xl space-y-8">
                    {/* Hero Text */}
                    <div className="text-center">
                        <h2 className="text-3xl font-bold tracking-tight text-[var(--tng-slate-900)]">
                            Track your Document
                        </h2>
                        <p className="mt-2 text-sm text-[var(--tng-slate-500)]">
                            Enter your tracking number (e.g. TRK-2026...) or scan your document's QR code to see its current status.
                        </p>
                    </div>

                    {/* Search Form */}
                    <form onSubmit={handleSearch} className="relative mx-auto max-w-lg">
                        <input
                            type="text"
                            value={trackingNo}
                            onChange={(e) => setTrackingNo(e.target.value)}
                            placeholder="Enter Tracking Number..."
                            className="h-14 w-full rounded-2xl border-2 border-[var(--tng-slate-200)] bg-white pl-6 pr-32 text-lg font-medium text-[var(--tng-slate-900)] shadow-sm focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-4 focus:ring-[var(--tng-blue-500)]/10 uppercase"
                        />
                        <button
                            type="submit"
                            disabled={!trackingNo || isSearching}
                            className="absolute right-2 top-2 bottom-2 rounded-xl bg-[var(--tng-blue-600)] px-6 font-semibold text-white transition-colors hover:bg-[var(--tng-blue-700)] disabled:opacity-70"
                        >
                            {isSearching ? '...' : 'Track'}
                        </button>
                    </form>

                    {/* Results Area */}
                    {result === false && (
                        <div className="tng-fade-in mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-800">
                            No document found with that tracking number. Please check and try again.
                        </div>
                    )}

                    {result && typeof result === 'object' && (
                        <div className="tng-slide-in-up mx-auto w-full rounded-2xl border border-[var(--tng-slate-200)] bg-white p-8 shadow-xl shadow-slate-200/50">
                            <div className="mb-6 flex items-start justify-between border-b border-[var(--tng-slate-100)] pb-6">
                                <div>
                                    <p className="text-sm font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">
                                        Tracking Number
                                    </p>
                                    <h3 className="mt-1 text-2xl font-bold text-[var(--tng-blue-600)]">{result.trackingNo}</h3>
                                    <p className="mt-1 font-medium text-[var(--tng-slate-800)]">{result.title}</p>
                                </div>
                                <div className="rounded-full bg-blue-50 px-4 py-1.5 text-sm font-bold text-blue-700">
                                    {result.status.toUpperCase()}
                                </div>
                            </div>

                            <div className="mb-8 grid grid-cols-2 gap-6">
                                <div>
                                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase text-[var(--tng-slate-500)]">
                                        <MapPin className="h-4 w-4" /> Current Location
                                    </p>
                                    <p className="mt-1.5 font-medium text-[var(--tng-slate-900)]">{result.currentLocation}</p>
                                </div>
                                <div>
                                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase text-[var(--tng-slate-500)]">
                                        <Clock className="h-4 w-4" /> Date Filed
                                    </p>
                                    <p className="mt-1.5 font-medium text-[var(--tng-slate-900)]">{result.dateFiled}</p>
                                </div>
                            </div>

                            <div>
                                <p className="mb-4 text-xs font-semibold uppercase text-[var(--tng-slate-500)]">Routing Progress</p>
                                <StepProgress currentStep={result.stepProgress} totalSteps={result.totalSteps} />
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
