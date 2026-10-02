import { Head, Link, router } from '@inertiajs/react';
import { ArrowRight, FileSearch, Route as RouteIcon, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DateRangeFilter, DocTitle, EmptyState, FilterBar, PageHeader, Panel, ResetButton, SelectFilter, StatusBadge, TimeMeter } from '@/components/trackngo/cart/CartUi';
import { TrackingTimeline } from '@/components/trackngo/cart/TrackingTimeline';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import type { FilterOptions, MonitorRow, TimelineStop } from '@/lib/cart';
import { MONITOR_STATUS, STATUS_ORDER, formatDate, handlerLabel, inDateRange, matches } from '@/lib/cart';
import { cn } from '@/lib/utils';

type Props = {
    rows: MonitorRow[];
    options: FilterOptions;
    selected: { id: number; timeline: TimelineStop[] } | null;
};

const RESULT_LIMIT = 50;

export default function CartSearch({ rows, options, selected }: Props) {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const [query, setQuery] = useState(params.get('q') ?? '');
    const [type, setType] = useState('');
    const [department, setDepartment] = useState('');
    const [handler, setHandler] = useState('');
    const [status, setStatus] = useState('');
    const [escalation, setEscalation] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [loadingId, setLoadingId] = useState<number | null>(null);

    const handlers = useMemo(() => [...new Set(rows.map((r) => r.current_handler).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b)), [rows]);
    const hasCriteria = Boolean(query.trim() || type || department || handler || status || escalation || from || to);

    const results = useMemo(() => {
        if (!hasCriteria) {
            return rows.slice(0, 10);
        }

        return rows.filter(
            (r) =>
                matches(query, r.tracking_number, r.reference_number, r.title, r.document_type) &&
                (!type || String(r.type_id) === type) &&
                (!department || String(r.current_department_id) === department || String(r.department_id) === department) &&
                (!handler || r.current_handler === handler) &&
                (!status || r.monitor_status === status) &&
                (!escalation || (escalation === 'none' ? !r.escalation : r.escalation?.status === escalation)) &&
                inDateRange(r.date_received, from, to),
        );
    }, [rows, hasCriteria, query, type, department, handler, status, escalation, from, to]);

    const selectedRow = selected ? rows.find((r) => r.id === selected.id) : undefined;

    const choose = (row: MonitorRow) => {
        // Small screens open the full tracking page; wide screens show the timeline beside the results
        if (!window.matchMedia('(min-width: 1024px)').matches) {
            router.visit(`/cart/monitoring/${row.id}`);

            return;
        }

        setLoadingId(row.id);
        router.get(
            '/cart/search',
            { ...(query ? { q: query } : {}), doc: row.id },
            { only: ['selected'], preserveState: true, preserveScroll: true, replace: true, onFinish: () => setLoadingId(null) },
        );
    };

    const reset = () => {
        setQuery('');
        setType('');
        setDepartment('');
        setHandler('');
        setStatus('');
        setEscalation('');
        setFrom('');
        setTo('');
    };

    return (
        <TrackngoLayout role="cart">
            <Head title="Search Documents" />

            <PageHeader title="Search Documents" description="Find any document — active or finished — and follow its route from filing to completion." />

            <div className="space-y-4 pb-10">
                <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Enter a tracking number, reference number or title"
                        className="h-12 w-full rounded-xl border border-slate-200 bg-white pr-4 pl-12 text-[15px] text-slate-800 shadow-xs placeholder:text-slate-400 focus:border-[var(--tng-blue-500)] focus:ring-2 focus:ring-[var(--tng-blue-500)]/15 focus:outline-none"
                    />
                </div>

                <FilterBar activeCount={[type, department, handler, status, escalation, from || to].filter(Boolean).length}>
                    <SelectFilter label="All types" value={type} onChange={setType} options={options.documentTypes.map((t) => ({ value: String(t.id), label: t.name }))} />
                    <SelectFilter label="All departments" value={department} onChange={setDepartment} options={options.departments.map((d) => ({ value: String(d.id), label: d.name }))} />
                    <SelectFilter label="Any handler" value={handler} onChange={setHandler} options={handlers.map((name) => ({ value: name, label: name }))} />
                    <SelectFilter label="Any status" value={status} onChange={setStatus} options={STATUS_ORDER.map((s) => ({ value: s, label: MONITOR_STATUS[s].label }))} />
                    <SelectFilter
                        label="Any escalation"
                        value={escalation}
                        onChange={setEscalation}
                        options={[
                            { value: 'active', label: 'Active escalation' },
                            { value: 'resolved', label: 'Resolved escalation' },
                            { value: 'none', label: 'Never escalated' },
                        ]}
                    />
                    <DateRangeFilter
                        from={from}
                        to={to}
                        onChange={(nextFrom, nextTo) => {
                            setFrom(nextFrom);
                            setTo(nextTo);
                        }}
                    />
                </FilterBar>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
                    <Panel
                        title={hasCriteria ? `${results.length} result${results.length === 1 ? '' : 's'}` : 'Recent documents'}
                        description={hasCriteria && results.length > RESULT_LIMIT ? `Showing the first ${RESULT_LIMIT} — refine your search to narrow it down` : undefined}
                        aside={hasCriteria && <ResetButton onClick={reset} />}
                        className="lg:col-span-2"
                    >
                        {results.length === 0 ? (
                            <EmptyState icon={FileSearch} title="No documents found" message="Check the tracking number or loosen the filters." />
                        ) : (
                            <ul className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
                                {results.slice(0, RESULT_LIMIT).map((row) => (
                                    <li key={row.id}>
                                        <button
                                            type="button"
                                            onClick={() => choose(row)}
                                            className={cn(
                                                'block w-full space-y-1.5 border-l-2 px-4 py-3 text-left transition-colors hover:bg-slate-50',
                                                selected?.id === row.id ? 'border-[#0066cc] bg-blue-50/50' : 'border-transparent',
                                                loadingId === row.id && 'opacity-60',
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <span className="font-semibold text-[#0066cc]">{row.tracking_number}</span>
                                                <StatusBadge status={row.monitor_status} />
                                            </div>
                                            <DocTitle row={row} />
                                            <p className="text-xs text-slate-500">
                                                {row.is_closed ? `Completed ${formatDate(row.completed_at)}` : `With ${handlerLabel(row)} · ${row.stage.label}`} · received {formatDate(row.date_received)}
                                            </p>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Panel>

                    <div className="hidden lg:col-span-3 lg:block">
                        {selected && selectedRow ? (
                            <Panel
                                title={selectedRow.tracking_number}
                                description={`${selectedRow.title} · ${selectedRow.document_type}`}
                                aside={
                                    <Link href={`/cart/monitoring/${selectedRow.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-[#0066cc] hover:underline">
                                        Full details
                                        <ArrowRight className="h-3.5 w-3.5" />
                                    </Link>
                                }
                            >
                                <div className="grid grid-cols-2 gap-4 border-b border-slate-100 px-5 py-4">
                                    <div>
                                        <p className="text-xs text-slate-500">Status</p>
                                        <div className="mt-1">
                                            <StatusBadge status={selectedRow.monitor_status} />
                                        </div>
                                    </div>
                                    <TimeMeter row={selectedRow} />
                                </div>
                                <div className="p-5">
                                    <TrackingTimeline stops={selected.timeline} />
                                </div>
                            </Panel>
                        ) : (
                            <Panel>
                                <EmptyState icon={RouteIcon} title="Select a document" message="Its tracking timeline — every office it passed through, with timestamps and how long each held it — appears here." className="py-24" />
                            </Panel>
                        )}
                    </div>
                </div>
            </div>
        </TrackngoLayout>
    );
}
