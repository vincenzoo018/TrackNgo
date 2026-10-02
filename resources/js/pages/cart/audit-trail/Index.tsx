import { Head, Link, router } from '@inertiajs/react';
import { History, Lock, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { DateRangeFilter, EmptyState, FilterBar, PageHeader, Panel, ResetButton, SearchInput, SelectFilter, tableStyles } from '@/components/trackngo/cart/CartUi';
import { ServerPagination } from '@/components/trackngo/cart/ServerPagination';
import TabNavigation from '@/components/trackngo/TabNavigation';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import type { Pagination } from '@/lib/cart';
import { formatDateTime } from '@/lib/cart';
import { cn } from '@/lib/utils';

type Entry = {
    audit_id: number;
    user_name: string;
    user_role: string;
    department: string;
    action: string;
    description: string | null;
    document_id: number | null;
    tracking_number: string | null;
    timestamp: string;
    kind: 'workflow' | 'monitoring';
};

type Filters = { search: string; kind: string | null; user: number | null; from: string | null; to: string | null; document: number | null };

type Props = {
    entries: Entry[];
    pagination: Pagination;
    filters: Filters;
    users: { id: number; name: string }[];
    documentFilter: { id: number; tracking_number: string } | null;
};

type Kind = 'all' | 'workflow' | 'monitoring';

export default function CartAuditTrail({ entries, pagination, filters, users, documentFilter }: Props) {
    const [search, setSearch] = useState(filters.search);
    const firstRender = useRef(true);

    const apply = (changes: Partial<Record<keyof Filters, string | number | null>>) => {
        const next = { ...filters, search, ...changes };
        router.get('/cart/audit-trail', Object.fromEntries(Object.entries(next).filter(([, v]) => v !== null && v !== '')), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;

            return;
        }

        const timer = setTimeout(() => apply({ search }), 350);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const hasFilters = Boolean(filters.search || filters.user || filters.from || filters.to || filters.document);

    return (
        <TrackngoLayout role="cart">
            <Head title="Audit Trail" />

            <PageHeader
                title="Audit Trail"
                description="Who received, forwarded, approved or returned each document and when — plus every escalation, follow-up and resolution."
                actions={
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                        <Lock className="h-3.5 w-3.5" />
                        View only
                    </span>
                }
            />

            <div className="space-y-4 pb-10">
                <TabNavigation<Kind>
                    tabs={[
                        { id: 'all', label: 'All activity' },
                        { id: 'workflow', label: 'Workflow actions' },
                        { id: 'monitoring', label: 'Escalation & monitoring' },
                    ]}
                    activeTab={(filters.kind as Kind) ?? 'all'}
                    onChange={(kind) => apply({ kind: kind === 'all' ? null : kind })}
                    ariaLabel="Audit categories"
                />

                <FilterBar
                    activeCount={[filters.user, filters.from || filters.to].filter(Boolean).length}
                    searchClassName="lg:col-span-1"
                    search={<SearchInput value={search} onChange={setSearch} placeholder="Tracking number, action, details…" />}
                >
                    <SelectFilter label="Anyone" value={filters.user ? String(filters.user) : ''} onChange={(value) => apply({ user: value || null })} options={users.map((u) => ({ value: String(u.id), label: u.name }))} />
                    <DateRangeFilter label="Date" from={filters.from ?? ''} to={filters.to ?? ''} onChange={(from, to) => apply({ from: from || null, to: to || null })} />
                </FilterBar>

                <Panel
                    title={`${pagination.total} record${pagination.total === 1 ? '' : 's'}`}
                    aside={
                        <div className="flex flex-wrap items-center gap-2">
                            {documentFilter && (
                                <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--tng-blue-500)]/40 bg-blue-50 pr-1.5 pl-3 text-[13px] font-medium text-[#0066cc]">
                                    Document {documentFilter.tracking_number}
                                    <button type="button" onClick={() => apply({ document: null })} aria-label="Show all documents" className="rounded p-0.5 hover:bg-blue-100">
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </span>
                            )}
                            {hasFilters && (
                                <ResetButton
                                    onClick={() => {
                                        setSearch('');
                                        router.get('/cart/audit-trail', filters.kind ? { kind: filters.kind } : {}, { preserveState: true, replace: true });
                                    }}
                                />
                            )}
                        </div>
                    }
                >
                    {entries.length === 0 ? (
                        <EmptyState icon={History} title="No activity found" message="Try a different date range or clear the filters." />
                    ) : (
                        <>
                            <div className="hidden overflow-x-auto md:block">
                                <table className={tableStyles.table}>
                                    <thead className={tableStyles.head}>
                                        <tr>
                                            <th className={tableStyles.th}>Date & time</th>
                                            <th className={tableStyles.th}>Document</th>
                                            <th className={tableStyles.th}>Action</th>
                                            <th className={tableStyles.th}>Performed by</th>
                                            <th className={tableStyles.th}>Details</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {entries.map((entry) => (
                                            <tr key={entry.audit_id} className={tableStyles.row}>
                                                <td className={cn(tableStyles.td, 'whitespace-nowrap text-slate-600')}>{formatDateTime(entry.timestamp)}</td>
                                                <td className={tableStyles.td}>
                                                    {entry.document_id ? (
                                                        <Link href={`/cart/monitoring/${entry.document_id}`} className="font-medium whitespace-nowrap text-[#0066cc] hover:underline">
                                                            {entry.tracking_number}
                                                        </Link>
                                                    ) : (
                                                        '—'
                                                    )}
                                                </td>
                                                <td className={tableStyles.td}>
                                                    <ActionLabel entry={entry} />
                                                </td>
                                                <td className={cn(tableStyles.td, 'min-w-[160px]')}>
                                                    <p className="text-slate-800">{entry.user_name}</p>
                                                    <p className="text-xs text-slate-500">
                                                        {entry.user_role}
                                                        {entry.department ? ` · ${entry.department}` : ''}
                                                    </p>
                                                </td>
                                                <td className={cn(tableStyles.td, 'min-w-[260px] text-slate-600')}>{entry.description ?? '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <ul className="divide-y divide-slate-100 md:hidden">
                                {entries.map((entry) => (
                                    <li key={entry.audit_id} className="space-y-1 px-4 py-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <ActionLabel entry={entry} />
                                            <time className="text-xs text-slate-500">{formatDateTime(entry.timestamp)}</time>
                                        </div>
                                        <p className="text-xs text-slate-600">
                                            {entry.document_id && (
                                                <Link href={`/cart/monitoring/${entry.document_id}`} className="mr-1.5 font-medium text-[#0066cc]">
                                                    {entry.tracking_number}
                                                </Link>
                                            )}
                                            {entry.user_name} ({entry.user_role})
                                        </p>
                                        {entry.description && <p className="text-xs text-slate-500">{entry.description}</p>}
                                    </li>
                                ))}
                            </ul>

                            <ServerPagination pagination={pagination} itemLabel="records" />
                        </>
                    )}
                </Panel>
            </div>
        </TrackngoLayout>
    );
}

function ActionLabel({ entry }: { entry: Entry }) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
                entry.kind === 'monitoring' ? 'bg-rose-50 text-rose-700 ring-rose-600/15' : 'bg-slate-50 text-slate-700 ring-slate-500/15',
            )}
        >
            {entry.action === 'escalated' ? 'Escalated to CART' : entry.action}
        </span>
    );
}
