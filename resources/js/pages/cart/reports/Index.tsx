import { Head, Link, router } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import { Building2, Download, FileBarChart, FileClock, FileWarning, Gauge, ShieldAlert, Timer } from 'lucide-react';
import { useState } from 'react';
import { DateRangeFilter, EmptyState, FilterBar, LevelBadge, PageHeader, Panel, ResetButton, SelectFilter, StatusBadge, buttonStyles, tableStyles } from '@/components/trackngo/cart/CartUi';
import { TablePagination } from '@/components/trackngo/TablePagination';
import { useResettingPage } from '@/hooks/use-resetting-page';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import type { EscalationLevel, MonitorStatus, Option } from '@/lib/cart';
import { formatDate, formatDateTime, plural } from '@/lib/cart';
import { cn } from '@/lib/utils';

type ReportId = 'processing' | 'delayed' | 'escalations' | 'departments' | 'processing_time' | 'compliance';
type Column = { key: string; label: string; kind: 'text' | 'link' | 'datetime' | 'date' | 'number' | 'status' | 'level' | 'remaining' };
type Row = Record<string, string | number | null> & { id?: number };

type Filters = {
    report: ReportId;
    from: string | null;
    to: string | null;
    department: number | null;
    type: number | null;
    status: string | null;
    stage: string | null;
    escalation: string | null;
};

type Props = {
    reportTypes: { id: ReportId; label: string; description: string }[];
    report: { columns: Column[]; rows: Row[]; summary: { label: string; value: string | number }[] };
    filters: Filters;
    options: { departments: Option[]; documentTypes: Option[]; stages: string[]; statuses: { id: string; label: string }[] };
};

const ICONS: Record<ReportId, LucideIcon> = {
    processing: FileBarChart,
    delayed: FileWarning,
    escalations: ShieldAlert,
    departments: Building2,
    processing_time: Timer,
    compliance: Gauge,
};

const query = (filters: Filters) =>
    Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== null && v !== '').map(([k, v]) => [k, String(v)]));

export default function CartReports({ reportTypes, report, filters, options }: Props) {
    const [page, setPage] = useResettingPage(JSON.stringify(filters));
    const [pageSize, setPageSize] = useState(20);


    const apply = (changes: Partial<Filters>) =>
        router.get('/cart/reports', query({ ...filters, ...changes }), { preserveState: true, preserveScroll: true, replace: true });

    const exportUrl = `/cart/reports/export?${new URLSearchParams(query(filters)).toString()}`;
    const current = reportTypes.find((type) => type.id === filters.report) ?? reportTypes[0];
    const pageRows = report.rows.slice((page - 1) * pageSize, page * pageSize);
    const hasFilters = Boolean(filters.from || filters.to || filters.department || filters.type || filters.status || filters.stage || filters.escalation);

    return (
        <TrackngoLayout role="cart">
            <Head title="Reports" />

            <PageHeader
                title="Reports"
                description="Monitoring and compliance reports built from the same data as the CART dashboard."
                actions={
                    <a href={exportUrl} className={cn(buttonStyles.primary, report.rows.length === 0 && 'pointer-events-none opacity-50')} aria-disabled={report.rows.length === 0}>
                        <Download className="h-4 w-4" />
                        Export CSV
                    </a>
                }
            />

            <div className="space-y-5 pb-10">
                {/* Report picker */}
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                    {reportTypes.map((type) => {
                        const Icon = ICONS[type.id];
                        const active = type.id === filters.report;

                        return (
                            <button
                                key={type.id}
                                type="button"
                                onClick={() => apply({ report: type.id })}
                                aria-pressed={active}
                                className={cn(
                                    'flex items-start gap-3 rounded-xl border bg-white p-3.5 text-left transition-colors',
                                    active ? 'border-[#0066cc] ring-2 ring-[#0066cc]/15' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60',
                                )}
                            >
                                <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', active ? 'bg-[#0066cc] text-white' : 'bg-slate-100 text-slate-500')}>
                                    <Icon className="h-4 w-4" />
                                </span>
                                <span className="min-w-0">
                                    <span className={cn('block text-[13px] font-semibold', active ? 'text-[#0066cc]' : 'text-slate-800')}>{type.label}</span>
                                    <span className="mt-0.5 block text-xs text-slate-500">{type.description}</span>
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="space-y-2">
                    <FilterBar activeCount={[filters.from || filters.to, filters.department, filters.type, filters.status, filters.stage, filters.escalation].filter(Boolean).length}>
                        <DateRangeFilter
                            label={filters.report === 'escalations' ? 'Escalated' : 'Received'}
                            from={filters.from ?? ''}
                            to={filters.to ?? ''}
                            onChange={(from, to) => apply({ from: from || null, to: to || null })}
                        />
                        <SelectFilter label="All departments" value={filters.department ? String(filters.department) : ''} onChange={(v) => apply({ department: v ? Number(v) : null })} options={options.departments.map((d) => ({ value: String(d.id), label: d.name }))} />
                        <SelectFilter label="All types" value={filters.type ? String(filters.type) : ''} onChange={(v) => apply({ type: v ? Number(v) : null })} options={options.documentTypes.map((t) => ({ value: String(t.id), label: t.name }))} />
                        <SelectFilter label="Any status" value={filters.status ?? ''} onChange={(v) => apply({ status: v || null })} options={options.statuses.map((s) => ({ value: s.id, label: s.label }))} />
                        <SelectFilter label="Any stage" value={filters.stage ?? ''} onChange={(v) => apply({ stage: v || null })} options={options.stages.map((s) => ({ value: s, label: s }))} />
                        <SelectFilter
                            label="Any escalation"
                            value={filters.escalation ?? ''}
                            onChange={(v) => apply({ escalation: v || null })}
                            options={[
                                { value: 'active', label: 'Active escalation' },
                                { value: 'resolved', label: 'Resolved escalation' },
                                { value: 'none', label: 'Never escalated' },
                            ]}
                        />
                        {hasFilters && <ResetButton onClick={() => router.get('/cart/reports', { report: filters.report }, { preserveState: true, replace: true })} />}
                    </FilterBar>
                    <p className="text-xs text-slate-500">The CSV export uses the same report and filters.</p>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {report.summary.map((item) => (
                        <div key={item.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xs">
                            <p className="text-xs text-slate-500">{item.label}</p>
                            <p className="mt-1 text-[22px] font-bold text-slate-900 tabular-nums">{item.value}</p>
                        </div>
                    ))}
                </div>

                <Panel title={current.label} description={plural(report.rows.length, 'row')}>
                    {report.rows.length === 0 ? (
                        <EmptyState icon={FileClock} title="No data for these filters" message="Widen the date range or clear some filters." />
                    ) : (
                        <>
                            {/* Wide reports keep readable columns and scroll sideways instead of squeezing */}
                            <div className="overflow-x-auto">
                                <table className={cn(tableStyles.table, 'w-max min-w-full')}>
                                    <thead className={tableStyles.head}>
                                        <tr>
                                            {report.columns.map((column) => (
                                                <th key={column.key} className={cn(tableStyles.th, (column.kind === 'number' || column.kind === 'remaining') && 'text-right')}>
                                                    {column.label}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pageRows.map((row, index) => (
                                            <tr key={`${row.id ?? 'row'}-${index}`} className={tableStyles.row}>
                                                {report.columns.map((column) => (
                                                    <td key={column.key} className={cn(tableStyles.td, (column.kind === 'number' || column.kind === 'remaining') && 'text-right tabular-nums')}>
                                                        <Cell column={column} row={row} />
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <TablePagination currentPage={page} pageSize={pageSize} totalItems={report.rows.length} onPageChange={setPage} onPageSizeChange={setPageSize} itemLabel="rows" />
                        </>
                    )}
                </Panel>
            </div>
        </TrackngoLayout>
    );
}

function Cell({ column, row }: { column: Column; row: Row }) {
    const value = row[column.key];

    if (value === null || value === undefined || value === '') {
        return <span className="text-slate-300">—</span>;
    }

    switch (column.kind) {
        case 'link':
            return row.id ? (
                <Link href={`/cart/monitoring/${row.id}`} className="font-medium whitespace-nowrap text-[#0066cc] hover:underline">
                    {value}
                </Link>
            ) : (
                <>{value}</>
            );
        case 'datetime':
            return <span className="whitespace-nowrap">{formatDateTime(String(value))}</span>;
        case 'date':
            return <span className="whitespace-nowrap">{formatDate(String(value))}</span>;
        case 'status':
            return <StatusBadge status={value as MonitorStatus} />;
        case 'level':
            return <LevelBadge level={value as EscalationLevel} />;
        case 'remaining': {
            const days = Number(value);

            return <span className={cn(days < 0 ? 'font-medium text-red-700' : days === 0 ? 'text-orange-700' : 'text-slate-700')}>{days < 0 ? `${-days} over` : days === 0 ? 'Due' : `${days} left`}</span>;
        }
        case 'text':
            return String(value).length > 32 ? (
                <span className="line-clamp-2 block w-[240px]" title={String(value)}>
                    {value}
                </span>
            ) : (
                <span className="whitespace-nowrap">{value}</span>
            );
        default:
            return <span className="whitespace-nowrap">{value}</span>;
    }
}
