import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Download, FileText, UploadCloud } from 'lucide-react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';

export default function VersionHistory() {
    return (
        <TrackngoLayout
            breadcrumbs={[
                { title: 'Home', href: '/receiving' },
                { title: 'My Documents', href: '/receiving/documents' },
                { title: 'TNG-2026-0004', href: '/receiving/documents/1' },
                { title: 'Version History', href: '#' },
            ]}
        >
            <Head title="Version History — TrackNGo Mati" />

            <div className="space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--tng-slate-900)]">
                            Version History
                        </h1>
                        <p className="mt-0.5 text-sm text-[var(--tng-slate-500)]">
                            TNG-2026-0004 — Executive Order No. 12
                        </p>
                    </div>
                    <Link
                        href="/receiving/documents/1"
                        className="flex items-center gap-1.5 rounded-lg border border-[var(--tng-slate-200)] bg-white px-3 py-2 text-sm font-medium text-[var(--tng-slate-600)] transition-colors hover:bg-[var(--tng-slate-50)]"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Document
                    </Link>
                </div>

                <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-6">
                    <div className="mb-6 flex items-center justify-between">
                        <h2 className="text-base font-semibold text-[var(--tng-slate-800)]">Document Revisions</h2>
                        <button className="flex items-center gap-2 rounded-lg bg-[var(--tng-blue-600)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--tng-blue-700)]">
                            <UploadCloud className="h-4 w-4" />
                            Upload New Version
                        </button>
                    </div>

                    <div className="space-y-4">
                        {[
                            { v: 'v1.2', date: 'Jul 04, 2026 - 09:15 AM', user: 'Engr. Lim', desc: 'Revised architectural plan attached.', active: true },
                            { v: 'v1.1', date: 'Jul 03, 2026 - 11:30 AM', user: 'Admin Office', desc: 'Added missing signatures.', active: false },
                            { v: 'v1.0', date: 'Jul 02, 2026 - 10:37 AM', user: 'Receiving Clerk', desc: 'Original submission.', active: false },
                        ].map((rev) => (
                            <div key={rev.v} className="flex items-center justify-between rounded-lg border border-[var(--tng-slate-200)] p-4 transition-colors hover:bg-[var(--tng-slate-50)]">
                                <div className="flex items-center gap-4">
                                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${rev.active ? 'bg-[var(--tng-blue-100)] text-[var(--tng-blue-600)]' : 'bg-[var(--tng-slate-100)] text-[var(--tng-slate-500)]'}`}>
                                        <FileText className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-[var(--tng-slate-900)]">
                                            {rev.v} {rev.active && <span className="ml-2 rounded bg-green-100 px-2 py-0.5 text-[10px] uppercase text-green-700">Current</span>}
                                        </p>
                                        <p className="text-xs text-[var(--tng-slate-500)]">{rev.desc}</p>
                                        <p className="text-[10px] text-[var(--tng-slate-400)] mt-1">{rev.user} · {rev.date}</p>
                                    </div>
                                </div>
                                <button className="rounded-lg border border-[var(--tng-slate-200)] p-2 text-[var(--tng-slate-600)] hover:bg-white hover:text-[var(--tng-blue-600)]">
                                    <Download className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </TrackngoLayout>
    );
}
