import { useState, useMemo, useRef } from 'react';
import { Head, router } from '@inertiajs/react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import {
    BarChart3,
    TrendingUp,
    Filter,
    FileDown,
    FileSpreadsheet,
    ShieldCheck,
    Building2,
    CheckCircle2,
    AlertTriangle,
    Clock,
    Sparkles,
    Search,
    RefreshCw,
    Activity,
    Layers,
    UserCheck,
    FileText,
    Calendar,
    ChevronDown,
    Printer,
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    Legend,
    ResponsiveContainer,
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell,
} from 'recharts';
import { toast } from 'sonner';
import TablePagination from '@/components/trackngo/TablePagination';

export interface Metrics {
    totalProcessed: number;
    completedCount: number;
    activeCount: number;
    returnedCount: number;
    slaComplianceRate: number;
    slaViolations: number;
    slaCompliant: number;
    nearDeadline: number;
    avgTurnaroundDays: number;
}

export interface DepartmentBottleneck {
    id: number;
    name: string;
    code: string;
    totalDocs: number;
    pendingDocs: number;
    delayedDocs: number;
    avgDays: number;
    sla: number;
    diff: number;
    status: 'Normal' | 'Warning' | 'Bottleneck';
}

export interface BottleneckChartItem {
    name: string;
    avgDays: number;
    sla: number;
}

export interface VolumeItem {
    day: string;
    volume: number;
}

export interface MonthlyTrendItem {
    period: string;
    volume: number;
}

export interface StatusItem {
    label: string;
    value: number;
    color: string;
}

export interface ActivityLog {
    id: number;
    timestamp: string;
    action: string;
    userName: string;
    userRole: string;
    department: string;
    documentRef: string;
    ipAddress: string;
    description: string | null;
}

export interface DepartmentOption {
    id: number;
    name: string;
    code: string;
}

interface ReportsProps {
    metrics: Metrics;
    bottlenecks: DepartmentBottleneck[];
    bottleneckChartData: BottleneckChartItem[];
    weeklyVolume: VolumeItem[];
    monthlyTrend: MonthlyTrendItem[];
    statusDistribution: StatusItem[];
    activityLogs: ActivityLog[];
    insights: string[];
    isFullAccess: boolean;
    currentRole: string;
    userRoleName: string;
    userName: string;
    userDepartment: string;
    filters: {
        range: string;
        department: string;
    };
    departments: DepartmentOption[];
}

export default function ReportsIndex({
    metrics = {
        totalProcessed: 0,
        completedCount: 0,
        activeCount: 0,
        returnedCount: 0,
        slaComplianceRate: 100,
        slaViolations: 0,
        slaCompliant: 0,
        nearDeadline: 0,
        avgTurnaroundDays: 2.5,
    },
    bottlenecks = [],
    bottleneckChartData = [],
    weeklyVolume = [],
    monthlyTrend = [],
    statusDistribution = [],
    activityLogs = [],
    insights = [],
    isFullAccess = false,
    currentRole = 'admin',
    userRoleName = 'User',
    userName = 'User',
    userDepartment = 'LGU Mati',
    filters = { range: 'all', department: 'all' },
    departments = [],
}: ReportsProps) {
    // Local filter state
    const [selectedRange, setSelectedRange] = useState(filters.range || 'all');
    const [selectedDept, setSelectedDept] = useState(filters.department || 'all');
    const [activitySearch, setActivitySearch] = useState('');
    const [activityActionFilter, setActivityActionFilter] = useState('ALL');
    const [logPage, setLogPage] = useState(1);
    const [logPageSize, setLogPageSize] = useState(20);
    const [deptSearch, setDeptSearch] = useState('');
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [isExportingCsv, setIsExportingCsv] = useState(false);

    // Filter change handler
    const applyFilters = (newRange: string, newDept: string) => {
        setSelectedRange(newRange);
        setSelectedDept(newDept);
        router.get(
            window.location.pathname,
            { range: newRange, department: newDept },
            { preserveState: true, preserveScroll: true }
        );
    };

    // Filtered Activity Logs
    const filteredLogs = useMemo(() => {
        return activityLogs.filter((log) => {
            // Action category filter
            if (activityActionFilter === 'SECURITY' && !['login', 'logout', 'session'].some((a) => log.action.toLowerCase().includes(a))) {
                return false;
            }
            if (activityActionFilter === 'WORKFLOW' && ['login', 'logout', 'session'].some((a) => log.action.toLowerCase().includes(a))) {
                return false;
            }

            // Text search
            if (!activitySearch.trim()) return true;
            const query = activitySearch.toLowerCase();
            return (
                log.action.toLowerCase().includes(query) ||
                log.userName.toLowerCase().includes(query) ||
                log.userRole.toLowerCase().includes(query) ||
                log.department.toLowerCase().includes(query) ||
                log.documentRef.toLowerCase().includes(query) ||
                log.ipAddress.toLowerCase().includes(query) ||
                (log.description && log.description.toLowerCase().includes(query))
            );
        });
    }, [activityLogs, activitySearch, activityActionFilter]);

    const paginatedLogs = useMemo(() => {
        const start = (logPage - 1) * logPageSize;
        return filteredLogs.slice(start, start + logPageSize);
    }, [filteredLogs, logPage, logPageSize]);

    // Filtered Department Bottlenecks Table
    const filteredBottlenecks = useMemo(() => {
        if (!deptSearch.trim()) return bottlenecks;
        const query = deptSearch.toLowerCase();
        return bottlenecks.filter(
            (dept) => dept.name.toLowerCase().includes(query) || dept.code.toLowerCase().includes(query)
        );
    }, [bottlenecks, deptSearch]);

    // ── CSV Export ──────────────────────────────────────────────────────────
    const handleExportCsv = () => {
        try {
            setIsExportingCsv(true);
            const dateStr = new Date().toISOString().slice(0, 10);
            const timeStr = new Date().toLocaleTimeString();

            let csvContent = `TrackNGo Mati - Reports & Analytics Export\n`;
            csvContent += `Generated At,"${dateStr} ${timeStr}"\n`;
            csvContent += `Generated By,"${userName} (${userRoleName})"\n`;
            csvContent += `Access Scope,"${isFullAccess ? 'System-Wide Oversight' : 'Role-Scoped Analytics'}"\n`;
            csvContent += `Department Context,"${userDepartment}"\n`;
            csvContent += `Date Filter Range,"${selectedRange}"\n\n`;

            // Section 1: Executive KPI Metrics
            csvContent += `=== 1. EXECUTIVE KPI METRICS ===\n`;
            csvContent += `Metric,Value,Benchmark / Description\n`;
            csvContent += `"Total Documents Processed",${metrics.totalProcessed},"All active & finalized documents"\n`;
            csvContent += `"Completed / Approved",${metrics.completedCount},"Fully processed documents"\n`;
            csvContent += `"Active / In-Review",${metrics.activeCount},"Currently ongoing in workflow"\n`;
            csvContent += `"Returned / Rejected",${metrics.returnedCount},"Returned for revision or clarification"\n`;
            csvContent += `"SLA Compliance Rate","${metrics.slaComplianceRate}%","Statutory ARTA Compliance Limit (>= 85%)"\n`;
            csvContent += `"SLA Compliant Documents",${metrics.slaCompliant},"Documents within legal timeframes"\n`;
            csvContent += `"SLA Violations / Overdue",${metrics.slaViolations},"Breached statutory deadlines"\n`;
            csvContent += `"Approaching Deadline (<= 2 Days)",${metrics.nearDeadline},"At risk of SLA breach"\n`;
            csvContent += `"Average Turnaround Time","${metrics.avgTurnaroundDays} days","Filing to completion average"\n\n`;

            // Section 2: Department Bottlenecks
            csvContent += `=== 2. DEPARTMENT BOTTLENECK & DELAY BREAKDOWN ===\n`;
            csvContent += `Department,Code,Total Documents,Pending,Delayed (Overdue),Avg Turnaround (Days),Legal SLA (Days),Variance (Days),Status\n`;
            bottlenecks.forEach((b) => {
                csvContent += `"${b.name}","${b.code}",${b.totalDocs},${b.pendingDocs},${b.delayedDocs},${b.avgDays},${b.sla},${b.diff},"${b.status}"\n`;
            });
            csvContent += `\n`;

            // Section 3: Weekly Document Volume
            csvContent += `=== 3. WEEKLY FILING VOLUME TREND ===\n`;
            csvContent += `Day,Submissions\n`;
            weeklyVolume.forEach((v) => {
                csvContent += `"${v.day}",${v.volume}\n`;
            });
            csvContent += `\n`;

            // Section 4: Activity Logs
            csvContent += `=== 4. AUDIT & ACTIVITY LOGS ===\n`;
            csvContent += `Timestamp,Action,User,Role,Department,Document Reference,IP Address,Description\n`;
            activityLogs.forEach((log) => {
                const desc = (log.description || '').replace(/"/g, '""');
                csvContent += `"${log.timestamp}","${log.action}","${log.userName}","${log.userRole}","${log.department}","${log.documentRef}","${log.ipAddress}","${desc}"\n`;
            });

            // Trigger file download
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `TrackNGo_Report_${currentRole}_${dateStr}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            toast.success('CSV report exported successfully!');
        } catch (err) {
            console.error('Error generating CSV:', err);
            toast.error('Failed to export CSV report.');
        } finally {
            setIsExportingCsv(false);
        }
    };

    // ── PDF Export ──────────────────────────────────────────────────────────
    const handleExportPdf = async () => {
        const element = document.getElementById('printable-reports-document');
        if (!element) return;

        try {
            setIsGeneratingPdf(true);
            toast.info('Generating formatted PDF report...');

            const html2pdfModule = await import('html2pdf.js');
            const html2pdf = html2pdfModule.default || html2pdfModule;

            const dateStr = new Date().toISOString().slice(0, 10);
            const opt = {
                margin: [10, 10, 10, 10],
                filename: `TrackNGo_Reports_Analytics_${currentRole}_${dateStr}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, logging: false },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            };

            await html2pdf().set(opt).from(element).save();
            toast.success('PDF report exported successfully!');
        } catch (error) {
            console.error('Error generating PDF:', error);
            toast.error('Could not generate PDF directly. Opening print dialog...');
            window.print();
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    return (
        <TrackngoLayout>
            <Head title="System Reports & Analytics — TrackNGo Mati" />

            <div className="flex h-[calc(100vh-140px)] flex-col space-y-6 overflow-y-auto tng-scrollbar pb-12 pr-1">
                {/* ── HEADER BANNER ─────────────────────────────────────────── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between shrink-0 gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-[20px] font-bold text-[var(--tng-slate-900)] flex items-center gap-2">
                                <BarChart3 className="h-5 w-5 text-[var(--tng-blue-600)]" />
                                Reports & Analytics
                            </h1>

                            {/* Visibility Tag */}
                            {isFullAccess ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 border border-indigo-200">
                                    <ShieldCheck className="h-3.5 w-3.5" />
                                    System-Wide Oversight
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                                    <UserCheck className="h-3.5 w-3.5" />
                                    Role-Scoped ({userRoleName})
                                </span>
                            )}
                        </div>
                        <p className="mt-1 text-sm text-[var(--tng-slate-500)]">
                            {isFullAccess
                                ? 'Mati City Document Tracking System — Real-time performance metrics, SLA compliance & municipal analytics.'
                                : `Analytics filtered to your departmental workflows (${userDepartment}) and user activity.`}
                        </p>
                    </div>

                    {/* Filter & Export Actions */}
                    <div className="flex flex-wrap items-center gap-2.5">
                        {/* Date Range Dropdown */}
                        <div className="relative inline-flex items-center">
                            <Filter className="absolute left-3 h-4 w-4 text-[var(--tng-slate-400)] pointer-events-none" />
                            <select
                                value={selectedRange}
                                onChange={(e) => applyFilters(e.target.value, selectedDept)}
                                className="h-9 rounded-lg border border-[var(--tng-slate-200)] bg-white pl-9 pr-8 text-xs font-medium text-[var(--tng-slate-700)] hover:border-[var(--tng-slate-300)] focus:border-[var(--tng-blue-500)] focus:ring-1 focus:ring-[var(--tng-blue-500)] transition-colors cursor-pointer appearance-none"
                            >
                                <option value="all">All Time</option>
                                <option value="today">Today</option>
                                <option value="7days">Past 7 Days</option>
                                <option value="30days">Past 30 Days</option>
                                <option value="this_month">This Month</option>
                            </select>
                            <ChevronDown className="absolute right-2.5 h-3.5 w-3.5 text-[var(--tng-slate-400)] pointer-events-none" />
                        </div>

                        {/* Department Filter (Admin / Cart oversight) */}
                        {isFullAccess && (
                            <div className="relative inline-flex items-center">
                                <Building2 className="absolute left-3 h-4 w-4 text-[var(--tng-slate-400)] pointer-events-none" />
                                <select
                                    value={selectedDept}
                                    onChange={(e) => applyFilters(selectedRange, e.target.value)}
                                    className="h-9 max-w-[200px] rounded-lg border border-[var(--tng-slate-200)] bg-white pl-9 pr-8 text-xs font-medium text-[var(--tng-slate-700)] hover:border-[var(--tng-slate-300)] focus:border-[var(--tng-blue-500)] focus:ring-1 focus:ring-[var(--tng-blue-500)] transition-colors cursor-pointer appearance-none truncate"
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

                        {/* CSV Export Button */}
                        <button
                            onClick={handleExportCsv}
                            disabled={isExportingCsv}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--tng-slate-200)] bg-white px-3.5 py-2 text-xs font-semibold text-[var(--tng-slate-700)] hover:bg-[var(--tng-slate-50)] hover:border-[var(--tng-slate-300)] transition-colors disabled:opacity-60 shadow-xs"
                            title="Export analytics and activity logs to CSV"
                        >
                            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                            {isExportingCsv ? 'Exporting...' : 'Export CSV'}
                        </button>

                        {/* PDF Export Button */}
                        <button
                            onClick={handleExportPdf}
                            disabled={isGeneratingPdf}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--tng-slate-900)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--tng-slate-800)] transition-colors disabled:opacity-60 shadow-xs"
                            title="Download formatted official PDF report"
                        >
                            {isGeneratingPdf ? (
                                <>
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                                    <span>Generating PDF...</span>
                                </>
                            ) : (
                                <>
                                    <FileDown className="h-4 w-4 text-[var(--tng-blue-400)]" />
                                    <span>Download PDF Report</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* ── ROLE VISIBILITY SCOPE BANNER ──────────────────────────── */}
                <div
                    className={`rounded-xl border p-4 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 ${
                        isFullAccess
                            ? 'bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-white border-blue-200'
                            : 'bg-gradient-to-r from-emerald-50/70 via-teal-50/40 to-white border-emerald-200'
                    }`}
                >
                    <div className="flex items-center gap-3">
                        <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                                isFullAccess ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white'
                            }`}
                        >
                            {isFullAccess ? <ShieldCheck className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-bold text-[var(--tng-slate-900)]">
                                    {isFullAccess ? 'System-Wide Municipal Oversight' : `Role Scope: ${userRoleName}`}
                                </h3>
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Live Database Sync</span>
                            </div>
                            <p className="text-xs text-[var(--tng-slate-600)] mt-0.5">
                                {isFullAccess
                                    ? `Displaying aggregate data across all ${departments.length} departments and system roles. Admin and Cart maintain full administrative oversight.`
                                    : `Filtered to documents filed by, assigned to, or routed through ${userDepartment}. Data outside your department scope is restricted.`}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                        <span className="text-xs font-medium text-[var(--tng-slate-500)]">User:</span>
                        <span className="text-xs font-bold text-[var(--tng-slate-800)] bg-white/80 border border-slate-200 px-2.5 py-1 rounded-md">
                            {userName} ({userRoleName})
                        </span>
                    </div>
                </div>

                {/* ── KPI METRICS CARDS (4-COLUMNS) ─────────────────────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
                    {/* 1. Total Processed */}
                    <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-5 shadow-xs hover:border-[var(--tng-blue-300)] transition-all">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-semibold text-[var(--tng-slate-500)] uppercase tracking-wider">
                                Total Documents
                            </span>
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--tng-blue-50)] text-[var(--tng-blue-600)]">
                                <BarChart3 className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="text-3xl font-extrabold text-[var(--tng-slate-900)] tracking-tight">
                            {metrics.totalProcessed.toLocaleString()}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 text-[11px]">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">
                                {metrics.completedCount} Completed
                            </span>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold">
                                {metrics.activeCount} Ongoing
                            </span>
                            {metrics.returnedCount > 0 && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold">
                                    {metrics.returnedCount} Returned
                                </span>
                            )}
                        </div>
                    </div>

                    {/* 2. SLA Compliance Rate */}
                    <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-5 shadow-xs hover:border-emerald-300 transition-all">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-semibold text-[var(--tng-slate-500)] uppercase tracking-wider">
                                ARTA SLA Compliance
                            </span>
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                                <CheckCircle2 className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <div
                                className={`text-3xl font-extrabold tracking-tight ${
                                    metrics.slaComplianceRate >= 85
                                        ? 'text-emerald-600'
                                        : metrics.slaComplianceRate >= 70
                                        ? 'text-amber-600'
                                        : 'text-red-600'
                                }`}
                            >
                                {metrics.slaComplianceRate}%
                            </div>
                            <span className="text-xs font-medium text-slate-500">rate</span>
                        </div>
                        <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-[var(--tng-slate-600)]">
                            <span>{metrics.slaCompliant} Compliant Docs</span>
                            <span className="font-semibold text-emerald-700">RA 11032 Standard</span>
                        </div>
                    </div>

                    {/* 3. SLA Violations */}
                    <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-5 shadow-xs hover:border-red-300 transition-all">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-semibold text-[var(--tng-slate-500)] uppercase tracking-wider">
                                SLA Violations
                            </span>
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600">
                                <AlertTriangle className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <div
                                className={`text-3xl font-extrabold tracking-tight ${
                                    metrics.slaViolations > 0 ? 'text-red-600' : 'text-emerald-600'
                                }`}
                            >
                                {metrics.slaViolations}
                            </div>
                            <span className="text-xs font-medium text-slate-500">delayed</span>
                        </div>
                        <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                            {metrics.nearDeadline > 0 ? (
                                <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                                    <Clock className="h-3 w-3" /> {metrics.nearDeadline} near deadline (≤2d)
                                </span>
                            ) : (
                                <span className="text-emerald-700 font-medium">No impending breaches</span>
                            )}
                            <span className="text-slate-400 font-mono text-[10px]">ARTA limit</span>
                        </div>
                    </div>

                    {/* 4. Avg Turnaround Time */}
                    <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-5 shadow-xs hover:border-indigo-300 transition-all">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-semibold text-[var(--tng-slate-500)] uppercase tracking-wider">
                                Avg Turnaround Time
                            </span>
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                                <Clock className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <div className="text-3xl font-extrabold text-[var(--tng-slate-900)] tracking-tight">
                                {metrics.avgTurnaroundDays}
                            </div>
                            <span className="text-xs font-medium text-slate-500">calendar days</span>
                        </div>
                        <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-[var(--tng-slate-600)]">
                            <span>Processing benchmark</span>
                            <span className="font-semibold text-indigo-700">3–7 Days Target</span>
                        </div>
                    </div>
                </div>

                {/* ── AI / DATA ANALYTICS INSIGHTS PANEL ────────────────────── */}
                <div className="shrink-0 rounded-xl border border-[var(--tng-blue-200)] bg-gradient-to-br from-blue-50/60 via-indigo-50/30 to-white p-5 shadow-xs">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--tng-blue-600)] text-white">
                                <Sparkles className="h-4 w-4" />
                            </div>
                            <h3 className="text-sm font-bold text-[var(--tng-blue-950)]">
                                Automated Data Analytics Insights
                            </h3>
                        </div>
                        <span className="text-xs font-semibold text-[var(--tng-blue-700)] bg-blue-100/70 border border-blue-200 px-2.5 py-0.5 rounded-full">
                            Database Derived
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                        {insights.map((insight, idx) => (
                            <div
                                key={idx}
                                className="flex items-start gap-3 rounded-lg border border-blue-100 bg-white/80 p-3 shadow-2xs hover:bg-white transition-colors"
                            >
                                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--tng-blue-500)]" />
                                <p className="text-xs text-[var(--tng-slate-700)] leading-relaxed font-medium">
                                    {insight}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── CHARTS SECTION (2 COLUMNS) ────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Chart 1: Department Bottlenecks & SLA Benchmarks */}
                    <div className="flex flex-col rounded-xl border border-[var(--tng-slate-200)] bg-white p-5 shadow-xs">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-[18px] font-semibold text-[var(--tng-slate-900)] flex items-center gap-2">
                                    <BarChart3 className="h-5 w-5 text-[var(--tng-blue-600)]" />
                                    Department Processing Days vs SLA Limit
                                </h2>
                                <p className="mt-0.5 text-xs text-[var(--tng-slate-500)]">
                                    Comparison of average turnaround days against legal statutory SLA targets
                                </p>
                            </div>
                        </div>

                        <div className="h-72 w-full pt-2">
                            {bottleneckChartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={bottleneckChartData}
                                        layout="vertical"
                                        margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                        <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} unit="d" />
                                        <YAxis
                                            dataKey="name"
                                            type="category"
                                            width={140}
                                            tick={{ fontSize: 11, fill: '#334155' }}
                                        />
                                        <RechartsTooltip
                                            content={({ active, payload, label }) => {
                                                if (active && payload && payload.length) {
                                                    const avg = Number(payload[0]?.value || 0);
                                                    const sla = Number(payload[1]?.value || 0);
                                                    const diff = (avg - sla).toFixed(1);
                                                    return (
                                                        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-md text-xs">
                                                            <p className="font-bold text-slate-800 mb-1">{label}</p>
                                                            <div className="space-y-1">
                                                                <p className="text-blue-600 font-semibold">
                                                                    Avg Processing: {avg} days
                                                                </p>
                                                                <p className="text-slate-500">Legal SLA Target: {sla} days</p>
                                                                <p
                                                                    className={`font-semibold ${
                                                                        Number(diff) > 0 ? 'text-red-600' : 'text-emerald-600'
                                                                    }`}
                                                                >
                                                                    Variance: {Number(diff) > 0 ? `+${diff} days (Delayed)` : `${diff} days (On-Time)`}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                                        <Bar
                                            dataKey="avgDays"
                                            name="Avg Processing Days"
                                            fill="#3b82f6"
                                            radius={[0, 4, 4, 0]}
                                        />
                                        <Bar
                                            dataKey="sla"
                                            name="Statutory SLA Benchmark"
                                            fill="#cbd5e1"
                                            radius={[0, 4, 4, 0]}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex h-full items-center justify-center text-xs text-slate-400">
                                    No department activity recorded in this range
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Chart 2: Document Filing Volume Trend */}
                    <div className="flex flex-col rounded-xl border border-[var(--tng-slate-200)] bg-white p-5 shadow-xs">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-[18px] font-semibold text-[var(--tng-slate-900)] flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                                    Weekly Document Filing Volume Trends
                                </h2>
                                <p className="mt-0.5 text-xs text-[var(--tng-slate-500)]">
                                    Volume of submissions recorded by day of the week
                                </p>
                            </div>
                        </div>

                        <div className="h-72 w-full pt-2">
                            {weeklyVolume.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart
                                        data={weeklyVolume}
                                        margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
                                    >
                                        <defs>
                                            <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748b' }} />
                                        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                                        <RechartsTooltip
                                            content={({ active, payload, label }) => {
                                                if (active && payload && payload.length) {
                                                    return (
                                                        <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-md text-xs">
                                                            <p className="font-bold text-slate-800">{label}</p>
                                                            <p className="text-emerald-600 font-bold mt-0.5">
                                                                {payload[0].value} documents filed
                                                            </p>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="volume"
                                            name="Document Volume"
                                            stroke="#10b981"
                                            strokeWidth={2.5}
                                            fillOpacity={1}
                                            fill="url(#volumeGradient)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex h-full items-center justify-center text-xs text-slate-400">
                                    No volume data recorded in this range
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── DEPARTMENT BOTTLENECK & DELAYS BREAKDOWN TABLE ──────────── */}
                <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white shadow-xs overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                        <div>
                            <h2 className="text-[18px] font-semibold text-[var(--tng-slate-900)] flex items-center gap-2">
                                <Building2 className="h-5 w-5 text-[var(--tng-blue-600)]" />
                                Department Bottlenecks and Processing Delays
                            </h2>
                            <p className="text-xs text-[var(--tng-slate-500)] mt-0.5">
                                Real-time breakdown of turnaround times, statutory SLA adherence, and active backlogs
                            </p>
                        </div>

                        {/* Search in department table */}
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                            <input
                                type="text"
                                value={deptSearch}
                                onChange={(e) => setDeptSearch(e.target.value)}
                                placeholder="Filter departments..."
                                className="w-full h-8 pl-8 pr-3 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto w-full">
                        <table className="w-full text-left text-[14px]">
                            <thead className="border-b border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)] text-[16px] font-bold text-[var(--tng-slate-800)]">
                                <tr>
                                    <th className="py-3 px-4">Department Name</th>
                                    <th className="py-3 px-3">Code</th>
                                    <th className="py-3 px-3 text-center">Total Docs</th>
                                    <th className="py-3 px-3 text-center">Pending</th>
                                    <th className="py-3 px-3 text-center">Delayed</th>
                                    <th className="py-3 px-3 text-center">Avg Days</th>
                                    <th className="py-3 px-3 text-center">Legal SLA</th>
                                    <th className="py-3 px-3 text-center">Variance</th>
                                    <th className="py-3 px-4 text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-normal">
                                {filteredBottlenecks.length > 0 ? (
                                    filteredBottlenecks.map((dept) => (
                                        <tr key={dept.id} className="group transition-colors odd:bg-white even:bg-slate-50/75 hover:bg-blue-50/40">
                                            <td className="py-2.5 px-4 font-semibold text-[var(--tng-slate-800)]">
                                                {dept.name}
                                            </td>
                                            <td className="py-2.5 px-3 font-mono text-[13px] text-slate-500">
                                                {dept.code}
                                            </td>
                                            <td className="py-2.5 px-3 text-center font-normal text-[var(--tng-slate-700)]">
                                                {dept.totalDocs}
                                            </td>
                                            <td className="py-2.5 px-3 text-center">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[13px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                                    {dept.pendingDocs}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 text-center">
                                                {dept.delayedDocs > 0 ? (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[13px] font-bold bg-red-50 text-red-700 border border-red-200">
                                                        {dept.delayedDocs}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 font-mono text-[13px]">0</span>
                                                )}
                                            </td>
                                            <td className="py-2.5 px-3 text-center font-bold text-[var(--tng-slate-800)]">
                                                {dept.avgDays}d
                                            </td>
                                            <td className="py-2.5 px-3 text-center text-slate-500 font-normal">
                                                {dept.sla}d
                                            </td>
                                            <td className="py-2.5 px-3 text-center font-normal">
                                                <span
                                                    className={
                                                        dept.diff > 0
                                                            ? 'text-red-600 font-semibold'
                                                            : 'text-emerald-600 font-semibold'
                                                    }
                                                >
                                                    {dept.diff > 0 ? `+${dept.diff}d` : `${dept.diff}d`}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-4 text-right">
                                                {dept.status === 'Bottleneck' ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 text-[13px] font-bold text-red-700">
                                                        <AlertTriangle className="h-3.5 w-3.5" />
                                                        Bottleneck
                                                    </span>
                                                ) : dept.status === 'Warning' ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[13px] font-bold text-amber-700">
                                                        <Clock className="h-3.5 w-3.5" />
                                                        Warning
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[13px] font-bold text-emerald-700">
                                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                                        Normal
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={9} className="py-6 text-center text-slate-400">
                                            No department matching your filter criteria.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* ── USER-SPECIFIC ACTIVITY LOGS (AUDIT TRAIL) ──────────────── */}
                <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white shadow-xs overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-[18px] font-semibold text-[var(--tng-slate-900)] flex items-center gap-2">
                                    <Activity className="h-5 w-5 text-[var(--tng-blue-600)]" />
                                    User-Specific Activity & Workflow Logs
                                </h2>
                                <span className="text-[12px] font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                                    {filteredLogs.length} Records
                                </span>
                            </div>
                            <p className="text-xs text-[var(--tng-slate-500)] mt-0.5">
                                Direct database audit logs capturing user actions, timestamps, document references, and IP addresses
                            </p>
                        </div>

                        {/* Search & Action Category Filter */}
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Action filter tabs */}
                            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-medium text-slate-600">
                                <button
                                    onClick={() => { setActivityActionFilter('ALL'); setLogPage(1); }}
                                    className={`px-2.5 py-1 rounded-md transition-colors ${
                                        activityActionFilter === 'ALL'
                                            ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                                            : 'hover:text-slate-900'
                                    }`}
                                >
                                    All Logs
                                </button>
                                <button
                                    onClick={() => { setActivityActionFilter('WORKFLOW'); setLogPage(1); }}
                                    className={`px-2.5 py-1 rounded-md transition-colors ${
                                        activityActionFilter === 'WORKFLOW'
                                            ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                                            : 'hover:text-slate-900'
                                    }`}
                                >
                                    Workflows
                                </button>
                                <button
                                    onClick={() => { setActivityActionFilter('SECURITY'); setLogPage(1); }}
                                    className={`px-2.5 py-1 rounded-md transition-colors ${
                                        activityActionFilter === 'SECURITY'
                                            ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                                            : 'hover:text-slate-900'
                                    }`}
                                >
                                    Auth & Session
                                </button>
                            </div>

                            {/* Search */}
                            <div className="relative w-full sm:w-56">
                                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                                <input
                                    type="text"
                                    value={activitySearch}
                                    onChange={(e) => { setActivitySearch(e.target.value); setLogPage(1); }}
                                    placeholder="Search logs, user, ref..."
                                    className="w-full h-8 pl-8 pr-3 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto w-full">
                        <table className="w-full text-left text-[14px]">
                            <thead className="border-b border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)] text-[16px] font-bold text-[var(--tng-slate-800)]">
                                <tr>
                                    <th className="py-3 px-4">Timestamp</th>
                                    <th className="py-3 px-3">Action</th>
                                    <th className="py-3 px-3">User</th>
                                    <th className="py-3 px-3">Role</th>
                                    <th className="py-3 px-3">Department</th>
                                    <th className="py-3 px-3">Document Ref</th>
                                    <th className="py-3 px-3 font-mono text-[13px]">IP Address</th>
                                    <th className="py-3 px-4">Description</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-normal">
                                {paginatedLogs.length > 0 ? (
                                    paginatedLogs.map((log) => {
                                        const actionLower = log.action.toLowerCase();
                                        const isApproval = ['approve', 'completed', 'endorse', 'release'].some((a) =>
                                             actionLower.includes(a)
                                        );
                                        const isWarning = ['return', 'reject', 'escalat'].some((a) =>
                                             actionLower.includes(a)
                                        );
                                        const isAuth = ['login', 'logout'].some((a) => actionLower.includes(a));

                                        return (
                                            <tr key={log.id} className="group transition-colors odd:bg-white even:bg-slate-50/75 hover:bg-blue-50/40">
                                                <td className="py-2.5 px-4 text-slate-500 font-mono text-[13px] whitespace-nowrap">
                                                    {log.timestamp}
                                                </td>
                                                <td className="py-2.5 px-3 whitespace-nowrap">
                                                    <span
                                                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[13px] font-bold ${
                                                            isApproval
                                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                                : isWarning
                                                                ? 'bg-red-50 text-red-700 border border-red-200'
                                                                : isAuth
                                                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                                                        }`}
                                                    >
                                                        {log.action}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-3 font-semibold text-[var(--tng-slate-800)] whitespace-nowrap">
                                                    {log.userName}
                                                </td>
                                                <td className="py-2.5 px-3 text-[var(--tng-slate-600)] whitespace-nowrap">
                                                    {log.userRole}
                                                </td>
                                                <td className="py-2.5 px-3 text-[var(--tng-slate-600)] truncate max-w-[150px]" title={log.department}>
                                                    {log.department}
                                                </td>
                                                <td className="py-2.5 px-3 font-mono text-[13px] font-medium text-blue-700 whitespace-nowrap">
                                                    {log.documentRef}
                                                </td>
                                                <td className="py-2.5 px-3 font-mono text-[13px] text-slate-400 whitespace-nowrap">
                                                    {log.ipAddress}
                                                </td>
                                                <td className="py-2.5 px-4 text-[var(--tng-slate-600)] truncate max-w-[200px]" title={log.description || ''}>
                                                    {log.description || '—'}
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={8} className="py-6 text-center text-slate-400">
                                            No activity logs found matching your filters.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <TablePagination
                        currentPage={logPage}
                        pageSize={logPageSize}
                        totalItems={filteredLogs.length}
                        onPageChange={setLogPage}
                        onPageSizeChange={setLogPageSize}
                        itemLabel="logs"
                    />
                </div>

                {/* ── HIDDEN PRINTABLE CONTAINER FOR PDF REPORT EXPORT ───────── */}
                <div className="hidden">
                    <div
                        id="printable-reports-document"
                        className="p-8 bg-white text-slate-900 font-sans"
                        style={{ width: '190mm', minHeight: '270mm', margin: '0 auto' }}
                    >
                        {/* Official Letterhead */}
                        <div className="text-center pb-4 border-b-2 border-slate-800 mb-6">
                            <p className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">
                                Republic of the Philippines • Province of Davao Oriental
                            </p>
                            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight mt-0.5">
                                CITY GOVERNMENT OF MATI
                            </h2>
                            <p className="text-xs font-bold text-blue-900 mt-1">
                                TRACKNGO MATI — ENTERPRISE DOCUMENT TRACKING SYSTEM
                            </p>
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 mt-2 bg-slate-100 py-1 rounded">
                                Official Reports & Analytics Summary
                            </h3>
                        </div>

                        {/* Report Metadata Table */}
                        <div className="grid grid-cols-2 gap-4 text-xs mb-6 border border-slate-200 p-3 rounded bg-slate-50/50">
                            <div>
                                <p><span className="font-semibold text-slate-600">Generated On:</span> {new Date().toLocaleString()}</p>
                                <p><span className="font-semibold text-slate-600">Generated By:</span> {userName} ({userRoleName})</p>
                                <p><span className="font-semibold text-slate-600">Department Scope:</span> {userDepartment}</p>
                            </div>
                            <div>
                                <p><span className="font-semibold text-slate-600">Access Scope:</span> {isFullAccess ? 'System-Wide Oversight (All Users & Departments)' : 'Role-Scoped Analytics'}</p>
                                <p><span className="font-semibold text-slate-600">Date Range Filter:</span> {selectedRange.toUpperCase()}</p>
                                <p><span className="font-semibold text-slate-600">Compliance Standard:</span> Republic Act 11032 (ARTA 3-7-20)</p>
                            </div>
                        </div>

                        {/* Executive KPI Summary Grid */}
                        <div className="mb-6">
                            <h4 className="text-xs font-bold uppercase text-slate-700 tracking-wider mb-2 border-b pb-1">
                                1. Executive Performance & SLA Metrics
                            </h4>
                            <div className="grid grid-cols-4 gap-2 text-center text-xs">
                                <div className="border border-slate-200 p-2 rounded bg-white">
                                    <p className="text-[10px] text-slate-500 uppercase font-semibold">Total Documents</p>
                                    <p className="text-base font-extrabold text-slate-900">{metrics.totalProcessed}</p>
                                    <p className="text-[9px] text-emerald-600 font-semibold">{metrics.completedCount} Finalized</p>
                                </div>
                                <div className="border border-slate-200 p-2 rounded bg-white">
                                    <p className="text-[10px] text-slate-500 uppercase font-semibold">SLA Compliance</p>
                                    <p className="text-base font-extrabold text-emerald-600">{metrics.slaComplianceRate}%</p>
                                    <p className="text-[9px] text-slate-500">{metrics.slaCompliant} Compliant</p>
                                </div>
                                <div className="border border-slate-200 p-2 rounded bg-white">
                                    <p className="text-[10px] text-slate-500 uppercase font-semibold">SLA Violations</p>
                                    <p className="text-base font-extrabold text-red-600">{metrics.slaViolations}</p>
                                    <p className="text-[9px] text-slate-500">Overdue Documents</p>
                                </div>
                                <div className="border border-slate-200 p-2 rounded bg-white">
                                    <p className="text-[10px] text-slate-500 uppercase font-semibold">Avg Turnaround</p>
                                    <p className="text-base font-extrabold text-blue-600">{metrics.avgTurnaroundDays}d</p>
                                    <p className="text-[9px] text-slate-500">Target 3-7 Days</p>
                                </div>
                            </div>
                        </div>

                        {/* Dynamic Insights Summary */}
                        <div className="mb-6 border border-blue-200 bg-blue-50/40 p-3 rounded">
                            <h4 className="text-xs font-bold uppercase text-blue-900 tracking-wider mb-2">
                                2. Automated Data Analytics Insights
                            </h4>
                            <ul className="space-y-1 text-xs text-slate-700 list-disc list-inside">
                                {insights.map((ins, idx) => (
                                    <li key={idx} className="leading-tight">{ins}</li>
                                ))}
                            </ul>
                        </div>

                        {/* Department Bottlenecks Table */}
                        <div className="mb-6">
                            <h4 className="text-xs font-bold uppercase text-slate-700 tracking-wider mb-2 border-b pb-1">
                                3. Department Bottlenecks & Processing Turnaround
                            </h4>
                            <table className="w-full text-left text-[10px] border border-slate-200">
                                <thead className="bg-slate-100 font-bold text-slate-700 border-b">
                                    <tr>
                                        <th className="p-1.5">Department</th>
                                        <th className="p-1.5 text-center">Code</th>
                                        <th className="p-1.5 text-center">Total</th>
                                        <th className="p-1.5 text-center">Pending</th>
                                        <th className="p-1.5 text-center">Delayed</th>
                                        <th className="p-1.5 text-center">Avg Days</th>
                                        <th className="p-1.5 text-center">Legal SLA</th>
                                        <th className="p-1.5 text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {bottlenecks.slice(0, 10).map((dept) => (
                                        <tr key={dept.id}>
                                            <td className="p-1.5 font-medium">{dept.name}</td>
                                            <td className="p-1.5 text-center font-mono">{dept.code}</td>
                                            <td className="p-1.5 text-center">{dept.totalDocs}</td>
                                            <td className="p-1.5 text-center">{dept.pendingDocs}</td>
                                            <td className="p-1.5 text-center font-bold text-red-600">{dept.delayedDocs}</td>
                                            <td className="p-1.5 text-center font-bold">{dept.avgDays}d</td>
                                            <td className="p-1.5 text-center">{dept.sla}d</td>
                                            <td className="p-1.5 text-right font-semibold">
                                                {dept.status}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Recent Activity Sample */}
                        <div className="mb-6">
                            <h4 className="text-xs font-bold uppercase text-slate-700 tracking-wider mb-2 border-b pb-1">
                                4. Recent Activity & Audit Trail (Sample)
                            </h4>
                            <table className="w-full text-left text-[9px] border border-slate-200">
                                <thead className="bg-slate-100 font-bold text-slate-700 border-b">
                                    <tr>
                                        <th className="p-1">Timestamp</th>
                                        <th className="p-1">Action</th>
                                        <th className="p-1">User / Role</th>
                                        <th className="p-1">Department</th>
                                        <th className="p-1">Doc Ref</th>
                                        <th className="p-1">IP</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {activityLogs.slice(0, 8).map((log) => (
                                        <tr key={log.id}>
                                            <td className="p-1 font-mono">{log.timestamp}</td>
                                            <td className="p-1 font-semibold">{log.action}</td>
                                            <td className="p-1">{log.userName} ({log.userRole})</td>
                                            <td className="p-1">{log.department}</td>
                                            <td className="p-1 font-mono text-blue-700">{log.documentRef}</td>
                                            <td className="p-1 font-mono text-slate-500">{log.ipAddress}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Sign-off / Certification Footer */}
                        <div className="pt-6 border-t border-slate-300 mt-8 flex justify-between text-xs text-slate-500">
                            <div>
                                <p className="font-semibold text-slate-700">Certified Official Report</p>
                                <p className="text-[10px]">TrackNGo Automated Compliance System</p>
                            </div>
                            <div className="text-right">
                                <p className="font-semibold text-slate-700">City Government of Mati</p>
                                <p className="text-[10px]">Republic of the Philippines</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </TrackngoLayout>
    );
}
