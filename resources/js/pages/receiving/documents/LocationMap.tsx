import { Head, Link, router, useForm } from '@inertiajs/react';
import { ArrowLeft, Archive, MapPin, Search, UserCheck } from 'lucide-react';
import { useState } from 'react';
import { FlashMessage } from '@/components/trackngo/FlashMessage';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';

type Hop = { step: number; action: string; from: string | null; handler: string | null; role: string | null; department: string | null; department_id: number | null; arrived_at: string; left_at: string | null; hours: number };
type Physical = { id: number; office: string | null; cabinet: string; box: string | null; remarks: string | null; recorded_by: string | null; recorded_at: string | null };
type Recent = { document_id: number; reference_number: string; tracking_number: string | null; title: string; type: string | null; due_date: string | null };
type Doc = {
    document_id: number;
    reference_number: string;
    tracking_number: string | null;
    title: string;
    type: string | null;
    status: string;
    office: string | null;
    holder: string | null;
    holder_role: string | null;
    holder_office: string | null;
    held_for: string | null;
    since: string | null;
    live_status: string | null;
    closed: boolean;
    completed_at: string | null;
};
type Props = {
    document: Doc | null;
    path?: Hop[];
    physical?: Physical[];
    departments?: { department_id: number; department_name: string }[];
    query: string;
    notFound: boolean;
    recent: Recent[];
};

const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[var(--tng-blue-500)] focus:ring-1 focus:ring-[var(--tng-blue-500)]';
const labelClass = 'mb-1.5 block text-xs font-semibold text-slate-700';
const errorClass = 'mt-1 text-[12px] font-medium text-red-600';

function dateTime(value?: string | null): string {
    if (!value) return '';
    return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function duration(hours: number): string {
    if (hours < 1) return 'under 1 hour';
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;
    const days = Math.round(hours / 24 * 10) / 10;
    return `${days} day${days === 1 ? '' : 's'}`;
}

/** Receiving → Location Map of a document (or the search to find one) */
export default function LocationMap({ document: doc, path = [], physical = [], departments = [], query, notFound, recent }: Props) {
    const [q, setQ] = useState(query);
    const current = physical[0] ?? null;
    const holderOfficeId = departments.find(d => d.department_name === doc?.holder_office)?.department_id;
    const form = useForm({ department_id: holderOfficeId ? String(holderOfficeId) : '', cabinet: '', box: '', remarks: '' });

    const search = (e: React.FormEvent) => {
        e.preventDefault();
        if (q.trim()) router.get('/receiving/location-map', { q: q.trim() });
    };
    const save = (e: React.FormEvent) => {
        e.preventDefault();
        if (doc) {
            form.post(`/receiving/documents/${doc.document_id}/physical-location`, { preserveScroll: true, onSuccess: () => form.setData(d => ({ ...d, cabinet: '', box: '', remarks: '' })) });
        }
    };

    return (
        <TrackngoLayout
            role="receiving"
            breadcrumbs={[
                { title: 'Home', href: '/receiving' },
                { title: 'Location Map', href: '/receiving/location-map' },
                ...(doc ? [{ title: doc.tracking_number || doc.reference_number, href: '#' }] : []),
            ]}
        >
            <Head title="Location Map — TrackNGo Mati" />
            <FlashMessage />

            <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-[20px] font-bold text-[var(--tng-slate-900)]">Location Map</h1>
                        <p className="mt-0.5 max-w-3xl text-sm text-[var(--tng-slate-500)]">
                            Where a document is now, the path it took through the offices, and where its paper original is kept.
                        </p>
                    </div>
                    <form onSubmit={search} className="relative w-full max-w-sm">
                        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value.toUpperCase())}
                            placeholder="Tracking or reference number"
                            aria-label="Tracking or reference number"
                            className="h-10 w-full rounded-lg border border-slate-200 bg-white pr-20 pl-9 text-sm uppercase focus:border-[var(--tng-blue-500)] focus:ring-1 focus:ring-[var(--tng-blue-500)]"
                        />
                        <button type="submit" className="absolute top-1 right-1 bottom-1 rounded-md bg-[#0066cc] px-3 text-[13px] font-medium text-white hover:bg-[#005bb5]">Open</button>
                    </form>
                </div>

                {!doc && (
                    <div className="space-y-4">
                        {notFound && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">No document has the number “{query}”.</p>}
                        <section className="rounded-lg border border-slate-200 bg-white">
                            <h2 className="border-b border-slate-200 px-5 py-3.5 text-[15px] font-semibold text-slate-900">Documents in process</h2>
                            {recent.length === 0 ? (
                                <p className="p-5 text-sm text-slate-500">No document is in process.</p>
                            ) : (
                                <ul className="divide-y divide-slate-100">
                                    {recent.map(r => (
                                        <li key={r.document_id}>
                                            <Link href={`/receiving/documents/${r.document_id}/location-map`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-slate-50">
                                                <span className="min-w-0">
                                                    <span className="font-mono text-[13px] font-semibold text-slate-700">{r.tracking_number || r.reference_number}</span>
                                                    <span className="ml-2 text-[13px] text-slate-600">{r.title}</span>
                                                </span>
                                                <span className="text-[12px] text-slate-500">{r.type}</span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    </div>
                )}

                {doc && (
                    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
                        <div className="flex min-w-0 flex-col gap-6 xl:col-span-7">
                            <section className="rounded-lg border border-slate-200 bg-white">
                                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 p-5">
                                    <div className="min-w-0">
                                        <p className="font-mono text-[13px] font-semibold text-slate-600">{doc.tracking_number || doc.reference_number}</p>
                                        <h2 className="mt-1 text-lg font-semibold text-slate-900">{doc.title}</h2>
                                        <p className="mt-0.5 text-[13px] text-slate-500">{[doc.type, doc.office].filter(Boolean).join(' · ')}</p>
                                    </div>
                                    <Link href={`/receiving/documents/${doc.document_id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                                        <ArrowLeft className="h-4 w-4" /> Back to Document
                                    </Link>
                                </div>
                                <div className="flex items-start gap-3 p-5">
                                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${doc.closed ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-[#0066cc]'}`}>
                                        <MapPin className="h-5 w-5" />
                                    </div>
                                    {doc.closed ? (
                                        <div>
                                            <p className="text-[15px] font-semibold text-slate-900">Finished — no longer with any office</p>
                                            <p className="text-[13px] text-slate-500">{doc.completed_at ? `Closed ${dateTime(doc.completed_at)}` : ''}</p>
                                        </div>
                                    ) : (
                                        <div className="min-w-0">
                                            <p className="text-[13px] text-slate-500">Now with</p>
                                            <p className="text-[15px] font-semibold text-slate-900">{doc.holder ?? doc.holder_office ?? 'Unassigned'}</p>
                                            <p className="text-[13px] text-slate-600">{[doc.holder_role, doc.holder_office].filter(Boolean).join(' · ')}</p>
                                            {doc.held_for && (
                                                <p className="mt-1 flex items-center gap-1 text-[12px] text-violet-700"><UserCheck className="h-3.5 w-3.5" /> As Officer-in-Charge for {doc.held_for}</p>
                                            )}
                                            <p className="mt-1 text-[12px] text-slate-500">
                                                Since {dateTime(doc.since)}{doc.live_status ? ` · ${doc.live_status}` : ''}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </section>

                            <section className="rounded-lg border border-slate-200 bg-white">
                                <h2 className="border-b border-slate-200 px-5 py-3.5 text-[15px] font-semibold text-slate-900">Path through the offices</h2>
                                <ol className="relative space-y-5 p-5 before:absolute before:top-7 before:bottom-7 before:left-[29px] before:w-0.5 before:bg-slate-200">
                                    {path.map((h, i) => {
                                        const isCurrent = !doc.closed && i === path.length - 1;

                                        return (
                                            <li key={h.step} className="relative flex gap-4">
                                                <span className={`relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${isCurrent ? 'border-[#0066cc] bg-[#0066cc]' : 'border-slate-300 bg-white'}`}>
                                                    {isCurrent && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                                                </span>
                                                <div className="min-w-0">
                                                    <p className={`text-[14px] ${isCurrent ? 'font-semibold text-slate-900' : 'font-medium text-slate-800'}`}>{h.department ?? 'Office'}</p>
                                                    <p className="text-[12px] text-slate-500">{[h.handler, h.role].filter(Boolean).join(' · ')}</p>
                                                    <p className="mt-0.5 text-[12px] text-slate-500">
                                                        {h.action}{h.from ? ` by ${h.from}` : ''} · {dateTime(h.arrived_at)} · {duration(h.hours)}{isCurrent ? ' so far' : ''}
                                                    </p>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ol>
                            </section>
                        </div>

                        <div className="flex flex-col gap-6 xl:col-span-5">
                            <section className="rounded-lg border border-slate-200 bg-white">
                                <h2 className="flex items-center gap-2 border-b border-slate-200 px-5 py-3.5 text-[15px] font-semibold text-slate-900"><Archive className="h-4 w-4 text-slate-500" /> Paper original</h2>
                                <div className="p-5">
                                    {current ? (
                                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[13px]">
                                            <p className="font-medium text-slate-900">{current.office}</p>
                                            <p className="text-slate-700">{[current.cabinet, current.box].filter(Boolean).join(' · ')}</p>
                                            {current.remarks && <p className="text-slate-500">{current.remarks}</p>}
                                            <p className="mt-1 text-[12px] text-slate-500">Recorded by {current.recorded_by} · {dateTime(current.recorded_at)}</p>
                                        </div>
                                    ) : (
                                        <p className="text-[13px] text-slate-500">Not recorded yet. Record where the signed original is filed.</p>
                                    )}

                                    <form onSubmit={save} className="mt-4 space-y-3">
                                        <div>
                                            <label className={labelClass}>Office <span className="text-red-500">*</span></label>
                                            <select value={form.data.department_id} onChange={(e) => form.setData('department_id', e.target.value)} className={inputClass}>
                                                <option value="">Select the office keeping it…</option>
                                                {departments.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
                                            </select>
                                            {form.errors.department_id && <p className={errorClass}>{form.errors.department_id}</p>}
                                        </div>
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            <div>
                                                <label className={labelClass}>Cabinet / shelf <span className="text-red-500">*</span></label>
                                                <input value={form.data.cabinet} onChange={(e) => form.setData('cabinet', e.target.value)} className={inputClass} maxLength={100} placeholder="e.g. Cabinet 3, Drawer 2" />
                                                {form.errors.cabinet && <p className={errorClass}>{form.errors.cabinet}</p>}
                                            </div>
                                            <div>
                                                <label className={labelClass}>Box / folder</label>
                                                <input value={form.data.box} onChange={(e) => form.setData('box', e.target.value)} className={inputClass} maxLength={100} placeholder="e.g. Box 2026-11" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className={labelClass}>Remarks</label>
                                            <input value={form.data.remarks} onChange={(e) => form.setData('remarks', e.target.value)} className={inputClass} maxLength={255} />
                                        </div>
                                        <button type="submit" disabled={form.processing} className="w-full rounded-lg bg-[#0066cc] px-4 py-2.5 text-[14px] font-medium text-white hover:bg-[#005bb5] disabled:opacity-60">
                                            {current ? 'Record new location' : 'Record location'}
                                        </button>
                                    </form>

                                    {physical.length > 1 && (
                                        <div className="mt-5 border-t border-slate-200 pt-4">
                                            <p className="mb-2 text-[12px] font-semibold text-slate-500 uppercase">Earlier locations</p>
                                            <ul className="space-y-2">
                                                {physical.slice(1).map(p => (
                                                    <li key={p.id} className="text-[12px] text-slate-600">
                                                        {[p.office, p.cabinet, p.box].filter(Boolean).join(' · ')} — {p.recorded_by}, {dateTime(p.recorded_at)}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </section>
                        </div>
                    </div>
                )}
            </div>
        </TrackngoLayout>
    );
}
