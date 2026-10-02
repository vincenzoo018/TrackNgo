import { Head, Link, router } from '@inertiajs/react';
import { BellRing, ChevronRight, Info, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useCartActions } from '@/components/trackngo/cart/CartActionModals';
import {
    DocLink,
    EmptyState,
    FilterBar,
    LevelBadge,
    PageHeader,
    Panel,
    ResetButton,
    SearchInput,
    SelectFilter,
    StatusBadge,
    TimeMeter,
    buttonStyles,
    tableStyles,
} from '@/components/trackngo/cart/CartUi';
import { TablePagination } from '@/components/trackngo/TablePagination';
import TabNavigation from '@/components/trackngo/TabNavigation';
import type { TabItem } from '@/components/trackngo/TabNavigation';
import { useResettingPage } from '@/hooks/use-resetting-page';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import type { EscalationRules, FilterOptions, MonitorRow, MonitorStatus } from '@/lib/cart';
import { MONITOR_STATUS, STATUS_ORDER, dayUnit, formatDate, formatDateTime, formatShortDateTime, handlerLabel, matches, plural, timeAgo } from '@/lib/cart';
import { cn } from '@/lib/utils';

type View = 'active' | 'escalated' | 'delayed' | 'near' | 'within' | 'resolved';

const VIEWS: Record<View, { label: string; match: (row: MonitorRow) => boolean }> = {
    active: { label: 'All active', match: (r) => !r.is_closed },
    escalated: { label: 'Escalated', match: (r) => r.monitor_status === 'escalated' },
    delayed: { label: 'Delayed', match: (r) => !r.is_closed && r.arta_status === 'overdue' },
    near: { label: 'Near deadline', match: (r) => !r.is_closed && (r.arta_status === 'approaching' || r.arta_status === 'due') },
    within: { label: 'Within time', match: (r) => r.monitor_status === 'within_time' },
    resolved: { label: 'Resolved / Completed', match: (r) => r.is_closed || r.escalation?.status === 'resolved' },
};

const URGENCY: Record<MonitorStatus, number> = { escalated: 0, overdue: 1, due: 2, approaching: 3, within_time: 4, completed: 5 };

type Props = { rows: MonitorRow[]; options: FilterOptions; rules: EscalationRules; initial: { view?: string; status?: string } };

export default function CartEscalationBoard({ rows, options, rules, initial }: Props) {
    const { openFollowUp, openResolve, modals } = useCartActions();
    const [view, setView] = useState<View>(initial.view && initial.view in VIEWS ? (initial.view as View) : initial.status === 'completed' ? 'resolved' : 'active');
    const [status, setStatus] = useState(initial.status && initial.status in MONITOR_STATUS && initial.status !== 'completed' ? initial.status : '');
    const [search, setSearch] = useState('');
    const [type, setType] = useState('');
    const [department, setDepartment] = useState('');
    const [level, setLevel] = useState('');
    const [page, setPage] = useResettingPage(JSON.stringify([view, status, search, type, department, level]));
    const [pageSize, setPageSize] = useState(20);

    useEffect(() => {
        const timer = setInterval(() => router.reload({ only: ['rows'] }), 60_000);

        return () => clearInterval(timer);
    }, []);

    const filtered = useMemo(
        () =>
            rows
                .filter(
                    (r) =>
                        VIEWS[view].match(r) &&
                        (!status || r.monitor_status === status) &&
                        matches(search, r.tracking_number, r.reference_number, r.title, r.current_handler, r.current_department, r.escalation?.reason) &&
                        (!type || String(r.type_id) === type) &&
                        (!department || String(r.current_department_id) === department || String(r.department_id) === department) &&
                        (!level || r.escalation?.level === level),
                )
                .sort((a, b) =>
                    view === 'resolved'
                        ? (b.escalation?.resolved_at ?? b.completed_at ?? '').localeCompare(a.escalation?.resolved_at ?? a.completed_at ?? '')
                        : URGENCY[a.monitor_status] - URGENCY[b.monitor_status] || b.overdue_days - a.overdue_days || a.remaining_days - b.remaining_days,
                ),
        [rows, view, status, search, type, department, level],
    );


    const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
    const activeFilters = [status, type, department, level].filter(Boolean).length;
    const hasFilters = Boolean(search) || activeFilters > 0;
    const resetFilters = () => {
        setStatus('');
        setSearch('');
        setType('');
        setDepartment('');
        setLevel('');
    };
    const tabs: TabItem<View>[] = (Object.keys(VIEWS) as View[]).map((id) => ({ id, label: VIEWS[id].label, count: rows.filter(VIEWS[id].match).length }));

    return (
        <TrackngoLayout role="cart">
            <Head title="ARTA / Escalations" />

            <PageHeader
                title="ARTA / Escalations"
                description="Each document measured against its allowed processing period. Escalations are recorded automatically once a document passes its deadline; handlers stay responsible for processing."
            />

            <div className="space-y-4 pb-10">
                <details className="group rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[13px] text-slate-600">
                    <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-slate-700">
                        <Info className="h-4 w-4 text-[#0066cc]" />
                        How statuses and escalation levels are decided
                        <ChevronRight className="ml-auto h-4 w-4 text-slate-400 transition-transform group-open:rotate-90" />
                    </summary>
                    <div className="mt-2.5 grid gap-x-8 gap-y-1.5 border-t border-slate-100 pt-2.5 text-xs sm:grid-cols-2">
                        <p>
                            <strong className="text-slate-800">WD</strong> = {dayUnit(rules)} elapsed since the document was assigned; <strong className="text-slate-800">L</strong> = allowed period for its document type.
                        </p>
                        <p>
                            <strong className="text-slate-800">Escalated</strong> when WD &gt; L. Overdue days (OD = WD − L) set the level.
                        </p>
                        <p>
                            <strong className="text-amber-700">Approaching</strong> when {Math.round(rules.approaching_ratio * 100)}% or less of L remains · <strong className="text-orange-700">Due</strong> on the deadline day.
                        </p>
                        <p className="flex flex-wrap items-center gap-1.5">
                            <LevelBadge level="Warning" /> OD 1–{rules.warning_max_days} · <LevelBadge level="Critical" /> OD {rules.warning_max_days + 1}–{rules.critical_max_days} · <LevelBadge level="Overdue" /> OD &gt; {rules.critical_max_days}
                        </p>
                        <p className="sm:col-span-2">Each level notifies CART and the responsible office once. Follow-ups are limited to one per handler every {rules.follow_up_hours} hours.</p>
                    </div>
                </details>

                <TabNavigation tabs={tabs} activeTab={view} onChange={setView} ariaLabel="ARTA status views" />

                <FilterBar activeCount={activeFilters} search={<SearchInput value={search} onChange={setSearch} placeholder="Tracking number, handler, reason…" />}>
                    <SelectFilter label="Any status" value={status} onChange={setStatus} options={STATUS_ORDER.filter((s) => s !== 'completed').map((s) => ({ value: s, label: MONITOR_STATUS[s].label }))} />
                    <SelectFilter label="Any level" value={level} onChange={setLevel} options={['Warning', 'Critical', 'Overdue', 'Manual'].map((l) => ({ value: l, label: l }))} />
                    <SelectFilter label="All types" value={type} onChange={setType} options={options.documentTypes.map((t) => ({ value: String(t.id), label: `${t.name} (${t.days}d)` }))} />
                    <SelectFilter label="All departments" value={department} onChange={setDepartment} options={options.departments.map((d) => ({ value: String(d.id), label: d.name }))} />
                </FilterBar>

                <Panel title={plural(filtered.length, 'document')} aside={hasFilters && <ResetButton onClick={resetFilters} />}>
                    {filtered.length === 0 ? (
                        <EmptyState icon={ShieldCheck} title="Nothing here" message="No documents match this view and filters." />
                    ) : (
                        <>
                            <div className="hidden overflow-x-auto lg:block">
                                <table className={tableStyles.table}>
                                    <thead className={tableStyles.head}>
                                        <tr>
                                            <th className={tableStyles.th}>Document</th>
                                            <th className={tableStyles.th}>Responsible</th>
                                            <th className={tableStyles.th}>Received by handler</th>
                                            <th className={tableStyles.th}>Processing time</th>
                                            <th className={tableStyles.th}>Status</th>
                                            <th className={tableStyles.th}>Escalation</th>
                                            <th className={cn(tableStyles.th, 'text-right')}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pageRows.map((row) => (
                                            <tr key={row.id} className={tableStyles.row}>
                                                <td className={tableStyles.td}>
                                                    <DocLink row={row} />
                                                    <p className="text-xs text-slate-500">{row.document_type}</p>
                                                </td>
                                                <td className={cn(tableStyles.td, 'max-w-[220px]')}>
                                                    {row.is_closed ? (
                                                        <span className="text-slate-400">Completed {formatDate(row.completed_at)}</span>
                                                    ) : (
                                                        <>
                                                            <p className="truncate text-slate-800">{handlerLabel(row)}</p>
                                                            <p className="truncate text-xs text-slate-500">
                                                                {row.current_handler ? `${row.current_department ?? ''} · ` : ''}
                                                                {row.stage.label}
                                                            </p>
                                                        </>
                                                    )}
                                                </td>
                                                <td className={tableStyles.td}>
                                                    {row.is_closed ? (
                                                        <span className="text-slate-400">—</span>
                                                    ) : (
                                                        <>
                                                            <p className="whitespace-nowrap">{formatShortDateTime(row.holder_since)}</p>
                                                            <p className="text-xs text-slate-500">{timeAgo(row.holder_since)}</p>
                                                        </>
                                                    )}
                                                </td>
                                                <td className={tableStyles.td}>
                                                    <TimeMeter row={row} />
                                                    <p className="mt-1 text-xs whitespace-nowrap text-slate-500">
                                                        L {row.allowed_days}d · due {formatDate(row.deadline)}
                                                    </p>
                                                </td>
                                                <td className={tableStyles.td}>
                                                    <StatusBadge status={row.monitor_status} />
                                                </td>
                                                <td className={cn(tableStyles.td, 'max-w-[220px]')}>
                                                    {row.escalation ? (
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-1.5">
                                                                <LevelBadge level={row.escalation.level} />
                                                                <span className={cn('text-xs font-medium', row.escalation.status === 'active' ? 'text-rose-700' : 'text-emerald-700')}>
                                                                    {row.escalation.status === 'active' ? 'Active' : 'Resolved'}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-slate-500">{formatDateTime(row.escalation.escalated_at)}</p>
                                                            <p className="line-clamp-2 text-xs text-slate-600" title={row.escalation.reason ?? undefined}>
                                                                {row.escalation.reason}
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-slate-400">None</span>
                                                    )}
                                                </td>
                                                <td className={cn(tableStyles.td, 'text-right')}>
                                                    <RowActions row={row} onFollowUp={openFollowUp} onResolve={openResolve} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Tablet / mobile cards */}
                            <ul className="divide-y divide-slate-100 lg:hidden">
                                {pageRows.map((row) => (
                                    <li key={row.id} className="space-y-2.5 px-4 py-3.5">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <DocLink row={row} />
                                                <p className="text-xs text-slate-500">
                                                    {row.document_type}
                                                    {!row.is_closed && ` · with ${handlerLabel(row)}`}
                                                </p>
                                            </div>
                                            <StatusBadge status={row.monitor_status} />
                                        </div>
                                        <TimeMeter row={row} />
                                        {row.escalation && (
                                            <div className="flex items-start gap-2 text-xs text-slate-600">
                                                <LevelBadge level={row.escalation.level} />
                                                <span className="line-clamp-2">{row.escalation.reason}</span>
                                            </div>
                                        )}
                                        <RowActions row={row} onFollowUp={openFollowUp} onResolve={openResolve} className="justify-start" />
                                    </li>
                                ))}
                            </ul>

                            <TablePagination currentPage={page} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} onPageSizeChange={setPageSize} itemLabel="documents" />
                        </>
                    )}
                </Panel>
            </div>

            {modals}
        </TrackngoLayout>
    );
}

function RowActions({
    row,
    onFollowUp,
    onResolve,
    className,
}: {
    row: MonitorRow;
    onFollowUp: (row: MonitorRow) => void;
    onResolve: (row: MonitorRow) => void;
    className?: string;
}) {
    return (
        <div className={cn('flex items-center justify-end gap-1', className)}>
            {row.escalation?.status === 'active' && (
                <button type="button" onClick={() => onResolve(row)} className={buttonStyles.ghost}>
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    Resolve
                </button>
            )}
            {!row.is_closed && (
                <button
                    type="button"
                    onClick={() => onFollowUp(row)}
                    disabled={!row.can_follow_up}
                    title={row.can_follow_up ? 'Send a follow-up to the handler' : 'A follow-up was sent recently'}
                    className={buttonStyles.ghost}
                >
                    <BellRing className="h-3.5 w-3.5 text-[#0066cc]" />
                    Follow up
                </button>
            )}
            <Link href={`/cart/monitoring/${row.id}`} aria-label={`Open ${row.tracking_number}`} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-[#0066cc]">
                <ChevronRight className="h-4 w-4" />
            </Link>
        </div>
    );
}
