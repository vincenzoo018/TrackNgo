import { Head, Link, router } from '@inertiajs/react';
import { Activity, Download, List, RefreshCw } from 'lucide-react';
import { useState, useMemo } from 'react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { cn } from '@/lib/utils';
import type { AuditTrailEntry } from '@/types/trackngo';
import TablePagination from '@/components/trackngo/TablePagination';
import TabNavigation from '@/components/trackngo/TabNavigation';
import { AuditTrailTimeline } from '@/components/trackngo/AuditTrailTimeline';
import { DateRangeSelect, FilterSelect, FilterToolbar } from '@/components/trackngo/ListFilters';
import { downloadCsv } from '@/lib/csv';
import { useLiveUpdates } from '@/hooks/use-live-updates';

type Props = {
    systemLogs?: AuditTrailEntry[];
    actionLogs?: AuditTrailEntry[];
    isFullAccess?: boolean;
    currentRole?: string;
    userRoleName?: string;
    userName?: string;
};

export default function AuditTrailIndex({
    systemLogs = [],
    actionLogs = [],
    isFullAccess = false,
    currentRole = 'receiving',
    userRoleName = 'Staff',
    userName = 'User',
}: Props) {
    type AuditTab = 'all' | 'action' | 'system';
    const [activeTab, setActiveTab] = useState<AuditTab>('all');
    // A compact table by default; the timeline is one click away
    const [viewMode, setViewMode] = useState<'timeline' | 'table'>('table');
    const [searchQuery, setSearchQuery] = useState('');
    const [actionFilter, setActionFilter] = useState('all');
    const [roleFilter, setRoleFilter] = useState('all');
    const [dateRangeFilter, setDateRangeFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Changing the search or a filter goes back to the first page of results
    const filterBy = <T,>(setFilter: (value: T) => void) => (value: T) => {
        setFilter(value);
        setCurrentPage(1);
    };

    // New trail entries anywhere in the system reload the logs (shared 15 s live-update check)
    useLiveUpdates(['trail'], () => {
        router.reload({ only: ['systemLogs', 'actionLogs'] });
    });

    // Active dataset based on selected tab
    const currentDataset = useMemo(() => {
        if (activeTab === 'action') return actionLogs;
        if (activeTab === 'system') return systemLogs;
        return [...actionLogs, ...systemLogs].sort((a, b) => {
            const timeA = new Date(a.timestamp || a.formatted_time || 0).getTime();
            const timeB = new Date(b.timestamp || b.formatted_time || 0).getTime();
            return timeB - timeA;
        });
    }, [activeTab, actionLogs, systemLogs]);

    // Extract unique actions for filtering
    const uniqueActions = useMemo(() => {
        const actions = new Set<string>();
        currentDataset.forEach((item) => {
            if (item.action) actions.add(item.action);
        });
        return Array.from(actions).sort();
    }, [currentDataset]);

    // Extract unique roles for filtering
    const uniqueRoles = useMemo(() => {
        const roles = new Set<string>();
        currentDataset.forEach((item) => {
            if (item.user_role) roles.add(item.user_role);
        });
        return Array.from(roles).sort();
    }, [currentDataset]);

    // Filter dataset
    const filteredLogs = useMemo(() => {
        return currentDataset.filter((item) => {
            // Search query filter
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchName = (item.user_name || item.user || '').toLowerCase().includes(q);
                const matchAction = (item.action || '').toLowerCase().includes(q);
                const matchRef = (item.document_ref || '').toLowerCase().includes(q);
                const matchDesc = (item.description || '').toLowerCase().includes(q);
                const matchIp = (item.ip_address || '').toLowerCase().includes(q);
                const matchRole = (item.user_role || '').toLowerCase().includes(q);
                const matchDept = (item.department || '').toLowerCase().includes(q);

                if (!matchName && !matchAction && !matchRef && !matchDesc && !matchIp && !matchRole && !matchDept) {
                    return false;
                }
            }

            // Action filter
            if (actionFilter !== 'all' && item.action !== actionFilter) {
                return false;
            }

            // Role filter
            if (roleFilter !== 'all' && item.user_role !== roleFilter) {
                return false;
            }

            // Date filter
            if (dateRangeFilter !== 'all' && item.timestamp) {
                const logTime = new Date(item.timestamp).getTime();
                const now = Date.now();
                const diffHours = (now - logTime) / (1000 * 60 * 60);

                if (dateRangeFilter === 'today' && diffHours > 24) return false;
                if (dateRangeFilter === '7days' && diffHours > 24 * 7) return false;
                if (dateRangeFilter === '30days' && diffHours > 24 * 30) return false;
            }

            return true;
        });
    }, [currentDataset, searchQuery, actionFilter, roleFilter, dateRangeFilter]);

    // Pagination calculations
    const totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;
    const paginatedLogs = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredLogs.slice(start, start + pageSize);
    }, [filteredLogs, currentPage, pageSize]);

    // Reset pagination on filter or tab change
    const handleTabChange = (tab: AuditTab) => {
        setActiveTab(tab);
        setCurrentPage(1);
        setActionFilter('all');
        setRoleFilter('all');
    };

    const handleRefresh = () => {
        setIsRefreshing(true);
        router.reload({
            only: ['systemLogs', 'actionLogs'],
            onFinish: () => setIsRefreshing(false),
        });
    };

    // Export current filtered view to CSV
    const handleExportCsv = () => {
        if (filteredLogs.length === 0) return;

        const headers = [
            'Audit ID',
            'Category',
            'Timestamp',
            'Action Type',
            'User Name',
            'Role',
            'Department',
            'Document Reference',
            'Description',
            'IP Address',
        ];

        const rows = filteredLogs.map((log) => [
            `"${log.audit_id || log.id || ''}"`,
            `"${log.category || activeTab}"`,
            `"${log.formatted_time || log.timestamp || ''}"`,
            `"${(log.action || '').replace(/"/g, '""')}"`,
            `"${(log.user_name || log.user || '').replace(/"/g, '""')}"`,
            `"${(log.user_role || '').replace(/"/g, '""')}"`,
            `"${(log.department || '').replace(/"/g, '""')}"`,
            `"${log.document_ref || 'N/A'}"`,
            `"${(log.description || '').replace(/"/g, '""')}"`,
            `"${log.ip_address || ''}"`,
        ]);

        downloadCsv(`trackngo_audit_trail_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    };


    // Colour of an action's chip (green: approved / completed, red: escalations and failures, ...)
    const actionChipClass = (action: string) => {
        const a = (action || '').toLowerCase();
        if (a.includes('approve') || a.includes('complete')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        if (a.includes('escalat') || a.includes('fail') || a.includes('deadline') || a.includes('alert')) return 'bg-rose-50 text-rose-700 border-rose-200';
        if (a.includes('return')) return 'bg-amber-50 text-amber-700 border-amber-200';
        if (a.includes('login') || a.includes('logout') || a.includes('auth') || a.includes('session')) return 'bg-blue-50 text-blue-700 border-blue-200';
        return 'bg-slate-50 text-slate-700 border-slate-200';
    };

    return (
        <TrackngoLayout role={currentRole}>
            <Head title="Audit Trail" />

            <div className="space-y-5 pb-12">
                {/* ── Header ── */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-[20px] font-bold tracking-tight text-[var(--tng-slate-900)]">Audit Trail</h1>
                        <p className="mt-0.5 text-sm text-[var(--tng-slate-500)]">Document actions and sign-ins</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                        <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            title="Refresh"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50 disabled:opacity-50"
                        >
                            <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
                            Refresh
                        </button>
                        <button
                            type="button"
                            onClick={handleExportCsv}
                            disabled={filteredLogs.length === 0}
                            className="inline-flex items-center gap-2 rounded-lg bg-[#0066cc] px-4 py-2 text-[14px] font-medium text-white shadow-xs transition-all hover:bg-[#005bb5] hover:shadow-sm disabled:opacity-50"
                        >
                            <Download className="h-4 w-4 shrink-0 text-white" />
                            Export CSV
                        </button>
                    </div>
                </div>

                {/* ── Tabs (their counts replace the old stat cards) and the view toggle ── */}
                <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-end">
                    <TabNavigation
                        tabs={[
                            { id: 'all', label: 'All', count: actionLogs.length + systemLogs.length },
                            { id: 'action', label: 'Document actions', count: actionLogs.length },
                            { id: 'system', label: 'Sign-ins & security', count: systemLogs.length },
                        ]}
                        activeTab={activeTab}
                        onChange={handleTabChange}
                        className="sm:max-w-2xl"
                    />

                    <div className="flex shrink-0 items-center self-start rounded-lg border border-slate-200 bg-white p-1 shadow-2xs sm:self-auto">
                        {([['table', 'Table', List], ['timeline', 'Timeline', Activity]] as const).map(([mode, label, Icon]) => (
                            <button
                                key={mode}
                                type="button"
                                onClick={() => setViewMode(mode)}
                                className={cn(
                                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all',
                                    viewMode === mode ? 'bg-[#0066cc] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                                )}
                            >
                                <Icon className="h-3.5 w-3.5" />
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Filters & Search Toolbar ── */}
                <FilterToolbar
                    search={searchQuery}
                    onSearchChange={filterBy(setSearchQuery)}
                    onSearchClear={() => setSearchQuery('')}
                    searchPlaceholder="Search reference, name, action or details"
                    filterTags={[
                        { active: actionFilter !== 'all', label: <>Action: {actionFilter}</> },
                        { active: roleFilter !== 'all', label: <>Role: {roleFilter}</> },
                        { active: dateRangeFilter !== 'all', label: <>Range: {dateRangeFilter}</> },
                    ]}
                    onResetFilters={() => {
                        setSearchQuery('');
                        setActionFilter('all');
                        setRoleFilter('all');
                        setDateRangeFilter('all');
                    }}
                >
                    <FilterSelect value={actionFilter} onChange={filterBy(setActionFilter)} withIcon>
                        <option value="all">All Actions</option>
                        {uniqueActions.map((act) => (
                            <option key={act} value={act}>
                                {act}
                            </option>
                        ))}
                    </FilterSelect>

                    {uniqueRoles.length > 1 && (
                        <FilterSelect value={roleFilter} onChange={filterBy(setRoleFilter)}>
                            <option value="all">All Roles</option>
                            {uniqueRoles.map((role) => (
                                <option key={role} value={role}>
                                    {role}
                                </option>
                            ))}
                        </FilterSelect>
                    )}

                    <DateRangeSelect value={dateRangeFilter} onChange={filterBy(setDateRangeFilter)} />
                </FilterToolbar>

                {/* ── Table (default) or timeline ── */}
                <div className="overflow-hidden rounded-xl border border-[var(--tng-slate-200)] bg-white shadow-xs">
                    {viewMode === 'timeline' ? (
                        <div className="p-6">
                            <AuditTrailTimeline entries={paginatedLogs as any} />
                        </div>
                    ) : (
                        <div className="w-full overflow-x-auto">
                            <table className="w-full border-collapse text-left text-[13px] text-[var(--tng-slate-700)]">
                                <thead className="border-b border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)]">
                                    <tr className="text-[13px] text-slate-600">
                                        <th className="whitespace-nowrap px-4 py-3 font-normal">Date &amp; time</th>
                                        <th className="whitespace-nowrap px-4 py-3 font-normal">Document</th>
                                        <th className="whitespace-nowrap px-4 py-3 font-normal">Action</th>
                                        <th className="whitespace-nowrap px-4 py-3 font-normal">By</th>
                                        <th className="px-4 py-3 font-normal">Details</th>
                                        <th className="whitespace-nowrap px-4 py-3 font-normal">IP address</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--tng-slate-100)]">
                                    {paginatedLogs.length > 0 ? (
                                        paginatedLogs.map((log, idx) => {
                                            const docUrl = log.document_id ? `/${currentRole}/documents/${log.document_id}` : null;

                                            return (
                                                <tr key={log.audit_id || log.id || idx} className="align-top transition-colors hover:bg-blue-50/40">
                                                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{log.formatted_time || log.timestamp}</td>
                                                    <td className="whitespace-nowrap px-4 py-3">
                                                        {log.document_ref ? (
                                                            docUrl ? (
                                                                <Link href={docUrl} className="font-mono text-[#0066cc] hover:underline">{log.document_ref}</Link>
                                                            ) : (
                                                                <span className="font-mono text-slate-700">{log.document_ref}</span>
                                                            )
                                                        ) : (
                                                            <span className="text-slate-400">—</span>
                                                        )}
                                                    </td>
                                                    <td className="whitespace-nowrap px-4 py-3">
                                                        <span className={cn('inline-flex rounded border px-1.5 py-0.5 text-[12px] font-medium', actionChipClass(log.action))}>
                                                            {log.action}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="whitespace-nowrap text-slate-900">{log.user_name || log.user || 'System'}</div>
                                                        {/* One line: the office is shown in full on hover */}
                                                        <div className="max-w-[220px] truncate text-[12px] text-slate-500" title={[log.user_role, log.department].filter(Boolean).join(' · ')}>
                                                            {[log.user_role, log.department].filter(Boolean).join(' · ')}
                                                        </div>
                                                    </td>
                                                    <td className="max-w-md px-4 py-3">
                                                        <p className="line-clamp-2">{log.description}</p>
                                                    </td>
                                                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[12px] text-slate-500">{log.ip_address || '—'}</td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-sm text-[var(--tng-slate-500)]">
                                                {searchQuery || actionFilter !== 'all' || roleFilter !== 'all' || dateRangeFilter !== 'all'
                                                    ? 'No records match your filters.'
                                                    : 'No records yet.'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <TablePagination
                        currentPage={currentPage}
                        pageSize={pageSize}
                        totalItems={filteredLogs.length}
                        onPageChange={setCurrentPage}
                        onPageSizeChange={setPageSize}
                        itemLabel="records"
                    />
                </div>
            </div>
        </TrackngoLayout>
    );
}
