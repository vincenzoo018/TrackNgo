import { Head } from '@inertiajs/react';
import { FileText, CheckCircle2, Clock, RotateCcw, FilePlus2, Route, Activity } from 'lucide-react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { StatCard } from '@/components/trackngo/StatCard';
import { SlaAlert } from '@/components/trackngo/SlaAlert';
import { QuickLinks } from '@/components/trackngo/QuickLinks';
import { AnalyticsCharts } from '@/components/trackngo/AnalyticsCharts';
import { mockDashboardStats, mockBottlenecks, mockStatusDistribution } from '@/lib/mock-data';

export default function ReceivingDashboard() {
    const stats = mockDashboardStats;
    const bottlenecks = mockBottlenecks;
    const distribution = mockStatusDistribution;

    return (
        <TrackngoLayout>
            <Head title="Receiving Dashboard — TrackNGo Mati" />

            <div className="space-y-6">
                {/* Page Header */}
                <div>
                    <h1 className="text-2xl font-bold text-[var(--tng-slate-900)]">
                        Monitoring Reports & Dashboard
                    </h1>
                    <p className="mt-0.5 text-sm text-[var(--tng-slate-500)]">
                        Document transaction insights across 52 departments
                    </p>
                </div>

                {/* Alert Banners */}
                <div className="tng-stagger space-y-3">
                    <SlaAlert
                        variant="breach"
                        title="SLA Breach Alert"
                        message="There are 2 documents that have exceeded their ARTA processing SLA."
                        actionLabel="View Overdue"
                    />
                    <SlaAlert
                        variant="action"
                        title="Action Required"
                        message="You have 1 documents pending your review and signature."
                        actionLabel="Go to Inbox"
                    />
                </div>

                {/* Filters Row */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 rounded-lg border border-[var(--tng-slate-200)] bg-white px-3 py-2 text-sm text-[var(--tng-slate-600)]">
                        <span>May 1, 2026 — May 29, 2026</span>
                        <span className="text-[var(--tng-slate-400)]">▾</span>
                    </div>
                    {['Department', 'Document Type', 'Status'].map((filter) => (
                        <div
                            key={filter}
                            className="flex items-center gap-2 rounded-lg border border-[var(--tng-slate-200)] bg-white px-3 py-2 text-sm text-[var(--tng-slate-600)]"
                        >
                            <span>{filter}</span>
                            <span className="text-[var(--tng-slate-400)]">▾</span>
                        </div>
                    ))}

                    <div className="ml-auto flex items-center gap-2">
                        <button className="rounded-lg border border-[var(--tng-slate-200)] bg-white px-4 py-2 text-sm font-medium text-[var(--tng-slate-700)] transition-colors hover:bg-[var(--tng-slate-50)]">
                            Export PDF
                        </button>
                        <button className="rounded-lg border border-[var(--tng-slate-200)] bg-white px-4 py-2 text-sm font-medium text-[var(--tng-slate-700)] transition-colors hover:bg-[var(--tng-slate-50)]">
                            Export CSV
                        </button>
                    </div>
                </div>

                {/* Stat Cards */}
                <div className="tng-stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        label="Total Documents"
                        value={stats.total_documents}
                        subtitle="This month"
                        icon={FileText}
                        color="green"
                    />
                    <StatCard
                        label="Completed"
                        value={stats.completed}
                        subtitle={`${stats.completion_rate}% completion rate`}
                        icon={CheckCircle2}
                        color="blue"
                    />
                    <StatCard
                        label="In Progress"
                        value={stats.in_progress}
                        subtitle="Across 52 departments"
                        icon={Clock}
                        color="amber"
                    />
                    <StatCard
                        label="Returned"
                        value={stats.returned}
                        subtitle="Require resubmission"
                        icon={RotateCcw}
                        color="red"
                    />
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-2 min-w-0">
                        <AnalyticsCharts bottlenecks={bottlenecks} distribution={distribution} />
                    </div>
                    
                    <div className="lg:col-span-1">
                        <QuickLinks 
                            title="Receiving Modules"
                            links={[
                                { title: 'All Documents', href: '/receiving/documents', icon: FileText, color: 'text-blue-600 bg-blue-50' },
                                { title: 'Submit Document', href: '/receiving/documents/create', icon: FilePlus2, color: 'text-emerald-600 bg-emerald-50' },
                                { title: 'Routing Slips', href: '/receiving/routing-slips', icon: Route, color: 'text-purple-600 bg-purple-50' },
                                { title: 'Audit Trail', href: '/receiving/audit-trail', icon: Activity, color: 'text-amber-600 bg-amber-50' },
                            ]}
                        />
                    </div>
                </div>
            </div>
        </TrackngoLayout>
    );
}
