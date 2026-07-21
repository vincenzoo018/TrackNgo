import { Head } from '@inertiajs/react';
import { FileCheck, CheckCircle2, RotateCcw, PenTool, Route, FileText } from 'lucide-react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { StatCard } from '@/components/trackngo/StatCard';
import { SlaAlert } from '@/components/trackngo/SlaAlert';
import { QuickLinks } from '@/components/trackngo/QuickLinks';
import { AnalyticsCharts } from '@/components/trackngo/AnalyticsCharts';
import { mockBottlenecks, mockStatusDistribution } from '@/lib/mock-data';

export default function MayorDashboard() {
    return (
        <TrackngoLayout>
            <Head title="Mayor Dashboard — TrackNGo Mati" />

            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--tng-slate-900)]">Office of the Mayor Dashboard</h1>
                    <p className="mt-0.5 text-sm text-[var(--tng-slate-500)]">
                        Final approval monitoring and document sign-offs
                    </p>
                </div>

                <SlaAlert
                    variant="action"
                    title="Pending Final Approval"
                    message="You have 2 documents awaiting your final signature and approval."
                    actionLabel="View Documents"
                />

                <div className="tng-stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard label="Pending Approval" value={2} subtitle="Awaiting signature" icon={FileCheck} color="amber" />
                    <StatCard label="Approved" value={45} subtitle="This month" icon={CheckCircle2} color="emerald" />
                    <StatCard label="Returned" value={3} subtitle="Needs revision" icon={RotateCcw} color="red" />
                    <StatCard label="Digital Signatures" value={45} subtitle="Applied this month" icon={PenTool} color="blue" />
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
                    <div className="flex flex-col gap-6 w-full max-w-full min-w-0 overflow-hidden">
                        <AnalyticsCharts bottlenecks={mockBottlenecks} distribution={mockStatusDistribution} />
                    </div>
                    
                    <div className="flex flex-col gap-6">
                        <QuickLinks 
                            title="Mayor Modules"
                            links={[
                                { title: 'Final Approvals', href: '/mayor/documents', icon: FileCheck, color: 'text-emerald-600 bg-emerald-50' },
                                { title: 'My Signature', href: '/mayor/signature', icon: PenTool, color: 'text-amber-600 bg-amber-50' },
                                { title: 'Routing Slips', href: '/mayor/routing-slips', icon: Route, color: 'text-purple-600 bg-purple-50' },
                            ]}
                        />

                        {/* Recent Approvals */}
                        <div className="rounded-2xl border border-[var(--tng-slate-200)] bg-white p-6 shadow-sm flex-1">
                            <h3 className="mb-4 text-sm font-semibold text-[var(--tng-slate-800)] flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-[var(--tng-emerald-500)]" />
                                Recent Approvals
                            </h3>
                            <div className="space-y-3">
                                {[
                                    { ref: 'TNG-2026-0001', title: 'Leave Application - Juan Dela Cruz', time: '1 day ago', color: 'bg-[var(--tng-emerald-500)]' },
                                    { ref: 'TNG-2025-0150', title: 'Procurement Request - IT Equipment', time: '2 days ago', color: 'bg-[var(--tng-emerald-500)]' },
                                ].map((item) => (
                                    <div key={item.ref} className="flex items-center gap-3 rounded-xl border border-[var(--tng-slate-100)] px-4 py-3 transition-colors hover:bg-[var(--tng-slate-50)]">
                                        <span className={`h-2 w-2 shrink-0 rounded-full ${item.color}`} />
                                        <span className="text-sm font-semibold text-[var(--tng-blue-600)]">{item.ref}</span>
                                        <span className="text-sm font-medium text-[var(--tng-slate-600)] line-clamp-1">{item.title}</span>
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
