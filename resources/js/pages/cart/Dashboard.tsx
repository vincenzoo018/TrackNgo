import { Head, Link } from '@inertiajs/react';
import { ShieldAlert, Bell, MessageSquare, Activity, Settings, FileText, Route, PieChart } from 'lucide-react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { StatCard } from '@/components/trackngo/StatCard';
import { SlaAlert } from '@/components/trackngo/SlaAlert';
import { QuickLinks } from '@/components/trackngo/QuickLinks';
import { AnalyticsCharts } from '@/components/trackngo/AnalyticsCharts';
import { mockEscalations, mockBottlenecks, mockStatusDistribution } from '@/lib/mock-data';

export default function CartDashboard() {
    return (
        <TrackngoLayout>
            <Head title="CART Dashboard — TrackNGo Mati" />

            <div className="space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--tng-slate-900)]">CART Oversight Dashboard</h1>
                        <p className="mt-0.5 text-sm text-[var(--tng-slate-500)]">
                            Committee on Anti-Red Tape monitoring and compliance
                        </p>
                    </div>
                    <Link href="/cart/escalations/rules" className="flex items-center gap-2 rounded-lg border border-[var(--tng-slate-200)] bg-white px-4 py-2 text-sm font-medium text-[var(--tng-slate-600)] hover:bg-[var(--tng-slate-50)]">
                        <Settings className="h-4 w-4" />
                        Configure Rules
                    </Link>
                </div>

                <SlaAlert
                    variant="breach"
                    title="Critical ARTA Violations"
                    message="2 documents have exceeded their maximum processing time (20 days)."
                    actionLabel="Review Escalations"
                />

                <div className="tng-stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard label="Active Escalations" value={mockEscalations.length} subtitle="Requires intervention" icon={ShieldAlert} color="red" />
                    <StatCard label="Warnings Sent" value={12} subtitle="Approaching SLA" icon={Bell} color="amber" />
                    <StatCard label="SMS Delivered" value={145} subtitle="This month" icon={MessageSquare} color="blue" />
                    <StatCard label="Resolved" value={8} subtitle="Escalations closed" icon={Activity} color="emerald" />
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-2 min-w-0 flex flex-col gap-6">
                        <AnalyticsCharts bottlenecks={mockBottlenecks} distribution={mockStatusDistribution} />

                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            {/* Recent Escalations */}
                            <div className="rounded-2xl border border-[var(--tng-slate-200)] bg-white p-6 shadow-sm">
                                <div className="mb-4 flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-[var(--tng-slate-800)] flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-red-500" />
                                        Recent Escalations
                                    </h3>
                                    <Link href="/cart/escalations" className="text-xs font-medium text-[var(--tng-blue-600)] hover:underline">View All</Link>
                                </div>
                                <div className="space-y-3">
                                    {mockEscalations.map((esc) => (
                                        <div key={esc.id} className="flex items-center justify-between rounded-xl border border-[var(--tng-slate-100)] p-4 transition-colors hover:bg-[var(--tng-slate-50)]">
                                            <div>
                                                <p className="text-sm font-semibold text-[var(--tng-blue-600)]">{esc.document?.reference_number}</p>
                                                <p className="mt-1 text-xs text-[var(--tng-slate-500)]">Threshold: {esc.arta_threshold} Days</p>
                                            </div>
                                            <div className="text-right">
                                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase
                                                    ${esc.escalation_level === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}
                                                `}>
                                                    {esc.escalation_level}
                                                </span>
                                                <p className="mt-1 text-xs font-medium text-[var(--tng-slate-700)]">{esc.days_elapsed} Days Elapsed</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Department Compliance Rankings */}
                            <div className="rounded-2xl border border-[var(--tng-slate-200)] bg-white p-6 shadow-sm">
                                <h3 className="mb-5 text-sm font-semibold text-[var(--tng-slate-800)] flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-orange-500" />
                                    Department Compliance (Top Violators)
                                </h3>
                                <div className="space-y-5">
                                    {[
                                        { dept: 'City Engineering Office', count: 4, color: 'bg-red-500', width: 'w-full' },
                                        { dept: 'HR Management', count: 2, color: 'bg-orange-500', width: 'w-3/4' },
                                        { dept: 'Admin Office', count: 1, color: 'bg-amber-500', width: 'w-1/2' },
                                    ].map((item) => (
                                        <div key={item.dept}>
                                            <div className="mb-2 flex justify-between text-xs font-medium">
                                                <span className="text-[var(--tng-slate-700)]">{item.dept}</span>
                                                <span className="text-[var(--tng-slate-500)]">{item.count} escalations</span>
                                            </div>
                                            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--tng-slate-100)]">
                                                <div className={`h-full rounded-full ${item.color} ${item.width}`} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="lg:col-span-1">
                        <QuickLinks 
                            title="CART Modules"
                            links={[
                                { title: 'Escalations', href: '/cart/escalations', icon: ShieldAlert, color: 'text-red-600 bg-red-50' },
                                { title: 'All Documents', href: '/cart/documents', icon: FileText, color: 'text-blue-600 bg-blue-50' },
                                { title: 'SMS Dashboard', href: '/cart/notifications/sms', icon: MessageSquare, color: 'text-emerald-600 bg-emerald-50' },
                                { title: 'Audit Trail', href: '/cart/audit-trail', icon: Activity, color: 'text-amber-600 bg-amber-50' },
                                { title: 'Reports', href: '/cart/reports', icon: PieChart, color: 'text-indigo-600 bg-indigo-50' },
                                { title: 'Routing Slips', href: '/cart/routing-slips', icon: Route, color: 'text-purple-600 bg-purple-50' },
                            ]}
                        />
                    </div>
                </div>
            </div>
        </TrackngoLayout>
    );
}
