import { Link, router, usePage } from '@inertiajs/react';
import { Gavel, RefreshCw, Scale } from 'lucide-react';
import { useState } from 'react';

export type PendingOrdinance = {
    document_id: number;
    reference_number: string;
    tracking_number: string | null;
    title: string;
    type: string | null;
    received_at: string | null;
    due_date: string | null;
    days_left: number;
    holder: string | null;
};

export type DeemedApproved = {
    document_id: number;
    reference_number: string;
    tracking_number: string | null;
    title: string;
    type: string | null;
    basis: string;
    at: string | null;
    released: boolean;
};

function day(value?: string | null): string {
    if (!value) return '';
    return new Date(`${value.slice(0, 10)}T12:00:00+08:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' });
}

/** Mayor's dashboard: ordinances / resolutions waiting for a signature or veto, soonest deadline first (LGC Sec. 54) */
export function PendingOrdinancesPanel({ items, role }: { items: PendingOrdinance[]; role: string }) {
    return (
        <section className="rounded-xl border border-[var(--tng-slate-200)] bg-white shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3.5">
                <h2 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
                    <Gavel className="h-4 w-4 text-violet-600" /> Ordinances &amp; Resolutions to Sign or Veto
                </h2>
                <span className="text-[12px] text-slate-500">10 calendar days from receipt (LGC Sec. 54)</span>
            </div>
            {items.length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate-500">Nothing is waiting for the Mayor's signature or veto.</p>
            ) : (
                <ul className="divide-y divide-slate-100">
                    {items.map(item => {
                        const urgent = item.days_left <= 2;
                        return (
                            <li key={item.document_id}>
                                <Link href={`/${role}/documents/${item.document_id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                                    <span className="min-w-0">
                                        <span className="block truncate text-[14px] font-medium text-slate-900">{item.title}</span>
                                        <span className="text-[12px] text-slate-500">
                                            {[item.tracking_number || item.reference_number, item.type, item.holder ? `with ${item.holder}` : null].filter(Boolean).join(' · ')}
                                        </span>
                                    </span>
                                    <span className="text-right">
                                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${item.days_left < 0 ? 'border-red-200 bg-red-50 text-red-700' : urgent ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-violet-200 bg-violet-50 text-violet-700'}`}>
                                            {item.days_left < 0 ? 'Period lapsed' : item.days_left === 0 ? 'Last day today' : `${item.days_left} day${item.days_left === 1 ? '' : 's'} left`}
                                        </span>
                                        <span className="mt-0.5 block text-[11px] text-slate-500">Act by {day(item.due_date)}</span>
                                    </span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}

/** Admin dashboard: documents deemed approved by law, and the deemed-approval check run on demand */
export function DeemedApprovedPanel({ items, total }: { items: DeemedApproved[]; total: number }) {
    const [running, setRunning] = useState(false);
    const { flash } = usePage<any>().props;
    const run = () => {
        setRunning(true);
        router.post('/admin/deemed-approvals/run', {}, { preserveScroll: true, onFinish: () => setRunning(false) });
    };

    return (
        <section className="rounded-xl border border-[var(--tng-slate-200)] bg-white shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3.5">
                <h2 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
                    <Scale className="h-4 w-4 text-violet-600" /> Deemed Approved <span className="text-[13px] font-normal text-slate-500">({total})</span>
                </h2>
                <button
                    type="button"
                    onClick={run}
                    disabled={running}
                    title="Runs every five minutes automatically; run it now to check immediately"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                    <RefreshCw className={`h-3.5 w-3.5 ${running ? 'animate-spin' : ''}`} /> Check now
                </button>
            </div>
            {flash?.success && String(flash.success).startsWith('Checked') && (
                <p className="border-b border-emerald-100 bg-emerald-50 px-5 py-2 text-[13px] text-emerald-800">{flash.success}</p>
            )}
            {items.length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate-500">No document has been deemed approved. Offices acted within their periods.</p>
            ) : (
                <ul className="divide-y divide-slate-100">
                    {items.map(item => (
                        <li key={item.document_id}>
                            <Link href={`/admin/documents/${item.document_id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                                <span className="min-w-0">
                                    <span className="block truncate text-[14px] font-medium text-slate-900">{item.title}</span>
                                    <span className="text-[12px] text-slate-500">{[item.tracking_number || item.reference_number, item.type].filter(Boolean).join(' · ')}</span>
                                </span>
                                <span className="text-right">
                                    <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[12px] font-medium text-violet-700">{item.basis}</span>
                                    <span className="mt-0.5 block text-[11px] text-slate-500">{item.at ? new Date(item.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''} · {item.released ? 'Released' : 'For release'}</span>
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
