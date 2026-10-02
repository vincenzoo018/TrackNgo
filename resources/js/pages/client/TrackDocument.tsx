import { Head, Link } from '@inertiajs/react';
import { CheckCircle2, Clock, Loader2, MapPin, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { StepProgress } from '@/components/trackngo/StepProgress';

type TrackResult = { document: any; auditTrail: any[] } | false | null;

/** Tracking number from a scanned QR code link: /track?tn=RS-2026-0042 */
function trackingNumberFromUrl(): string {
    if (typeof window === 'undefined') {
        return '';
    }

    return (new URLSearchParams(window.location.search).get('tn') || '')
        .trim()
        .toUpperCase();
}

function formatWhen(value?: string | null): string {
    if (!value) {
        return '';
    }

    const d = new Date(value);

    return isNaN(d.getTime())
        ? ''
        : d.toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
          });
}

export default function TrackDocument() {
    const [trackingNo, setTrackingNo] = useState(trackingNumberFromUrl);
    const [isSearching, setIsSearching] = useState(false);
    const [result, setResult] = useState<TrackResult>(null);

    const search = async (value: string) => {
        const trimmed = value.trim().toUpperCase();

        if (!trimmed) {
            return;
        }

        setIsSearching(true);
        setResult(null);
        // Keep the number in the address so the page can be refreshed or shared
        window.history.replaceState(
            null,
            '',
            `/track?tn=${encodeURIComponent(trimmed)}`,
        );

        try {
            const res = await fetch(
                `/api/track/${encodeURIComponent(trimmed)}`,
                { headers: { Accept: 'application/json' } },
            );
            setResult(res.ok ? await res.json() : false);
        } catch {
            setResult(false);
        } finally {
            setIsSearching(false);
        }
    };

    // Opened from a QR code: look the document up right away
    useEffect(() => {
        const fromUrl = trackingNumberFromUrl();

        if (fromUrl) {
            void Promise.resolve().then(() => search(fromUrl));
        }
    }, []);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        void search(trackingNo);
    };

    const doc = result ? result.document : null;
    const timeline = result ? result.auditTrail : [];
    const isFinished =
        doc &&
        ['completed', 'released'].includes(String(doc.status).toLowerCase());

    return (
        <div className="flex min-h-screen flex-col bg-[var(--tng-slate-50)]">
            <Head title="Track Document — TrackNGo Mati" />

            {/* Public Header */}
            <header className="flex h-14 shrink-0 items-center justify-between gap-3 bg-[var(--tng-blue-900)] px-4 shadow-md sm:h-16 sm:px-6">
                <div className="flex min-w-0 items-center gap-2.5">
                    <img
                        src="/mati-logo.png"
                        alt="Mati Logo"
                        className="h-8 w-8 sm:h-10 sm:w-10"
                        onError={(e) =>
                            (e.currentTarget.style.display = 'none')
                        }
                    />
                    <div className="min-w-0 text-white">
                        <h1 className="truncate text-sm font-bold tracking-wide sm:text-base">
                            TrackNGo <span className="font-light">Mati</span>
                        </h1>
                        <p className="text-[10px] tracking-widest text-blue-200 uppercase">
                            Public Portal
                        </p>
                    </div>
                </div>
                <Link
                    href="/login"
                    className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/20 sm:px-4 sm:py-2 sm:text-sm"
                >
                    Employee Login
                </Link>
            </header>

            <main className="flex flex-1 flex-col items-center px-4 py-8 sm:p-6">
                <div className="w-full max-w-2xl space-y-6 sm:space-y-8">
                    <div className="text-center">
                        <h2 className="text-2xl font-bold tracking-tight text-[var(--tng-slate-900)] sm:text-3xl">
                            Track your Document
                        </h2>
                        <p className="mt-2 text-sm text-[var(--tng-slate-500)]">
                            Enter your tracking number (e.g. RS-2026-0042) or
                            scan the QR code on your routing slip.
                        </p>
                    </div>

                    <form
                        onSubmit={handleSearch}
                        className="relative mx-auto max-w-lg"
                    >
                        <input
                            type="text"
                            value={trackingNo}
                            onChange={(e) =>
                                setTrackingNo(e.target.value.toUpperCase())
                            }
                            placeholder="Tracking Number"
                            autoComplete="off"
                            autoCapitalize="characters"
                            spellCheck={false}
                            aria-label="Tracking number"
                            className="h-12 w-full rounded-2xl border-2 border-[var(--tng-slate-200)] bg-white pr-24 pl-4 text-base font-medium text-[var(--tng-slate-900)] uppercase shadow-sm focus:border-[var(--tng-blue-500)] focus:ring-4 focus:ring-[var(--tng-blue-500)]/10 focus:outline-none sm:h-14 sm:pr-32 sm:pl-6 sm:text-lg"
                        />
                        <button
                            type="submit"
                            disabled={!trackingNo.trim() || isSearching}
                            className="absolute top-1.5 right-1.5 bottom-1.5 flex items-center gap-1.5 rounded-xl bg-[var(--tng-blue-600)] px-4 font-semibold text-white transition-colors hover:bg-[var(--tng-blue-700)] disabled:opacity-70 sm:top-2 sm:right-2 sm:bottom-2 sm:px-6"
                        >
                            {isSearching ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Search className="h-4 w-4" />
                            )}
                            <span>Track</span>
                        </button>
                    </form>

                    {result === false && (
                        <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-5 text-center text-sm text-red-800">
                            No document found with that tracking number. Please
                            check and try again.
                        </div>
                    )}

                    {doc && (
                        <div className="mx-auto w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/50 sm:p-8">
                            <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                    <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                                        Tracking Number
                                    </p>
                                    <h3 className="mt-1 text-xl font-bold break-all text-[#0066cc] sm:text-2xl">
                                        {doc.tracking_number ||
                                            doc.reference_number}
                                    </h3>
                                    <p className="mt-1 font-medium break-words text-slate-800">
                                        {doc.title}
                                    </p>
                                </div>
                                <span
                                    className={`shrink-0 self-start rounded-full border px-3 py-1 text-xs font-bold sm:text-sm ${isFinished ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-blue-200 bg-blue-50 text-[#0066cc]'}`}
                                >
                                    {(
                                        doc.status_label ||
                                        doc.status ||
                                        'In process'
                                    ).toUpperCase()}
                                </span>
                            </div>

                            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                                <div>
                                    <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase">
                                        {isFinished ? (
                                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                        ) : (
                                            <MapPin className="h-4 w-4 text-[#0066cc]" />
                                        )}
                                        {isFinished
                                            ? 'Completed'
                                            : 'Current Office'}
                                    </p>
                                    <p className="mt-1.5 font-medium text-slate-900">
                                        {isFinished
                                            ? formatWhen(doc.completed_at) || 'Completed'
                                            : doc.current_holder_department ||
                                              doc.department_name ||
                                              'Receiving Office'}
                                    </p>
                                </div>
                                <div>
                                    <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase">
                                        <Clock className="h-4 w-4 text-[#0066cc]" />{' '}
                                        Date Filed
                                    </p>
                                    <p className="mt-1.5 font-medium text-slate-900">
                                        {formatWhen(doc.date_filed || doc.created_at)}
                                    </p>
                                </div>
                            </div>

                            <p className="mb-3 text-xs font-semibold text-slate-500 uppercase">
                                Progress
                            </p>
                            <div className="-mx-2 overflow-x-auto px-2 pb-2">
                                <div className="min-w-[560px]">
                                    <StepProgress
                                        document={doc}
                                        auditTrails={timeline}
                                        processType={
                                            doc.is_internal
                                                ? 'internal_dept'
                                                : 'external'
                                        }
                                        submitterName={doc.submitter_name}
                                        enableLiveSync={false}
                                        showProcessBadge={false}
                                        compact
                                    />
                                </div>
                            </div>

                            {timeline.length > 0 && (
                                <div className="mt-6 border-t border-slate-100 pt-5">
                                    <p className="mb-3 text-xs font-semibold text-slate-500 uppercase">
                                        History
                                    </p>
                                    <ol className="space-y-3">
                                        {timeline.map(
                                            (entry: any, index: number) => (
                                                <li
                                                    key={`${entry.action}-${entry.timestamp}-${index}`}
                                                    className="flex gap-3"
                                                >
                                                    <span
                                                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${index === 0 ? 'bg-[#0066cc]' : 'bg-slate-300'}`}
                                                    />
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium text-slate-900">
                                                            {entry.description}
                                                        </p>
                                                        <p className="text-xs text-slate-500">
                                                            {[
                                                                entry.department,
                                                                formatWhen(
                                                                    entry.timestamp,
                                                                ),
                                                            ]
                                                                .filter(Boolean)
                                                                .join(' · ')}
                                                        </p>
                                                    </div>
                                                </li>
                                            ),
                                        )}
                                    </ol>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
