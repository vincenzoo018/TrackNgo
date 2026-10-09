import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, CalendarClock, Search } from 'lucide-react';
import { useState } from 'react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';

type Day = { date: string; kind: 'filed' | 'counted' | 'holiday' | 'weekend'; label: string | null; number: number | null; overdue: boolean; extension: boolean; is_due: boolean; is_today: boolean };
type Hop = { step: number; action: string; from: string | null; handler: string | null; role: string | null; department: string | null; arrived_at: string; left_at: string | null; hours: number };
type Recent = { document_id: number; reference_number: string; tracking_number: string | null; title: string; type: string | null; due_date: string | null };
type Doc = {
    document_id: number;
    reference_number: string;
    tracking_number: string | null;
    title: string;
    type: string | null;
    status: string;
    office: string | null;
    category: string | null;
    period_days: number;
    working_days: boolean;
    filed_at: string | null;
    original_due: string;
    due_date: string;
    timing: { allowed_days: number; elapsed_days: number; remaining_days: number; overdue_days: number; status: string; completed_late: boolean };
    extension: { reason: string | null; by: string | null; at: string; days: number; notified: boolean } | null;
    deemed: { at: string; basis: string } | null;
    mayoral: { status: string; due_date: string | null; days_left: number | null } | null;
};

type Props = { document: Doc | null; days?: Day[]; offices?: Hop[]; query: string; notFound: boolean; recent: Recent[] };

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function day(value?: string | null, withYear = true): string {
    if (!value) return '';
    return new Date(`${value.slice(0, 10)}T12:00:00+08:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'Asia/Manila' });
}
function dateTime(value?: string | null): string {
    if (!value) return '';
    return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function duration(hours: number): string {
    if (hours < 1) return 'under 1 hour';
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;
    const days = Math.round(hours / 24 * 10) / 10;
    return `${days} day${days === 1 ? '' : 's'}`;
}

const STATUS_TEXT: Record<string, string> = {
    within_time: 'Within the period',
    approaching: 'Approaching the deadline',
    due: 'Due today',
    overdue: 'Overdue',
    completed: 'Closed',
};

function cellClass(d: Day): string {
    if (d.kind === 'filed') return 'border-slate-700 bg-slate-800 text-white';
    if (d.kind === 'holiday') return 'border-violet-200 bg-violet-50 text-violet-800';
    if (d.kind === 'weekend') return 'border-slate-100 bg-slate-50 text-slate-400';
    if (d.overdue) return 'border-red-200 bg-red-50 text-red-700';
    if (d.extension) return 'border-amber-200 bg-amber-50 text-amber-800';
    return 'border-blue-100 bg-blue-50/70 text-[#0066cc]';
}

/** Receiving → ARTA Timeline of a document (or the search to find one) */
export default function ArtaTimeline({ document: doc, days = [], offices = [], query, notFound, recent }: Props) {
    const [q, setQ] = useState(query);
    const search = (e: React.FormEvent) => {
        e.preventDefault();
        if (q.trim()) router.get('/receiving/arta-timeline', { q: q.trim() });
    };
    // Calendar grid: blank cells before the first day so each column is a weekday
    const lead = days.length ? new Date(`${days[0].date}T12:00:00+08:00`).getDay() : 0;

    return (
        <TrackngoLayout
            role="receiving"
            breadcrumbs={[
                { title: 'Home', href: '/receiving' },
                { title: 'ARTA Timeline', href: '/receiving/arta-timeline' },
                ...(doc ? [{ title: doc.tracking_number || doc.reference_number, href: '#' }] : []),
            ]}
        >
            <Head title="ARTA Timeline — TrackNGo Mati" />

            <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-[20px] font-bold text-[var(--tng-slate-900)]">ARTA Timeline</h1>
                        <p className="mt-0.5 max-w-3xl text-sm text-[var(--tng-slate-500)]">
                            How a document's processing period is counted: working days only (weekends and the Holiday Calendar skipped, RA 11032), the one extension, and the days spent with each office.
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
                        {notFound && (
                            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">No document has the number “{query}”.</p>
                        )}
                        <section className="rounded-lg border border-slate-200 bg-white">
                            <h2 className="border-b border-slate-200 px-5 py-3.5 text-[15px] font-semibold text-slate-900">In process — nearest deadline first</h2>
                            {recent.length === 0 ? (
                                <p className="p-5 text-sm text-slate-500">No document is in process.</p>
                            ) : (
                                <ul className="divide-y divide-slate-100">
                                    {recent.map(r => (
                                        <li key={r.document_id}>
                                            <Link href={`/receiving/documents/${r.document_id}/arta-timeline`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-slate-50">
                                                <span className="min-w-0">
                                                    <span className="font-mono text-[13px] font-semibold text-slate-700">{r.tracking_number || r.reference_number}</span>
                                                    <span className="ml-2 text-[13px] text-slate-600">{r.title}</span>
                                                </span>
                                                <span className="text-[12px] text-slate-500">{r.type} · due {day(r.due_date)}</span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    </div>
                )}

                {doc && (
                    <>
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
                            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 p-5 sm:grid-cols-3 lg:grid-cols-6">
                                <div><dt className="text-[12px] text-slate-500">Filed</dt><dd className="mt-0.5 text-[14px] font-medium text-slate-900">{dateTime(doc.filed_at)}</dd></div>
                                <div><dt className="text-[12px] text-slate-500">Period</dt><dd className="mt-0.5 text-[14px] font-medium text-slate-900">{doc.period_days} {doc.working_days ? 'working' : 'calendar'} days</dd></div>
                                <div><dt className="text-[12px] text-slate-500">Original deadline</dt><dd className="mt-0.5 text-[14px] font-medium text-slate-900">{day(doc.original_due)}</dd></div>
                                <div><dt className="text-[12px] text-slate-500">Deadline now</dt><dd className="mt-0.5 text-[14px] font-medium text-slate-900">{day(doc.due_date)}{doc.extension ? ' (extended)' : ''}</dd></div>
                                <div><dt className="text-[12px] text-slate-500">Days used</dt><dd className="mt-0.5 text-[14px] font-medium text-slate-900">{doc.timing.elapsed_days} of {doc.timing.allowed_days}</dd></div>
                                <div>
                                    <dt className="text-[12px] text-slate-500">Standing</dt>
                                    <dd className={`mt-0.5 text-[14px] font-medium ${doc.timing.status === 'overdue' || doc.timing.completed_late ? 'text-red-700' : 'text-slate-900'}`}>
                                        {doc.deemed ? 'Deemed approved' : STATUS_TEXT[doc.timing.status] ?? doc.timing.status}
                                        {doc.timing.overdue_days > 0 && ` · ${doc.timing.overdue_days} day(s) late`}
                                    </dd>
                                </div>
                            </dl>
                            {(doc.extension || doc.deemed || doc.mayoral) && (
                                <div className="space-y-2 border-t border-slate-200 px-5 py-4 text-[13px] text-slate-700">
                                    {doc.extension && (
                                        <p><span className="font-medium text-amber-800">Extended once</span> by {doc.extension.by} on {dateTime(doc.extension.at)} for {doc.extension.days} day(s).{doc.extension.reason ? ` Reason: ${doc.extension.reason}` : ''} {doc.extension.notified ? 'Client notified by SMS.' : ''}</p>
                                    )}
                                    {doc.deemed && <p><span className="font-medium text-violet-800">Deemed approved</span> on {dateTime(doc.deemed.at)} under {doc.deemed.basis}.</p>}
                                    {doc.mayoral?.due_date && doc.mayoral.status === 'pending' && <p><span className="font-medium text-violet-800">Mayor must act by {day(doc.mayoral.due_date)}</span> (LGC Sec. 54, calendar days).</p>}
                                </div>
                            )}
                        </section>

                        <section className="rounded-lg border border-slate-200 bg-white">
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
                                <h2 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900"><CalendarClock className="h-4 w-4 text-slate-500" /> Day by day</h2>
                                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
                                    <span className="flex items-center gap-1"><span className="h-3 w-3 rounded border border-blue-100 bg-blue-50" /> Counted</span>
                                    {doc.extension && <span className="flex items-center gap-1"><span className="h-3 w-3 rounded border border-amber-200 bg-amber-50" /> Extension</span>}
                                    <span className="flex items-center gap-1"><span className="h-3 w-3 rounded border border-red-200 bg-red-50" /> Overdue</span>
                                    <span className="flex items-center gap-1"><span className="h-3 w-3 rounded border border-violet-200 bg-violet-50" /> Holiday</span>
                                    {doc.working_days && <span className="flex items-center gap-1"><span className="h-3 w-3 rounded border border-slate-100 bg-slate-50" /> Weekend</span>}
                                </div>
                            </div>
                            <div className="overflow-x-auto p-5">
                                <div className="grid min-w-[560px] grid-cols-7 gap-1.5">
                                    {WEEKDAYS.map(w => <div key={w} className="pb-1 text-center text-[11px] font-medium text-slate-500">{w}</div>)}
                                    {Array.from({ length: lead }, (_, i) => <div key={`lead-${i}`} />)}
                                    {days.map(d => (
                                        <div
                                            key={d.date}
                                            title={[day(d.date), d.label, d.number ? `Day ${d.number}` : null].filter(Boolean).join(' · ')}
                                            className={`relative min-h-[64px] rounded-lg border p-1.5 text-left ${cellClass(d)} ${d.is_due ? 'ring-2 ring-[#0066cc] ring-offset-1' : ''}`}
                                        >
                                            <div className="text-[11px] font-semibold">{day(d.date, false)}</div>
                                            <div className="mt-0.5 text-[10px] leading-tight">
                                                {d.kind === 'filed' ? 'Filed' : d.number ? `Day ${d.number}` : d.label}
                                                {d.kind === 'holiday' && d.label && <span className="block truncate">{d.label}</span>}
                                            </div>
                                            {d.is_due && <div className="mt-0.5 text-[10px] font-semibold">Deadline</div>}
                                            {d.is_today && <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-emerald-500" title="Today" />}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>

                        <section className="rounded-lg border border-slate-200 bg-white">
                            <h2 className="border-b border-slate-200 px-5 py-3.5 text-[15px] font-semibold text-slate-900">Time with each office</h2>
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-left text-[13px] text-slate-700">
                                    <thead className="border-b border-slate-200 bg-slate-50">
                                        <tr>
                                            <th className="px-4 py-2.5 font-normal text-slate-600">#</th>
                                            <th className="px-4 py-2.5 font-normal text-slate-600">Office / Person</th>
                                            <th className="px-4 py-2.5 font-normal text-slate-600">How it arrived</th>
                                            <th className="px-4 py-2.5 font-normal text-slate-600">Received</th>
                                            <th className="px-4 py-2.5 font-normal text-slate-600">Held for</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {offices.map(h => (
                                            <tr key={h.step} className="odd:bg-white even:bg-slate-50/75">
                                                <td className="px-4 py-2.5 text-slate-500">{h.step}</td>
                                                <td className="px-4 py-2.5">
                                                    <div className="text-slate-900">{h.department ?? 'Office'}</div>
                                                    <div className="text-[12px] text-slate-500">{[h.handler, h.role].filter(Boolean).join(' · ')}</div>
                                                </td>
                                                <td className="px-4 py-2.5">{h.action}{h.from ? ` by ${h.from}` : ''}</td>
                                                <td className="px-4 py-2.5 whitespace-nowrap">{dateTime(h.arrived_at)}</td>
                                                <td className="px-4 py-2.5 whitespace-nowrap">{duration(h.hours)}{!h.left_at && doc.timing.status !== 'completed' ? ' (still there)' : ''}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </>
                )}
            </div>
        </TrackngoLayout>
    );
}
