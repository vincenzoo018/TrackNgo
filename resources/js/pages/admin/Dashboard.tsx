import { Head, Link } from '@inertiajs/react';
import { Users, FolderOpen, Archive, Activity } from 'lucide-react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { StatCard } from '@/components/trackngo/StatCard';
import { QuickLinks } from '@/components/trackngo/QuickLinks';
import { AnalyticsCharts } from '@/components/trackngo/AnalyticsCharts';
import { mockUsers, mockDepartments, mockDocumentTypes, mockAuditTrail, mockBottlenecks, mockStatusDistribution } from '@/lib/mock-data';

export default function AdminDashboard() {
    return (
        <TrackngoLayout>
            <Head title="Admin Dashboard — TrackNGo Mati" />

            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--tng-slate-900)]">System Administration</h1>
                    <p className="mt-0.5 text-sm text-[var(--tng-slate-500)]">
                        Manage users, departments, categories, and system settings
                    </p>
                </div>

                <div className="tng-stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard label="Total Users" value={mockUsers.length} subtitle="Active accounts" icon={Users} color="blue" />
                    <StatCard label="Departments" value={mockDepartments.length} subtitle="Registered offices" icon={FolderOpen} color="emerald" />
                    <StatCard label="Doc Categories" value={mockDocumentTypes.length} subtitle="Configured types" icon={Archive} color="amber" />
                    <StatCard label="Audit Logs" value={mockAuditTrail.length} subtitle="Recorded events" icon={Activity} color="purple" />
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <QuickLinks 
                        title="Quick Management Links"
                        links={[
                            { title: 'Manage Users', href: '/admin/users', icon: Users, color: 'text-blue-600 bg-blue-50' },
                            { title: 'Manage Departments', href: '/admin/departments', icon: FolderOpen, color: 'text-emerald-600 bg-emerald-50' },
                            { title: 'Manage Categories', href: '/admin/categories', icon: Archive, color: 'text-amber-600 bg-amber-50' },
                            { title: 'System Settings', href: '/admin/settings', icon: Activity, color: 'text-purple-600 bg-purple-50' },
                        ]}
                    />

                    {/* Recent System Activity */}
                    <div className="rounded-2xl border border-[var(--tng-slate-200)] bg-white p-6 shadow-sm flex flex-col max-h-[450px]">
                        <h3 className="mb-5 text-sm font-semibold text-[var(--tng-slate-800)] flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-[var(--tng-purple-500)]" />
                            Recent System Activity
                        </h3>
                        <div className="space-y-4 overflow-y-auto pr-2 tng-scrollbar">
                            {mockAuditTrail.slice(0, 10).map((entry) => (
                                <div key={entry.id} className="flex gap-3 group">
                                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--tng-slate-300)] group-hover:bg-[var(--tng-purple-500)] transition-colors" />
                                    <div>
                                        <p className="text-sm font-medium text-[var(--tng-slate-800)] leading-tight">
                                            {entry.user} <span className="font-normal text-[var(--tng-slate-500)]">performed</span> {entry.action}
                                        </p>
                                        <p className="text-xs text-[var(--tng-slate-400)] mt-0.5">{new Date(entry.timestamp).toLocaleString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="pt-2">
                    <AnalyticsCharts bottlenecks={mockBottlenecks} distribution={mockStatusDistribution} />
                </div>
            </div>
        </TrackngoLayout>
    );
}
