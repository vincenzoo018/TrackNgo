import { Head } from '@inertiajs/react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { BarChart3, TrendingUp, Filter } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { ReportInsights } from '@/components/trackngo/ReportInsights';
import { ReportGenerator } from '@/components/trackngo/ReportGenerator';

const bottleneckData = [
  { name: 'City Engineering', avgDays: 4.5, sla: 3 },
  { name: 'Human Resources', avgDays: 2.1, sla: 3 },
  { name: 'City Legal', avgDays: 5.8, sla: 7 },
  { name: 'Budget Office', avgDays: 1.2, sla: 2 },
  { name: 'Mayor\'s Office', avgDays: 0.8, sla: 2 },
];

const volumeData = [
  { day: 'Mon', volume: 120 },
  { day: 'Tue', volume: 150 },
  { day: 'Wed', volume: 180 },
  { day: 'Thu', volume: 140 },
  { day: 'Fri', volume: 90 },
];

export default function ReceivingReports() {
    return (
        <TrackngoLayout>
            <Head title="Receiving Reports & Analytics — TrackNGo Mati" />

            <div className="flex h-[calc(100vh-140px)] flex-col space-y-6 overflow-y-auto tng-scrollbar pb-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between shrink-0 gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--tng-slate-900)] flex items-center gap-2">
                            <BarChart3 className="h-6 w-6 text-[var(--tng-blue-600)]" />
                            Receiving Reports & Analytics
                        </h1>
                        <p className="mt-0.5 text-sm text-[var(--tng-slate-500)]">
                            TrackNGo Mati — Incoming document insights and processing metrics.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="flex items-center gap-2 rounded-lg border border-[var(--tng-slate-200)] bg-white px-4 py-2 text-sm font-medium text-[var(--tng-slate-700)] hover:bg-[var(--tng-slate-50)] transition-colors">
                            <Filter className="h-4 w-4" /> Filter Date
                        </button>
                        <ReportGenerator label="Export Report" />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
                    <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-semibold text-[var(--tng-slate-600)]">Total Documents Processed</h3>
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--tng-blue-50)] text-[var(--tng-blue-600)]"><BarChart3 className="h-4 w-4" /></div>
                        </div>
                        <div className="text-3xl font-bold text-[var(--tng-slate-900)]">24,592</div>
                        <p className="mt-1 flex items-center text-xs font-medium text-green-600 gap-1"><TrendingUp className="h-3 w-3" /> +12% from last month</p>
                    </div>
                    <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-semibold text-[var(--tng-slate-600)]">System Uptime</h3>
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--tng-emerald-50)] text-[var(--tng-emerald-600)]"><Activity className="h-4 w-4" /></div>
                        </div>
                        <div className="text-3xl font-bold text-[var(--tng-slate-900)]">99.98%</div>
                        <p className="mt-1 flex items-center text-xs font-medium text-[var(--tng-slate-500)]">Operational across all modules</p>
                    </div>
                    <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-semibold text-[var(--tng-slate-600)]">SLA Violations</h3>
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600"><AlertTriangle className="h-4 w-4" /></div>
                        </div>
                        <div className="text-3xl font-bold text-[var(--tng-slate-900)]">14</div>
                        <p className="mt-1 flex items-center text-xs font-medium text-red-600 gap-1"><TrendingUp className="h-3 w-3" /> +3% from last week</p>
                    </div>
                </div>
                
                {/* AI Insights Section */}
                <div className="shrink-0">
                    <ReportInsights bottlenecks={bottleneckData} volume={volumeData} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Bottleneck Heatmap */}
                    <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-6 shadow-sm">
                        <h2 className="mb-6 text-base font-bold text-[var(--tng-slate-800)]">Department Bottleneck Heatmap (Avg Days)</h2>
                        <div className="h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={bottleneckData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" />
                                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                                    <Tooltip cursor={{ fill: 'transparent' }} />
                                    <Legend />
                                    <Bar dataKey="avgDays" name="Avg Processing Days" fill="var(--tng-blue-500)" radius={[0, 4, 4, 0]} />
                                    <Bar dataKey="sla" name="Legal SLA Limit" fill="var(--tng-slate-300)" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Volume Trend */}
                    <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-6 shadow-sm">
                        <h2 className="mb-6 text-base font-bold text-[var(--tng-slate-800)]">Weekly Document Volume Trend</h2>
                        <div className="h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={volumeData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="day" />
                                    <YAxis />
                                    <Tooltip />
                                    <Line type="monotone" dataKey="volume" name="Incoming Docs" stroke="var(--tng-emerald-500)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        </TrackngoLayout>
    );
}

const Activity = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.48 12H2"/></svg>
);
const AlertTriangle = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
);
