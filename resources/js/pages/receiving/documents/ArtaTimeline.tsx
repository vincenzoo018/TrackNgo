import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';

export default function ArtaTimeline() {
    return (
        <TrackngoLayout
            breadcrumbs={[
                { title: 'Home', href: '/receiving' },
                { title: 'My Documents', href: '/receiving/documents' },
                { title: 'TNG-2026-0004', href: '/receiving/documents/1' },
                { title: 'ARTA Timeline', href: '#' },
            ]}
        >
            <Head title="ARTA SLA Timeline — TrackNGo Mati" />

            <div className="space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--tng-slate-900)]">
                            ARTA SLA Timeline
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

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-2 rounded-xl border border-[var(--tng-slate-200)] bg-white p-6">
                        <h2 className="mb-6 text-base font-semibold text-[var(--tng-slate-800)]">Processing Timeline</h2>
                        <div className="space-y-6 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-[var(--tng-slate-200)] pl-12">
                            
                            <div className="relative">
                                <div className="absolute -left-12 top-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600 ring-4 ring-white">
                                    <CheckCircle2 className="h-5 w-5" />
                                </div>
                                <h3 className="text-sm font-bold text-[var(--tng-slate-900)]">Receiving Office (Intake)</h3>
                                <p className="text-xs text-[var(--tng-slate-500)]">Completed in 8 minutes (SLA: 1 Day)</p>
                                <p className="text-[10px] text-[var(--tng-slate-400)] mt-1">Jul 02, 2026 - 10:45 AM</p>
                            </div>

                            <div className="relative">
                                <div className="absolute -left-12 top-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600 ring-4 ring-white">
                                    <Clock className="h-5 w-5" />
                                </div>
                                <h3 className="text-sm font-bold text-[var(--tng-slate-900)]">City Engineering Office (Review)</h3>
                                <p className="text-xs text-[var(--tng-slate-500)]">In Progress — Day 2 of 3 (SLA: 3 Days)</p>
                                <p className="text-[10px] text-[var(--tng-slate-400)] mt-1">Due: Jul 05, 2026</p>
                            </div>

                            <div className="relative opacity-50">
                                <div className="absolute -left-12 top-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 ring-4 ring-white">
                                    <div className="h-3 w-3 rounded-full bg-slate-300" />
                                </div>
                                <h3 className="text-sm font-bold text-[var(--tng-slate-900)]">Office of the Mayor (Approval)</h3>
                                <p className="text-xs text-[var(--tng-slate-500)]">Pending (SLA: 3 Days)</p>
                            </div>

                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
                            <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-red-500" />
                            <h3 className="text-lg font-bold text-red-900">1 Day Left</h3>
                            <p className="text-sm text-red-700 mt-1">This document is approaching its ARTA deadline for the current department.</p>
                        </div>
                    </div>
                </div>
            </div>
        </TrackngoLayout>
    );
}
