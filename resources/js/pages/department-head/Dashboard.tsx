import { Head } from '@inertiajs/react';
import { FileText, CheckCircle2, Clock, RotateCcw, ShieldAlert, GitPullRequest, PenTool, Route } from 'lucide-react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { StatCard } from '@/components/trackngo/StatCard';
import { SlaAlert } from '@/components/trackngo/SlaAlert';
import { QuickLinks } from '@/components/trackngo/QuickLinks';
import { AnalyticsCharts } from '@/components/trackngo/AnalyticsCharts';
import { mockBottlenecks, mockStatusDistribution } from '@/lib/mock-data';

export default function DepartmentHeadDashboard() {
    return (
        <TrackngoLayout>
            <Head title="Department Head Dashboard — TrackNGo Mati" />

            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--tng-slate-900)]">Department Dashboard</h1>
                    <p className="mt-0.5 text-sm text-[var(--tng-slate-500)]">
                        City Engineering Office — Document endorsement overview
                    </p>
                </div>

                <SlaAlert
                    variant="action"
                    title="Pending Endorsement"
                    message="You have 3 documents awaiting your review and endorsement."
                    actionLabel="Review Now"
                />

                <div className="tng-stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard label="Pending Review" value={3} subtitle="Awaiting endorsement" icon={FileText} color="amber" />
                    <StatCard label="Endorsed" value={8} subtitle="This month" icon={CheckCircle2} color="blue" />
                    <StatCard label="Returned" value={1} subtitle="Needs revision" icon={RotateCcw} color="red" />
                    <StatCard label="ARTA Alerts" value={1} subtitle="Approaching deadline" icon={ShieldAlert} color="purple" />
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
                    <div className="flex flex-col gap-6 w-full max-w-full min-w-0 overflow-hidden">
                        <AnalyticsCharts bottlenecks={mockBottlenecks} distribution={mockStatusDistribution} />
                    </div>
                    
                    <div className="flex flex-col gap-6">
                        <QuickLinks 
                            title="Department Modules"
                            links={[
                                { title: 'My Documents', href: '/department-head/documents', icon: FileText, color: 'text-blue-600 bg-blue-50' },
                                { title: 'Workflow', href: '/department-head/workflow', icon: GitPullRequest, color: 'text-emerald-600 bg-emerald-50' },
                                { title: 'My Signature', href: '/department-head/signature', icon: PenTool, color: 'text-amber-600 bg-amber-50' },
                                { title: 'Routing Slips', href: '/department-head/routing-slips', icon: Route, color: 'text-purple-600 bg-purple-50' },
                            ]}
                        />

                        {/* Recent Activity */}
                        <div className="rounded-2xl border border-[var(--tng-slate-200)] bg-white p-6 shadow-sm flex-1">
                            <h3 className="mb-4 text-sm font-semibold text-[var(--tng-slate-800)] flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-[var(--tng-blue-500)]" />
                                Recent Endorsement Activity
                            </h3>
                            <div className="space-y-3">
                                {[
                                    { ref: 'TNG-2026-0004', action: 'Endorsed', time: '2 hours ago', color: 'bg-[var(--tng-emerald-500)]' },
                                    { ref: 'TNG-2026-0005', action: 'Returned', time: '5 hours ago', color: 'bg-[var(--tng-amber-500)]' },
                                    { ref: 'TNG-2026-0002', action: 'Endorsed', time: '1 day ago', color: 'bg-[var(--tng-emerald-500)]' },
                                ].map((item) => (
                                    <div key={item.ref} className="flex items-center gap-3 rounded-xl border border-[var(--tng-slate-100)] px-4 py-3 transition-colors hover:bg-[var(--tng-slate-50)]">
                                        <span className={`h-2 w-2 shrink-0 rounded-full ${item.color}`} />
                                        <span className="text-sm font-semibold text-[var(--tng-blue-600)]">{item.ref}</span>
                                        <span className="text-sm font-medium text-[var(--tng-slate-600)]">{item.action}</span>
                                        <span className="ml-auto text-xs text-[var(--tng-slate-400)]">{item.time}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </TrackngoLayout>
    );
}
