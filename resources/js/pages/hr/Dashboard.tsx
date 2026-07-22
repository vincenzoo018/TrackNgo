import { Head } from '@inertiajs/react';
import { Users, FileText, CalendarDays, ClipboardCheck, UserPlus, Route } from 'lucide-react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { StatCard } from '@/components/trackngo/StatCard';
import { SlaAlert } from '@/components/trackngo/SlaAlert';
import { QuickLinks } from '@/components/trackngo/QuickLinks';
import { AnalyticsCharts } from '@/components/trackngo/AnalyticsCharts';
import { mockBottlenecks, mockStatusDistribution } from '@/lib/mock-data';

export default function HrDashboard() {
    return (
        <TrackngoLayout>
            <Head title="HR Dashboard — TrackNGo Mati" />

            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--tng-slate-900)]">Human Resources Dashboard</h1>
                    <p className="mt-0.5 text-sm text-[var(--tng-slate-500)]">
                        Employee records, leave management, and HR document tracking
                    </p>
                </div>

                <SlaAlert
                    variant="action"
                    title="Pending Leave Requests"
                    message="You have 5 pending leave requests awaiting your review and approval."
                    actionLabel="Review Requests"
                />

                <div className="tng-stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard label="Total Employees" value={248} subtitle="Active personnel" icon={Users} color="blue" />
                    <StatCard label="HR Documents" value={34} subtitle="This month" icon={FileText} color="emerald" />
                    <StatCard label="Leave Requests" value={5} subtitle="Pending approval" icon={CalendarDays} color="amber" />
                    <StatCard label="Onboarding" value={3} subtitle="New hires this month" icon={UserPlus} color="purple" />
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-2 min-w-0">
                        <AnalyticsCharts bottlenecks={mockBottlenecks} distribution={mockStatusDistribution} />
                    </div>

                    <div className="lg:col-span-1 flex flex-col gap-6">
                        <QuickLinks
                            title="HR Modules"
                            links={[
                                { title: 'HR Documents', href: '/hr/documents', icon: FileText, color: 'text-blue-600 bg-blue-50' },
                                { title: 'Employee Records', href: '/hr/employees', icon: Users, color: 'text-emerald-600 bg-emerald-50' },
                                { title: 'Leave Management', href: '/hr/leave', icon: CalendarDays, color: 'text-amber-600 bg-amber-50' },
                                { title: 'Routing Slips', href: '/hr/routing-slips', icon: Route, color: 'text-purple-600 bg-purple-50' },
                            ]}
                        />

                        {/* Recent HR Activity */}
                        <div className="rounded-2xl border border-[var(--tng-slate-200)] bg-white p-6 shadow-sm flex-1">
                            <h3 className="mb-4 text-sm font-semibold text-[var(--tng-slate-800)] flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-[var(--tng-teal-500, #14b8a6)]" />
                                Recent HR Activity
                            </h3>
                            <div className="space-y-3">
                                {[
                                    { ref: 'HR-2026-0012', action: 'Leave Approved', who: 'Maria Santos', time: '2 hours ago', color: 'bg-emerald-500' },
                                    { ref: 'HR-2026-0011', action: 'Document Filed', who: 'Juan Dela Cruz', time: '5 hours ago', color: 'bg-blue-500' },
                                    { ref: 'HR-2026-0010', action: 'Onboarding Started', who: 'Ana Reyes', time: '1 day ago', color: 'bg-purple-500' },
                                ].map((item) => (
                                    <div key={item.ref} className="flex items-center gap-3 rounded-xl border border-[var(--tng-slate-100)] px-4 py-3 transition-colors hover:bg-[var(--tng-slate-50)]">
                                        <span className={`h-2 w-2 shrink-0 rounded-full ${item.color}`} />
                                        <span className="text-sm font-semibold text-[var(--tng-blue-600)]">{item.ref}</span>
                                        <span className="text-sm font-medium text-[var(--tng-slate-600)] line-clamp-1">{item.action} — {item.who}</span>
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
