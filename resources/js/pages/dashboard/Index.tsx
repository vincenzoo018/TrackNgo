import { useState, useMemo } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { StatCard } from '@/components/trackngo/StatCard';
import {
    FileText,
    CheckCircle2,
    Clock,
    RotateCcw,
    AlertTriangle,
    ShieldCheck,
    UserCheck,
    Building2,
    TrendingUp,
    BarChart3,
    PieChart as PieChartIcon,
    ArrowUpRight,
    ChevronDown,
    Filter,
    Activity,
} from 'lucide-react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    ArcElement,
    Title,
    Tooltip as ChartTooltip,
    Legend as ChartLegend,
    Filler,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

// Register required Chart.js modules
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    ArcElement,
    Title,
    ChartTooltip,
    ChartLegend,
    Filler
);

export interface KpiMetrics {
    totalDocuments: number;
    completedDocuments: number;
    inProgressDocuments: number;
    returnedDocuments: number;
    slaViolations: number;
    nearDeadline: number;
    slaComplianceRate: number;
}

export interface KpiLinks {
    total: string;
    completed: string;
    inProgress: string;
    returned: string;
    slaViolations: string;
}

export interface BottleneckItem {
    stage: string;
    count: number;
    avgDays: number;
    sla: number;
}

export interface StatusDistributionItem {
    label: string;
    value: number;
    count: number;
    color: string;
}

export interface VolumeTrendItem {
    day: string;
    volume: number;
}

export interface DepartmentOption {
    id: number;
    name: string;
    code: string;
}

export interface DashboardProps {
    kpiMetrics?: KpiMetrics;
    kpiLinks?: KpiLinks;
    bottlenecks?: BottleneckItem[];
    statusDistribution?: StatusDistributionItem[];
    volumeTrends?: VolumeTrendItem[];
    liveTransactions?: any[];
    isFullAccess?: boolean;
    currentRole?: string;
    userRoleName?: string;
    userName?: string;
    userDepartment?: string;
    filters?: {
        range: string;
        department: string;
    };
    departments?: DepartmentOption[];
}

export default function UnifiedDashboard({
    kpiMetrics = {
        totalDocuments: 0,
        completedDocuments: 0,
        inProgressDocuments: 0,
        returnedDocuments: 0,
        slaViolations: 0,
        nearDeadline: 0,
        slaComplianceRate: 100,
    },
    kpiLinks = {
        total: '/admin/documents',
        completed: '/admin/archived',
        inProgress: '/admin/documents',
        returned: '/admin/documents',
        slaViolations: '/admin/audit-trail',
    },
    bottlenecks = [],
    statusDistribution = [],
    volumeTrends = [],
    isFullAccess = false,
    currentRole = 'admin',
    userRoleName = 'User',
    userName = 'User',
    userDepartment = 'LGU Mati',
    filters = { range: 'all', department: 'all' },
    departments = [],
}: DashboardProps) {
    const [selectedRange, setSelectedRange] = useState(filters.range || 'all');
    const [selectedDept, setSelectedDept] = useState(filters.department || 'all');

    // Handle filter application
    const applyFilters = (newRange: string, newDept: string) => {
        setSelectedRange(newRange);
        setSelectedDept(newDept);
        router.get(
            window.location.pathname,
            { range: newRange, department: newDept },
            { preserveState: true, preserveScroll: true }
        );
    };

    // Calculate total weekly volume & peak day
    const { totalWeeklyVolume, peakDay } = useMemo(() => {
        const total = volumeTrends.reduce((sum, item) => sum + item.volume, 0);
        let peak = { day: 'N/A', volume: 0 };
        volumeTrends.forEach((item) => {
            if (item.volume > peak.volume) {
                peak = item;
            }
        });
        return { totalWeeklyVolume: total, peakDay: peak };
    }, [volumeTrends]);

    // ── 1. Department Bottlenecks (Chart.js Bar Graph) ──────────────────────
    const safeBottlenecks = useMemo(() => {
        if (bottlenecks && bottlenecks.length > 0) {
            return bottlenecks;
        }
        return [
            { stage: 'OCM', avgDays: 2.1, sla: 3.0, count: 0 },
            { stage: 'OCA', avgDays: 2.8, sla: 3.0, count: 0 },
            { stage: 'CEO', avgDays: 4.5, sla: 5.0, count: 0 },
            { stage: 'CBO', avgDays: 3.2, sla: 4.0, count: 0 },
            { stage: 'CHRMO', avgDays: 1.9, sla: 3.0, count: 0 },
        ];
    }, [bottlenecks]);

    const barChartData = useMemo(() => {
        return {
            labels: safeBottlenecks.map((b) => b.stage),
            datasets: [
                {
                    label: 'Avg Turnaround (Days)',
                    data: safeBottlenecks.map((b) => b.avgDays),
                    backgroundColor: '#3b82f6',
                    hoverBackgroundColor: '#2563eb',
                    borderRadius: 4,
                    barPercentage: 0.65,
                    categoryPercentage: 0.75,
                },
                {
                    label: 'SLA Threshold (Days)',
                    data: safeBottlenecks.map((b) => b.sla),
                    backgroundColor: '#cbd5e1',
                    hoverBackgroundColor: '#94a3b8',
                    borderRadius: 4,
                    barPercentage: 0.65,
                    categoryPercentage: 0.75,
                },
            ],
        };
    }, [safeBottlenecks]);

    const barChartOptions = useMemo<any>(() => {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    align: 'end',
                    labels: {
                        boxWidth: 12,
                        boxHeight: 12,
                        useBorderRadius: true,
                        borderRadius: 3,
                        font: { size: 11, family: 'Inter, system-ui, sans-serif' },
                        color: '#64748b',
                        padding: 12,
                    },
                },
                tooltip: {
                    backgroundColor: '#0f172a',
                    titleFont: { size: 12, weight: 'bold' },
                    bodyFont: { size: 11 },
                    padding: 10,
                    cornerRadius: 8,
                    callbacks: {
                        label: function (context: any) {
                            return ` ${context.dataset.label}: ${context.parsed.y} days`;
                        },
                        afterBody: function (contexts: any[]) {
                            if (contexts.length > 0) {
                                const idx = contexts[0].dataIndex;
                                const item = safeBottlenecks[idx];
                                if (item) {
                                    const diff = (item.avgDays - item.sla).toFixed(1);
                                    return Number(diff) > 0
                                        ? `⚠️ SLA Breach: +${diff}d over target`
                                        : `✅ SLA Compliant: ${Math.abs(Number(diff))}d ahead of target`;
                                }
                            }
                            return '';
                        },
                    },
                },
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { size: 11, family: 'Inter, system-ui, sans-serif' },
                        color: '#475569',
                        maxRotation: 0,
                        autoSkip: false,
                    },
                },
                y: {
                    beginAtZero: true,
                    grid: { color: '#f1f5f9' },
                    ticks: {
                        font: { size: 11 },
                        color: '#64748b',
                        callback: function (val: any) {
                            return val + 'd';
                        },
                    },
                    title: {
                        display: true,
                        text: 'Turnaround Days',
                        color: '#94a3b8',
                        font: { size: 10, weight: '600' },
                    },
                },
            },
        };
    }, [safeBottlenecks]);

    // ── 2. Workflow Status Distribution (Chart.js Donut Chart) ───────────────
    const safeStatusDistribution = useMemo(() => {
        return Array.isArray(statusDistribution) ? statusDistribution : [];
    }, [statusDistribution]);

    const hasStatusData = useMemo(() => {
        return safeStatusDistribution.some((s) => s.count > 0);
    }, [safeStatusDistribution]);

    const donutChartData = useMemo(() => {
        if (!hasStatusData) {
            return {
                labels: ['In Progress', 'Completed', 'Returned', 'SLA Violations'],
                datasets: [
                    {
                        data: [1, 1, 1, 1],
                        backgroundColor: ['#93c5fd', '#a7f3d0', '#fde68a', '#fca5a5'],
                        borderColor: '#ffffff',
                        borderWidth: 2,
                        hoverOffset: 4,
                    },
                ],
            };
        }
        return {
            labels: safeStatusDistribution.map((s) => s.label),
            datasets: [
                {
                    data: safeStatusDistribution.map((s) => s.count),
                    backgroundColor: safeStatusDistribution.map((s) => s.color || '#3b82f6'),
                    borderColor: '#ffffff',
                    borderWidth: 2,
                    hoverOffset: 6,
                },
            ],
        };
    }, [safeStatusDistribution, hasStatusData]);

    const donutChartOptions = useMemo<any>(() => {
        return {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '72%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 10,
                        boxHeight: 10,
                        useBorderRadius: true,
                        borderRadius: 5,
                        font: { size: 11, family: 'Inter, system-ui, sans-serif' },
                        color: '#475569',
                        padding: 12,
                    },
                },
                tooltip: {
                    backgroundColor: '#0f172a',
                    titleFont: { size: 12, weight: 'bold' },
                    bodyFont: { size: 11 },
                    padding: 10,
                    cornerRadius: 8,
                    callbacks: {
                        label: function (context: any) {
                            const label = context.label || '';
                            const val = hasStatusData ? context.parsed : 0;
                            const total = kpiMetrics.totalDocuments || 1;
                            const pct = hasStatusData ? Math.round((val / total) * 100) : 0;
                            return ` ${label}: ${val} documents (${pct}%)`;
                        },
                    },
                },
            },
        };
    }, [hasStatusData, kpiMetrics.totalDocuments]);

    // ── 3. Weekly Volume Trends (Chart.js Line Chart) ────────────────────────
    const safeVolumeTrends = useMemo(() => {
        if (volumeTrends && volumeTrends.length > 0) {
            return volumeTrends;
        }
        return [
            { day: 'Mon', volume: 0 },
            { day: 'Tue', volume: 0 },
            { day: 'Wed', volume: 0 },
            { day: 'Thu', volume: 0 },
            { day: 'Fri', volume: 0 },
            { day: 'Sat', volume: 0 },
            { day: 'Sun', volume: 0 },
        ];
    }, [volumeTrends]);

    const lineChartData = useMemo(() => {
        return {
            labels: safeVolumeTrends.map((v) => v.day),
            datasets: [
                {
                    label: 'Document Submissions',
                    data: safeVolumeTrends.map((v) => v.volume),
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.12)',
                    fill: true,
                    tension: 0.35,
                    borderWidth: 2.5,
                    pointBackgroundColor: '#8b5cf6',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointHoverBackgroundColor: '#7c3aed',
                },
            ],
        };
    }, [safeVolumeTrends]);

    const lineChartOptions = useMemo<any>(() => {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    align: 'end',
                    labels: {
                        boxWidth: 12,
                        boxHeight: 12,
                        useBorderRadius: true,
                        borderRadius: 3,
                        font: { size: 11, family: 'Inter, system-ui, sans-serif' },
                        color: '#64748b',
                        padding: 10,
                    },
                },
                tooltip: {
                    backgroundColor: '#0f172a',
                    titleFont: { size: 12, weight: 'bold' },
                    bodyFont: { size: 11 },
                    padding: 10,
                    cornerRadius: 8,
                    callbacks: {
                        label: function (context: any) {
                            return ` Document Submissions: ${context.parsed.y}`;
                        },
                    },
                },
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { size: 11, family: 'Inter, system-ui, sans-serif' },
                        color: '#475569',
                    },
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        font: { size: 11 },
                        color: '#64748b',
                        precision: 0,
                    },
                    grid: { color: '#f1f5f9' },
                    title: {
                        display: true,
                        text: 'Daily Submissions',
                        color: '#94a3b8',
                        font: { size: 10, weight: '600' },
                    },
                },
            },
        };
    }, []);

    return (
        <TrackngoLayout>
            <Head title="Live System Dashboard — TrackNGo Mati" />

            <div className="space-y-5 pb-12">
                {/* ── HEADER BANNER ─────────────────────────────────────────── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between shrink-0 gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-[20px] font-bold text-[var(--tng-slate-900)] flex items-center gap-2">
                                <Activity className="h-5 w-5 text-[var(--tng-blue-600)]" />
                                {isFullAccess ? 'System Overview & Live Tracking' : `${userRoleName} Dashboard`}
                            </h1>


                        </div>
                        <p className="mt-1 text-sm text-[var(--tng-slate-500)]">
                            {isFullAccess
                                ? 'Real-time document transactions, statutory SLA compliance, and cross-departmental workflow tracking.'
                                : `Live tracking and metrics synchronized to your department (${userDepartment}) and user workflow.`}
                        </p>
                    </div>

                    {/* Filter Controls */}
                    <div className="flex flex-wrap items-center gap-2.5">
                        {/* Date Range Dropdown */}
                        <div className="relative inline-flex items-center">
                            <Filter className="absolute left-3 h-4 w-4 text-[var(--tng-slate-400)] pointer-events-none" />
                            <select
                                value={selectedRange}
                                onChange={(e) => applyFilters(e.target.value, selectedDept)}
                                className="h-9 rounded-lg border border-[var(--tng-slate-200)] bg-white pl-9 pr-8 text-xs font-medium text-[var(--tng-slate-700)] hover:border-[var(--tng-slate-300)] focus:border-[var(--tng-blue-500)] focus:ring-1 focus:ring-[var(--tng-blue-500)] transition-colors cursor-pointer appearance-none shadow-2xs"
                            >
                                <option value="all">All Time</option>
                                <option value="today">Today</option>
                                <option value="7days">Past 7 Days</option>
                                <option value="30days">Past 30 Days</option>
                                <option value="this_month">This Month</option>
                            </select>
                            <ChevronDown className="absolute right-2.5 h-3.5 w-3.5 text-[var(--tng-slate-400)] pointer-events-none" />
                        </div>

                        {/* Department Filter (Admin & Cart oversight) */}
                        {isFullAccess && (
                            <div className="relative inline-flex items-center">
                                <Building2 className="absolute left-3 h-4 w-4 text-[var(--tng-slate-400)] pointer-events-none" />
                                <select
                                    value={selectedDept}
                                    onChange={(e) => applyFilters(selectedRange, e.target.value)}
                                    className="h-9 max-w-[200px] rounded-lg border border-[var(--tng-slate-200)] bg-white pl-9 pr-8 text-xs font-medium text-[var(--tng-slate-700)] hover:border-[var(--tng-slate-300)] focus:border-[var(--tng-blue-500)] focus:ring-1 focus:ring-[var(--tng-blue-500)] transition-colors cursor-pointer appearance-none truncate shadow-2xs"
                                >
                                    <option value="all">All Departments</option>
                                    {departments.map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {d.name}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-2.5 h-3.5 w-3.5 text-[var(--tng-slate-400)] pointer-events-none" />
                            </div>
                        )}

                        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold shadow-2xs">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            Live Sync
                        </div>
                    </div>
                </div>

                {/* ── CRITICAL SLA BREACH ALERT BANNER ───────────────────────── */}
                {kpiMetrics.slaViolations > 0 && (
                    <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white">
                                <AlertTriangle className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-red-900">
                                    SLA Breach Alert: {kpiMetrics.slaViolations} Overdue Document{kpiMetrics.slaViolations > 1 ? 's' : ''}
                                </h3>
                                <p className="text-xs text-red-700 mt-0.5">
                                    {kpiMetrics.slaViolations} transaction{kpiMetrics.slaViolations > 1 ? 's have' : ' has'} exceeded statutory Republic Act 11032 (ARTA) processing deadlines. Immediate administrative attention is required.
                                </p>
                            </div>
                        </div>
                        <Link
                            href={kpiLinks.slaViolations}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors shrink-0 self-start sm:self-center shadow-2xs"
                        >
                            <span>Inspect Violations in Audit Trail</span>
                            <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>
                )}

                {/* ── CLICKABLE KPI METRICS (5-COLUMN GRID) ─────────────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 shrink-0">
                    {/* 1. Total Documents -> My Documents */}
                    <StatCard
                        label="Total Documents"
                        value={kpiMetrics.totalDocuments}
                        subtitle="Click to view My Documents"
                        icon={FileText}
                        color="blue"
                        href={kpiLinks.total}
                    />

                    {/* 2. Completed -> Archived */}
                    <StatCard
                        label="Completed"
                        value={kpiMetrics.completedDocuments}
                        subtitle="Click to view Archived"
                        icon={CheckCircle2}
                        color="emerald"
                        href={kpiLinks.completed}
                    />

                    {/* 3. In Progress -> My Documents (Ongoing) */}
                    <StatCard
                        label="In Progress"
                        value={kpiMetrics.inProgressDocuments}
                        subtitle="Active ongoing workflows"
                        icon={Clock}
                        color="purple"
                        href={kpiLinks.inProgress}
                    />

                    {/* 4. Returned -> Returned Documents */}
                    <StatCard
                        label="Returned"
                        value={kpiMetrics.returnedDocuments}
                        subtitle="Requires office revision"
                        icon={RotateCcw}
                        color="amber"
                        href={kpiLinks.returned}
                    />

                    {/* 5. SLA Violations -> Audit Trail */}
                    <StatCard
                        label="SLA Violations"
                        value={kpiMetrics.slaViolations}
                        subtitle="Click to view Audit Trail"
                        icon={AlertTriangle}
                        color="red"
                        href={kpiLinks.slaViolations}
                    />
                </div>

                {/* ── LIVE KPI DATA VISUALIZATIONS SECTION (CHART.JS) ───────── */}
                {/* Row 1: Department Bottlenecks (Bar Graph) & Workflow Status Distribution (Donut Chart) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Chart 1: Department Bottlenecks (Bar Graph) */}
                    <div className="rounded-2xl border border-[var(--tng-slate-200)] bg-white p-6 shadow-xs flex flex-col hover:border-blue-300 transition-colors">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h2 className="text-[18px] md:text-[20px] font-medium text-[#0066cc]">
                                    Department Bottlenecks
                                </h2>
                                <p className="mt-0.5 text-xs text-[var(--tng-slate-500)]">
                                    Average processing days vs statutory SLA threshold per department
                                </p>
                            </div>
                            <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-md">
                                Bar Graph
                            </span>
                        </div>

                        <div className="h-72 w-full flex-1 relative pt-1">
                            <Bar data={barChartData} options={barChartOptions} />
                        </div>
                    </div>

                    {/* Chart 2: Workflow Status Distribution (Donut Chart) */}
                    <div className="rounded-2xl border border-[var(--tng-slate-200)] bg-white p-6 shadow-xs flex flex-col hover:border-emerald-300 transition-colors">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h2 className="text-[18px] md:text-[20px] font-medium text-[#0066cc]">
                                    Workflow Status Distribution
                                </h2>
                                <p className="mt-0.5 text-xs text-[var(--tng-slate-500)]">
                                    Breakdown of active document lifecycle stages
                                </p>
                            </div>
                            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
                                Donut Chart
                            </span>
                        </div>

                        <div className="h-72 w-full flex-1 relative pt-1">
                            <Doughnut data={donutChartData} options={donutChartOptions} />
                            {/* Center total document count inside donut cutout */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-7">
                                <span className="text-2xl font-black text-[var(--tng-slate-900)]">
                                    {kpiMetrics.totalDocuments}
                                </span>
                                <span className="text-[10px] uppercase font-bold text-[var(--tng-slate-400)] tracking-wider">
                                    Total Docs
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Row 2: Weekly Volume Trends (Line Chart - Full Width) */}
                <div className="rounded-2xl border border-[var(--tng-slate-200)] bg-white p-6 shadow-xs flex flex-col hover:border-purple-300 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                        <div>
                            <h2 className="text-[18px] md:text-[20px] font-medium text-[#0066cc]">
                                Weekly Volume Trends
                            </h2>
                            <p className="mt-0.5 text-xs text-[var(--tng-slate-500)]">
                                Document submissions per day of the week (Monday – Sunday)
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {peakDay.volume > 0 && (
                                <span className="text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1 rounded-lg">
                                    Peak Day: <strong className="text-purple-700">{peakDay.day}</strong> ({peakDay.volume} filings)
                                </span>
                            )}
                            <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-md">
                                Line Chart
                            </span>
                        </div>
                    </div>

                    <div className="h-72 w-full relative pt-2">
                        <Line data={lineChartData} options={lineChartOptions} />
                    </div>
                </div>
            </div>
        </TrackngoLayout>
    );
}

