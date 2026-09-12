import { Head, Link, router } from '@inertiajs/react';
import {
    Activity,
    Search,
    Download,
    Shield,
    ShieldCheck,
    Lock,
    KeyRound,
    User,
    Calendar,
    Filter,
    RefreshCw,
    ExternalLink,
    Clock,
    FileText,
    CheckCircle2,
    LogOut,
    PlusCircle,
    ArrowRightCircle,
    RotateCcw,
    AlertTriangle,
    Server,
    Globe,
    ChevronLeft,
    ChevronRight,
    Sparkles,
} from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { cn } from '@/lib/utils';
import type { AuditTrailEntry } from '@/types/trackngo';

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
    const [activeTab, setActiveTab] = useState<'action' | 'system'>('action');
    const [searchQuery, setSearchQuery] = useState('');
    const [actionFilter, setActionFilter] = useState('all');
    const [roleFilter, setRoleFilter] = useState('all');
    const [dateRangeFilter, setDateRangeFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [liveSyncEnabled, setLiveSyncEnabled] = useState(true);
    const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

    // Live background polling every 4 seconds for real-time audit updates
    useEffect(() => {
        if (!liveSyncEnabled) return;

        const interval = setInterval(() => {
            router.reload({
                only: ['systemLogs', 'actionLogs'],
                preserveState: true,
                preserveScroll: true,
                onSuccess: () => {
                    setLastSyncTime(new Date());
                },
            });
        }, 4000);

        return () => clearInterval(interval);
    }, [liveSyncEnabled]);

    // Active dataset based on selected tab
    const currentDataset = activeTab === 'action' ? actionLogs : systemLogs;

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
    const handleTabChange = (tab: 'action' | 'system') => {
        setActiveTab(tab);
        setCurrentPage(1);
        setActionFilter('all');
        setRoleFilter('all');
    };

    const handleRefresh = () => {
        setIsRefreshing(true);
        router.reload({
            only: ['systemLogs', 'actionLogs'],
            onFinish: () => {
                setIsRefreshing(false);
                setLastSyncTime(new Date());
            },
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

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute(
            'download',
            `trackngo_audit_trail_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`
        );
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Action Badge Visual Helper
    const getActionBadge = (action: string) => {
        const a = (action || '').toLowerCase();
        if (a.includes('approve') || a.includes('complete')) {
            return {
                bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                icon: CheckCircle2,
            };
        }
        if (a.includes('login') || a.includes('auth') || a.includes('sign in')) {
            return {
                bg: 'bg-blue-50 text-blue-700 border-blue-200',
                icon: ShieldCheck,
            };
        }
        if (a.includes('logout') || a.includes('session')) {
            return {
                bg: 'bg-slate-100 text-slate-700 border-slate-300',
                icon: LogOut,
            };
        }
        if (a.includes('register') || a.includes('create')) {
            return {
                bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                icon: PlusCircle,
            };
        }
        if (a.includes('endorse') || a.includes('forward') || a.includes('route')) {
            return {
                bg: 'bg-cyan-50 text-cyan-700 border-cyan-200',
                icon: ArrowRightCircle,
            };
        }
        if (a.includes('return')) {
            return {
                bg: 'bg-amber-50 text-amber-700 border-amber-200',
                icon: RotateCcw,
            };
        }
        if (a.includes('escalate') || a.includes('fail') || a.includes('alert')) {
            return {
                bg: 'bg-rose-50 text-rose-700 border-rose-200',
                icon: AlertTriangle,
            };
        }
        if (a.includes('export') || a.includes('download')) {
            return {
                bg: 'bg-violet-50 text-violet-700 border-violet-200',
                icon: Download,
            };
        }
        return {
            bg: 'bg-slate-50 text-slate-700 border-slate-200',
            icon: Activity,
        };
    };

    // Role Badge Helper
    const getRoleBadgeClass = (role: string) => {
        const r = (role || '').toLowerCase();
        if (r.includes('admin')) return 'bg-purple-100 text-purple-800 border-purple-200';
        if (r.includes('cart')) return 'bg-rose-100 text-rose-800 border-rose-200';
        if (r.includes('mayor')) return 'bg-amber-100 text-amber-800 border-amber-200';
        if (r.includes('head') || r.includes('department')) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
        if (r.includes('hr')) return 'bg-teal-100 text-teal-800 border-teal-200';
        if (r.includes('receiving') || r.includes('clerk')) return 'bg-blue-100 text-blue-800 border-blue-200';
        return 'bg-slate-100 text-slate-700 border-slate-200';
    };

    return (
        <TrackngoLayout role={currentRole}>
            <Head title="Audit Trail" />

            <div className="space-y-6 pb-12">
                {/* ── Header Section ────────────────────────────────────────── */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[var(--tng-slate-200)] pb-5">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm">
                                <Activity className="h-6 w-6" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight text-[var(--tng-slate-900)]">
                                    Audit Trail
                                </h1>
                                <p className="text-sm text-[var(--tng-slate-500)] mt-0.5">
                                    Immutable, real-time audit log of workflow actions and authentication activities
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Right side controls */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[var(--tng-slate-700)] bg-white border border-[var(--tng-slate-300)] rounded-lg hover:bg-[var(--tng-slate-50)] transition-colors shadow-sm disabled:opacity-50"
                        >
                            <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
                            Refresh
                        </button>
                        <button
                            type="button"
                            onClick={handleExportCsv}
                            disabled={filteredLogs.length === 0}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-white bg-[var(--tng-blue-600)] hover:bg-[var(--tng-blue-700)] rounded-lg transition-colors shadow-sm disabled:opacity-50"
                        >
                            <Download className="h-4 w-4" />
                            Export CSV ({filteredLogs.length})
                        </button>
                    </div>
                </div>

                {/* ── Visibility Banner ──────────────────────────────────────── */}
                <div
                    className={cn(
                        'flex items-center justify-between gap-4 p-4 rounded-xl border text-sm',
                        isFullAccess
                            ? 'bg-purple-50/70 border-purple-200 text-purple-900'
                            : 'bg-blue-50/70 border-blue-200 text-blue-900'
                    )}
                >
                    <div className="flex items-center gap-3">
                        {isFullAccess ? (
                            <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
                                <ShieldCheck className="h-5 w-5" />
                            </div>
                        ) : (
                            <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                                <Shield className="h-5 w-5" />
                            </div>
                        )}
                        <div>
                            <span className="font-semibold">
                                {isFullAccess
                                    ? 'Global Audit Privilege'
                                    : 'Role-Scoped Audit View'}
                            </span>
                            <p className="text-xs opacity-90 mt-0.5">
                                {isFullAccess
                                    ? `As ${userRoleName}, you have full oversight across all users, departments, and operations.`
                                    : `Viewing activity records for ${userName} (${userRoleName}) and related documents assigned to your department.`}
                            </p>
                        </div>
                    </div>
                    <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-white/80 border border-current/20 shadow-2xs">
                        {isFullAccess ? 'Full System View' : 'Personal & Departmental'}
                    </span>
                </div>

                {/* ── Category Tabs & Counter Cards ─────────────────────────── */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                    {/* Tabs */}
                    <div className="flex bg-[var(--tng-slate-100)] p-1 rounded-xl border border-[var(--tng-slate-200)] max-w-md w-full">
                        <button
                            type="button"
                            onClick={() => handleTabChange('action')}
                            className={cn(
                                'flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-semibold transition-all',
                                activeTab === 'action'
                                    ? 'bg-white text-[var(--tng-slate-900)] shadow-xs'
                                    : 'text-[var(--tng-slate-600)] hover:text-[var(--tng-slate-900)]'
                            )}
                        >
                            <FileText className="h-4 w-4 text-[var(--tng-blue-600)]" />
                            Action Trail
                            <span
                                className={cn(
                                    'px-2 py-0.5 text-xs rounded-full font-bold',
                                    activeTab === 'action'
                                        ? 'bg-[var(--tng-blue-50)] text-[var(--tng-blue-700)]'
                                        : 'bg-[var(--tng-slate-200)] text-[var(--tng-slate-600)]'
                                )}
                            >
                                {actionLogs.length}
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleTabChange('system')}
                            className={cn(
                                'flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-semibold transition-all',
                                activeTab === 'system'
                                    ? 'bg-white text-[var(--tng-slate-900)] shadow-xs'
                                    : 'text-[var(--tng-slate-600)] hover:text-[var(--tng-slate-900)]'
                            )}
                        >
                            <Lock className="h-4 w-4 text-purple-600" />
                            System Trail
                            <span
                                className={cn(
                                    'px-2 py-0.5 text-xs rounded-full font-bold',
                                    activeTab === 'system'
                                        ? 'bg-purple-50 text-purple-700'
                                        : 'bg-[var(--tng-slate-200)] text-[var(--tng-slate-600)]'
                                )}
                            >
                                {systemLogs.length}
                            </span>
                        </button>
                    </div>

                    <div className="flex items-center gap-2 self-center sm:self-auto bg-white px-3 py-1.5 rounded-lg border border-[var(--tng-slate-200)] shadow-2xs">
                        <span className="flex h-2 w-2 relative">
                            <span className={cn(
                                "absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75",
                                liveSyncEnabled && "animate-ping"
                            )}></span>
                            <span className={cn(
                                "relative inline-flex rounded-full h-2 w-2",
                                liveSyncEnabled ? "bg-emerald-500" : "bg-slate-400"
                            )}></span>
                        </span>
                        <span className="text-xs font-semibold text-emerald-700">
                            {liveSyncEnabled ? 'Live Feed Active' : 'Live Feed Paused'}
                        </span>
                        <span className="text-[10px] text-[var(--tng-slate-400)]">
                            (synced {lastSyncTime.toLocaleTimeString()})
                        </span>
                    </div>
                </div>

                {/* ── Filters & Search Toolbar ──────────────────────────────── */}
                <div className="bg-white rounded-xl border border-[var(--tng-slate-200)] p-4 shadow-xs space-y-3">
                    <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
                        {/* Search Input */}
                        <div className="relative flex-1">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--tng-slate-400)]" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1);
                                }}
                                placeholder={
                                    activeTab === 'action'
                                        ? 'Search by document ref, user, action, description, or IP...'
                                        : 'Search by user, auth event, IP address, or session detail...'
                                }
                                className="w-full pl-10 pr-4 py-2 bg-[var(--tng-slate-50)] border border-[var(--tng-slate-200)] rounded-lg text-sm text-[var(--tng-slate-900)] placeholder-[var(--tng-slate-400)] focus:bg-white focus:border-[var(--tng-blue-600)] focus:ring-1 focus:ring-[var(--tng-blue-600)] transition-all outline-none"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--tng-slate-400)] hover:text-[var(--tng-slate-600)]"
                                >
                                    Clear
                                </button>
                            )}
                        </div>

                        {/* Dropdown Filters */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Action Type Filter */}
                            <div className="flex items-center gap-1.5">
                                <Filter className="h-3.5 w-3.5 text-[var(--tng-slate-400)]" />
                                <select
                                    value={actionFilter}
                                    onChange={(e) => {
                                        setActionFilter(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="bg-white border border-[var(--tng-slate-200)] rounded-lg text-xs font-medium text-[var(--tng-slate-700)] py-2 px-3 focus:border-[var(--tng-blue-600)] focus:ring-1 focus:ring-[var(--tng-blue-600)] outline-none"
                                >
                                    <option value="all">All Actions</option>
                                    {uniqueActions.map((act) => (
                                        <option key={act} value={act}>
                                            {act}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Role Filter */}
                            {uniqueRoles.length > 1 && (
                                <select
                                    value={roleFilter}
                                    onChange={(e) => {
                                        setRoleFilter(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="bg-white border border-[var(--tng-slate-200)] rounded-lg text-xs font-medium text-[var(--tng-slate-700)] py-2 px-3 focus:border-[var(--tng-blue-600)] focus:ring-1 focus:ring-[var(--tng-blue-600)] outline-none"
                                >
                                    <option value="all">All Roles</option>
                                    {uniqueRoles.map((role) => (
                                        <option key={role} value={role}>
                                            {role}
                                        </option>
                                    ))}
                                </select>
                            )}

                            {/* Date Filter */}
                            <select
                                value={dateRangeFilter}
                                onChange={(e) => {
                                    setDateRangeFilter(e.target.value as any);
                                    setCurrentPage(1);
                                }}
                                className="bg-white border border-[var(--tng-slate-200)] rounded-lg text-xs font-medium text-[var(--tng-slate-700)] py-2 px-3 focus:border-[var(--tng-blue-600)] focus:ring-1 focus:ring-[var(--tng-blue-600)] outline-none"
                            >
                                <option value="all">All Time</option>
                                <option value="today">Past 24 Hours</option>
                                <option value="7days">Past 7 Days</option>
                                <option value="30days">Past 30 Days</option>
                            </select>
                        </div>
                    </div>

                    {/* Filter Summary pills */}
                    {(searchQuery || actionFilter !== 'all' || roleFilter !== 'all' || dateRangeFilter !== 'all') && (
                        <div className="flex items-center gap-2 pt-2 border-t border-[var(--tng-slate-100)] text-xs text-[var(--tng-slate-500)] flex-wrap">
                            <span>Active Filters:</span>
                            {searchQuery && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-[var(--tng-slate-100)] text-[var(--tng-slate-700)]">
                                    Keyword: "{searchQuery}"
                                </span>
                            )}
                            {actionFilter !== 'all' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-[var(--tng-slate-100)] text-[var(--tng-slate-700)]">
                                    Action: {actionFilter}
                                </span>
                            )}
                            {roleFilter !== 'all' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-[var(--tng-slate-100)] text-[var(--tng-slate-700)]">
                                    Role: {roleFilter}
                                </span>
                            )}
                            {dateRangeFilter !== 'all' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-[var(--tng-slate-100)] text-[var(--tng-slate-700)]">
                                    Range: {dateRangeFilter}
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchQuery('');
                                    setActionFilter('all');
                                    setRoleFilter('all');
                                    setDateRangeFilter('all');
                                }}
                                className="text-[var(--tng-blue-600)] hover:underline ml-1 font-medium"
                            >
                                Reset all
                            </button>
                        </div>
                    )}
                </div>

                {/* ── Table Section ─────────────────────────────────────────── */}
                <div className="bg-white rounded-xl border border-[var(--tng-slate-200)] shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-[var(--tng-slate-600)]">
                            <thead className="bg-[var(--tng-slate-50)] text-[var(--tng-slate-500)] border-b border-[var(--tng-slate-200)] text-xs uppercase tracking-wider font-semibold">
                                <tr>
                                    <th className="px-5 py-3.5 whitespace-nowrap">Timestamp</th>
                                    <th className="px-5 py-3.5 whitespace-nowrap">Action Type</th>
                                    <th className="px-5 py-3.5 whitespace-nowrap">User Name</th>
                                    <th className="px-5 py-3.5 whitespace-nowrap">Role & Dept</th>
                                    {activeTab === 'action' && (
                                        <th className="px-5 py-3.5 whitespace-nowrap">Document Ref</th>
                                    )}
                                    <th className="px-5 py-3.5">Description</th>
                                    <th className="px-5 py-3.5 text-right whitespace-nowrap">IP Address</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--tng-slate-200)]">
                                {paginatedLogs.length > 0 ? (
                                    paginatedLogs.map((log, idx) => {
                                        const actionBadge = getActionBadge(log.action);
                                        const ActionIcon = actionBadge.icon;
                                        const docUrl = log.document_id
                                            ? `/${currentRole}/documents/${log.document_id}`
                                            : null;

                                        return (
                                            <tr
                                                key={log.audit_id || log.id || idx}
                                                className="hover:bg-[var(--tng-slate-50)]/70 transition-colors"
                                            >
                                                {/* Timestamp */}
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <div className="text-xs font-semibold text-[var(--tng-slate-900)]">
                                                        {log.formatted_time || log.timestamp}
                                                    </div>
                                                    <div className="text-[11px] text-[var(--tng-slate-400)]">
                                                        ID #{log.audit_id || log.id || '-'}
                                                    </div>
                                                </td>

                                                {/* Action Type */}
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <span
                                                        className={cn(
                                                            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border',
                                                            actionBadge.bg
                                                        )}
                                                    >
                                                        <ActionIcon className="h-3.5 w-3.5" />
                                                        {log.action}
                                                    </span>
                                                </td>

                                                {/* User Name */}
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-7 w-7 rounded-full bg-[var(--tng-slate-100)] border border-[var(--tng-slate-300)] flex items-center justify-center text-xs font-bold text-[var(--tng-slate-700)]">
                                                            {(log.user_name || log.user || 'U').charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-xs text-[var(--tng-slate-900)]">
                                                                {log.user_name || log.user || 'System'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Role & Dept */}
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <div className="space-y-1">
                                                        <span
                                                            className={cn(
                                                                'inline-block px-2 py-0.5 rounded text-[11px] font-semibold border',
                                                                getRoleBadgeClass(log.user_role)
                                                            )}
                                                        >
                                                            {log.user_role || 'Staff'}
                                                        </span>
                                                        {log.department && (
                                                            <div className="text-[11px] text-[var(--tng-slate-400)] truncate max-w-[140px]">
                                                                {log.department}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Document Ref (only for Action Trail) */}
                                                {activeTab === 'action' && (
                                                    <td className="px-5 py-4 whitespace-nowrap">
                                                        {log.document_ref ? (
                                                            docUrl ? (
                                                                <Link
                                                                    href={docUrl}
                                                                    className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-[var(--tng-blue-600)] hover:text-[var(--tng-blue-800)] hover:underline bg-[var(--tng-blue-50)] px-2 py-1 rounded border border-[var(--tng-blue-100)]"
                                                                >
                                                                    {log.document_ref}
                                                                    <ExternalLink className="h-3 w-3" />
                                                                </Link>
                                                            ) : (
                                                                <span className="font-mono text-xs font-medium text-[var(--tng-slate-700)] bg-[var(--tng-slate-100)] px-2 py-1 rounded">
                                                                    {log.document_ref}
                                                                </span>
                                                            )
                                                        ) : (
                                                            <span className="text-xs text-[var(--tng-slate-400)] italic">
                                                                General
                                                            </span>
                                                        )}
                                                    </td>
                                                )}

                                                {/* Description */}
                                                <td className="px-5 py-4 text-xs text-[var(--tng-slate-700)] max-w-sm">
                                                    <p className="line-clamp-2">{log.description}</p>
                                                </td>

                                                {/* IP Address */}
                                                <td className="px-5 py-4 whitespace-nowrap text-right">
                                                    <span className="inline-flex items-center gap-1 font-mono text-xs text-[var(--tng-slate-600)] bg-[var(--tng-slate-100)] px-2 py-1 rounded border border-[var(--tng-slate-200)]">
                                                        <Globe className="h-3 w-3 text-[var(--tng-slate-400)]" />
                                                        {log.ip_address || '127.0.0.1'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td
                                            colSpan={activeTab === 'action' ? 7 : 6}
                                            className="px-6 py-12 text-center"
                                        >
                                            <div className="flex flex-col items-center justify-center space-y-2">
                                                <div className="p-3 rounded-full bg-[var(--tng-slate-100)] text-[var(--tng-slate-400)]">
                                                    <Activity className="h-6 w-6" />
                                                </div>
                                                <div className="text-sm font-semibold text-[var(--tng-slate-700)]">
                                                    No audit trail events found
                                                </div>
                                                <p className="text-xs text-[var(--tng-slate-400)] max-w-sm">
                                                    {searchQuery || actionFilter !== 'all' || roleFilter !== 'all'
                                                        ? 'Try clearing your filters or search query to view all available records.'
                                                        : `No ${activeTab === 'action' ? 'workflow action' : 'system session'} logs have been recorded for your current role scope.`}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* ── Pagination Footer ─────────────────────────────────── */}
                    <div className="px-5 py-3.5 bg-[var(--tng-slate-50)] border-t border-[var(--tng-slate-200)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--tng-slate-500)]">
                        <div className="flex items-center gap-4">
                            <div>
                                Showing{' '}
                                <span className="font-semibold text-[var(--tng-slate-900)]">
                                    {filteredLogs.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                                </span>{' '}
                                to{' '}
                                <span className="font-semibold text-[var(--tng-slate-900)]">
                                    {Math.min(currentPage * pageSize, filteredLogs.length)}
                                </span>{' '}
                                of{' '}
                                <span className="font-semibold text-[var(--tng-slate-900)]">
                                    {filteredLogs.length}
                                </span>{' '}
                                records
                            </div>

                            <div className="flex items-center gap-1.5 border-l border-[var(--tng-slate-200)] pl-4">
                                <span className="text-[11px] text-[var(--tng-slate-500)]">Per page:</span>
                                <select
                                    value={pageSize}
                                    onChange={(e) => {
                                        setPageSize(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                    className="rounded-md border border-[var(--tng-slate-300)] bg-white px-2 py-1 text-xs font-semibold text-[var(--tng-slate-700)] shadow-2xs focus:border-[var(--tng-blue-500)] focus:outline-none"
                                >
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--tng-slate-300)] bg-white text-xs font-medium text-[var(--tng-slate-700)] hover:bg-[var(--tng-slate-50)] disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                                Previous
                            </button>

                            <span className="px-2 text-xs font-medium text-[var(--tng-slate-600)]">
                                Page {currentPage} of {totalPages}
                            </span>

                            <button
                                type="button"
                                disabled={currentPage >= totalPages}
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--tng-slate-300)] bg-white text-xs font-medium text-[var(--tng-slate-700)] hover:bg-[var(--tng-slate-50)] disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                            >
                                Next
                                <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </TrackngoLayout>
    );
}
