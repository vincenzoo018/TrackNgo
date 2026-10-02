import { Head, Link } from '@inertiajs/react';
import { ChevronRight, FileSearch } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
    DateRangeFilter,
    DocLink,
    DocTitle,
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
    tableStyles,
} from '@/components/trackngo/cart/CartUi';
import { TablePagination } from '@/components/trackngo/TablePagination';
import TabNavigation from '@/components/trackngo/TabNavigation';
import type { TabItem } from '@/components/trackngo/TabNavigation';
import { useResettingPage } from '@/hooks/use-resetting-page';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import type { FilterOptions, MonitorRow, MonitorStatus } from '@/lib/cart';
import { MONITOR_STATUS, STATUS_ORDER, elapsedSince, formatDate, formatShortDate, formatShortDateTime, handlerLabel, inDateRange, matches, plural } from '@/lib/cart';
import { cn } from '@/lib/utils';

type View = 'active' | 'pending' | 'in_process' | 'delayed' | 'near' | 'escalated' | 'completed';
type Sort = 'newest' | 'urgent' | 'longest';

const VIEWS: Record<View, { label: string; match: (row: MonitorRow) => boolean }> = {
    active: { label: 'All active', match: (r) => !r.is_closed },
    pending: { label: 'Pending', match: (r) => r.is_pending },
    in_process: { label: 'In process', match: (r) => !r.is_closed && !r.is_pending },
    delayed: { label: 'Delayed', match: (r) => !r.is_closed && r.arta_status === 'overdue' },
    near: { label: 'Near deadline', match: (r) => !r.is_closed && (r.arta_status === 'approaching' || r.arta_status === 'due') },
    escalated: { label: 'Escalated', match: (r) => r.monitor_status === 'escalated' },
    completed: { label: 'Completed', match: (r) => r.is_closed },
};

const URGENCY: Record<MonitorStatus, number> = { escalated: 0, overdue: 1, due: 2, approaching: 3, within_time: 4, completed: 5 };

type Props = { rows: MonitorRow[]; options: FilterOptions; initial: { view?: string; search?: string } };

export default function CartMonitoringIndex({ rows, options, initial }: Props) {
    const [view, setView] = useState<View>(initial.view && initial.view in VIEWS ? (initial.view as View) : 'active');
    const [search, setSearch] = useState(initial.search ?? '');
    const [type, setType] = useState('');
    const [department, setDepartment] = useState('');
    const [handler, setHandler] = useState('');
    const [status, setStatus] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [sort, setSort] = useState<Sort>('newest');
    const [page, setPage] = useResettingPage(JSON.stringify([view, search, type, department, handler, status, from, to, sort]));
    const [pageSize, setPageSize] = useState(20);

    const handlers = useMemo(
        () => [...new Set(rows.filter((r) => !r.is_closed && r.current_handler).map((r) => r.current_handler as string))].sort(),
        [rows],
    );

    const filtered = useMemo(() => {
        const list = rows.filter(
            (r) =>
                VIEWS[view].match(r) &&
                matches(search, r.tracking_number, r.reference_number, r.title, r.current_handler, r.current_department) &&
                (!type || String(r.type_id) === type) &&
                (!department || String(r.current_department_id) === department || String(r.department_id) === department) &&
                (!handler || r.current_handler === handler) &&
                (!status || r.monitor_status === status) &&
                inDateRange(r.date_received, from, to),
        );

        if (sort === 'urgent') {
            return [...list].sort((a, b) => URGENCY[a.monitor_status] - URGENCY[b.monitor_status] || a.remaining_days - b.remaining_days);
        }

        if (sort === 'longest') {
            return [...list].sort((a, b) => (b.days_with_handler ?? -1) - (a.days_with_handler ?? -1));
        }

        return list;
    }, [rows, view, search, type, department, handler, status, from, to, sort]);


    const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
    const activeFilters = [type, department, handler, status, from || to].filter(Boolean).length;
    const hasFilters = Boolean(search) || activeFilters > 0;
    const reset = () => {
        setSearch('');
        setType('');
        setDepartment('');
        setHandler('');
        setStatus('');
        setFrom('');
        setTo('');
    };

    const tabs: TabItem<View>[] = (Object.keys(VIEWS) as View[]).map((id) => ({ id, label: VIEWS[id].label, count: rows.filter(VIEWS[id].match).length }));

    return (
        <TrackngoLayout role="cart">
            <Head title="Document Monitoring" />

            <PageHeader
                title="Document Monitoring"
                description="Where every document is, who has it, and how much of its processing period is used. View only — documents are processed by their handlers."
            />

            <div className="space-y-4 pb-10">
                <TabNavigation tabs={tabs} activeTab={view} onChange={setView} ariaLabel="Monitoring views" />

                <FilterBar activeCount={activeFilters} search={<SearchInput value={search} onChange={setSearch} placeholder="Tracking number, title, handler…" />}>
                    <SelectFilter label="All types" value={type} onChange={setType} options={options.documentTypes.map((t) => ({ value: String(t.id), label: t.name }))} />
                    <SelectFilter label="All departments" value={department} onChange={setDepartment} options={options.departments.map((d) => ({ value: String(d.id), label: d.name }))} />
                    <SelectFilter label="Any handler" value={handler} onChange={setHandler} options={handlers.map((name) => ({ value: name, label: name }))} />
                    <SelectFilter label="Any status" value={status} onChange={setStatus} options={STATUS_ORDER.map((s) => ({ value: s, label: MONITOR_STATUS[s].label }))} />
                    <DateRangeFilter
                        from={from}
                        to={to}
                        onChange={(nextFrom, nextTo) => {
                            setFrom(nextFrom);
                            setTo(nextTo);
                        }}
                    />
                </FilterBar>

                <Panel
                    title={`${plural(filtered.length, 'document')}`}
                    aside={
                        <div className="flex items-center gap-2">
                            {hasFilters && <ResetButton onClick={reset} />}
                            <SelectFilter
                                className="w-48"
                                label="Newest first"
                                value={sort === 'newest' ? '' : sort}
                                onChange={(value) => setSort((value || 'newest') as Sort)}
                                options={[
                                    { value: 'urgent', label: 'Most urgent first' },
                                    { value: 'longest', label: 'Longest with handler' },
                                ]}
                            />
                        </div>
                    }
                >
                    {filtered.length === 0 ? (
                        <EmptyState icon={FileSearch} title="No documents match" message="Try another view or clear the filters." />
                    ) : (
                        <>
                            {/* Desktop table */}
                            <div className="relative hidden overflow-x-auto md:block">
                                <table className={tableStyles.table}>
                                    <thead className={tableStyles.head}>
                                        <tr>
                                            <th className={tableStyles.th}>Tracking #</th>
                                            <th className={tableStyles.th}>Document</th>
                                            <th className={tableStyles.th}>Current handler</th>
                                            <th className={tableStyles.th}>Stage</th>
                                            <th className={tableStyles.th}>With handler</th>
                                            <th className={tableStyles.th}>Processing time</th>
                                            <th className={tableStyles.th}>Status</th>
                                            <th className={tableStyles.th} aria-label="Open" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pageRows.map((row) => (
                                            <tr key={row.id} className={tableStyles.row}>
                                                <td className={tableStyles.td}>
                                                    <DocLink row={row} />
                                                </td>
                                                <td className={cn(tableStyles.td, 'max-w-[200px]')}>
                                                    <DocTitle row={row} detail={`received ${formatDate(row.date_received)}`} />
                                                </td>
                                                <td className={cn(tableStyles.td, 'max-w-[190px]')}>
                                                    {row.is_closed ? (
                                                        <span className="text-slate-400">—</span>
                                                    ) : (
                                                        <>
                                                            <p className="truncate text-slate-800">{handlerLabel(row)}</p>
                                                            <p className="truncate text-xs text-slate-500">
                                                                {row.current_handler ? [row.current_handler_role, row.current_department].filter(Boolean).join(' · ') : 'No named handler'}
                                                            </p>
                                                        </>
                                                    )}
                                                </td>
                                                <td className={tableStyles.td}>
                                                    <p className="max-w-[130px] text-slate-800">{row.stage.label}</p>
                                                    <p className="text-xs text-slate-500">
                                                        Step {row.stage.step} of {row.stage.total}
                                                    </p>
                                                </td>
                                                <td className={tableStyles.td}>
                                                    {row.is_closed ? (
                                                        <p className="whitespace-nowrap text-slate-600">Done {formatDate(row.completed_at)}</p>
                                                    ) : (
                                                        <>
                                                            <p className="whitespace-nowrap text-slate-800">{formatShortDateTime(row.holder_since)}</p>
                                                            <p className={cn('text-xs whitespace-nowrap', (row.idle_days ?? 0) >= 2 ? 'font-medium text-amber-700' : 'text-slate-500')}>
                                                                for {elapsedSince(row.holder_since)}
                                                            </p>
                                                        </>
                                                    )}
                                                </td>
                                                <td className={tableStyles.td}>
                                                    <TimeMeter row={row} />
                                                    <p className="mt-1 text-xs text-slate-500">Due {formatShortDate(row.deadline)}</p>
                                                </td>
                                                <td className={tableStyles.td}>
                                                    <div className="flex flex-col items-start gap-1">
                                                        <StatusBadge status={row.monitor_status} />
                                                        {row.monitor_status === 'escalated' && <LevelBadge level={row.escalation?.level ?? 'Manual'} />}
                                                    </div>
                                                </td>
                                                <td className={cn(tableStyles.td, 'pl-0 text-right')}>
                                                    <Link href={`/cart/monitoring/${row.id}`} aria-label={`Open ${row.tracking_number}`} className="inline-flex rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-[#0066cc]">
                                                        <ChevronRight className="h-4 w-4" />
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile cards */}
                            <ul className="divide-y divide-slate-100 md:hidden">
                                {pageRows.map((row) => (
                                    <li key={row.id}>
                                        <Link href={`/cart/monitoring/${row.id}`} className="block space-y-2 px-4 py-3.5 active:bg-slate-50">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="font-medium text-[#0066cc]">{row.tracking_number}</p>
                                                    <DocTitle row={row} />
                                                </div>
                                                <StatusBadge status={row.monitor_status} />
                                            </div>
                                            {!row.is_closed && (
                                                <p className="text-xs text-slate-600">
                                                    With <span className="font-medium text-slate-800">{handlerLabel(row)}</span> · {row.stage.label} · {elapsedSince(row.holder_since)}
                                                </p>
                                            )}
                                            <TimeMeter row={row} />
                                        </Link>
                                    </li>
                                ))}
                            </ul>

                            <TablePagination currentPage={page} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} onPageSizeChange={setPageSize} itemLabel="documents" />
                        </>
                    )}
                </Panel>
            </div>
        </TrackngoLayout>
    );
}
