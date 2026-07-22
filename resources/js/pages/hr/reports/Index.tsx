import { Head } from '@inertiajs/react';
import { BarChart3, Download, Calendar } from 'lucide-react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';

const mockReportData = [
    { month: 'Jan', hired: 5, resigned: 1, leaves: 12 },
    { month: 'Feb', hired: 3, resigned: 2, leaves: 15 },
    { month: 'Mar', hired: 4, resigned: 0, leaves: 10 },
    { month: 'Apr', hired: 2, resigned: 1, leaves: 18 },
    { month: 'May', hired: 6, resigned: 3, leaves: 22 },
    { month: 'Jun', hired: 1, resigned: 1, leaves: 20 },
    { month: 'Jul', hired: 3, resigned: 0, leaves: 14 },
];

const maxLeaves = Math.max(...mockReportData.map(d => d.leaves));

export default function HrReports() {
    return (
        <TrackngoLayout>
            <Head title="HR Reports — TrackNGo Mati" />

            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--tng-slate-900)]">HR Reports</h1>
                        <p className="mt-0.5 text-sm text-[var(--tng-slate-500)]">
                            Workforce analytics, leave usage, and personnel reports
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="flex items-center gap-2 rounded-lg border border-[var(--tng-slate-200)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--tng-slate-600)] hover:bg-[var(--tng-slate-50)]">
                            <Calendar className="h-4 w-4" />
                            This Year
                        </button>
                        <button className="flex items-center gap-2 rounded-lg border border-[var(--tng-slate-200)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--tng-slate-600)] hover:bg-[var(--tng-slate-50)]">
                            <Download className="h-4 w-4" />
                            Export
                        </button>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-2xl border border-[var(--tng-slate-200)] bg-white p-5 shadow-sm">
                        <p className="text-xs font-medium uppercase tracking-wider text-[var(--tng-slate-500)]">Total Hired (YTD)</p>
                        <p className="mt-2 text-3xl font-bold text-[var(--tng-slate-900)]">24</p>
                        <p className="mt-1 text-xs text-emerald-600">↑ 12% from last year</p>
                    </div>
                    <div className="rounded-2xl border border-[var(--tng-slate-200)] bg-white p-5 shadow-sm">
                        <p className="text-xs font-medium uppercase tracking-wider text-[var(--tng-slate-500)]">Total Resigned (YTD)</p>
                        <p className="mt-2 text-3xl font-bold text-[var(--tng-slate-900)]">8</p>
                        <p className="mt-1 text-xs text-red-600">↑ 3% from last year</p>
                    </div>
                    <div className="rounded-2xl border border-[var(--tng-slate-200)] bg-white p-5 shadow-sm">
                        <p className="text-xs font-medium uppercase tracking-wider text-[var(--tng-slate-500)]">Leave Usage (YTD)</p>
                        <p className="mt-2 text-3xl font-bold text-[var(--tng-slate-900)]">111</p>
                        <p className="mt-1 text-xs text-[var(--tng-slate-500)]">Across all departments</p>
                    </div>
                    <div className="rounded-2xl border border-[var(--tng-slate-200)] bg-white p-5 shadow-sm">
                        <p className="text-xs font-medium uppercase tracking-wider text-[var(--tng-slate-500)]">Retention Rate</p>
                        <p className="mt-2 text-3xl font-bold text-emerald-600">96.8%</p>
                        <p className="mt-1 text-xs text-[var(--tng-slate-500)]">Current year</p>
                    </div>
                </div>

                {/* Leave Usage Chart (Simple Bar) */}
                <div className="rounded-2xl border border-[var(--tng-slate-200)] bg-white p-6 shadow-sm">
                    <h3 className="mb-6 text-sm font-semibold text-[var(--tng-slate-800)] flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-[var(--tng-blue-600)]" />
                        Monthly Leave Usage — 2026
                    </h3>
                    <div className="flex items-end gap-3 h-48">
                        {mockReportData.map((d) => (
                            <div key={d.month} className="flex flex-1 flex-col items-center gap-2">
                                <span className="text-xs font-semibold text-[var(--tng-slate-700)]">{d.leaves}</span>
                                <div
                                    className="w-full rounded-t-lg bg-gradient-to-t from-teal-500 to-teal-400 transition-all hover:from-teal-600 hover:to-teal-500"
                                    style={{ height: `${(d.leaves / maxLeaves) * 100}%`, minHeight: '8px' }}
                                />
                                <span className="text-xs text-[var(--tng-slate-500)]">{d.month}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Hiring & Resignation Table */}
                <div className="rounded-2xl border border-[var(--tng-slate-200)] bg-white shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-[var(--tng-slate-200)]">
                        <h3 className="text-sm font-semibold text-[var(--tng-slate-800)]">Monthly Hiring & Resignation Summary</h3>
                    </div>
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)]">
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">Month</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">Hired</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">Resigned</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">Leaves Used</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">Net Change</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--tng-slate-100)]">
                            {mockReportData.map((d) => (
                                <tr key={d.month} className="transition-colors hover:bg-[var(--tng-slate-50)]">
                                    <td className="px-6 py-4 text-sm font-medium text-[var(--tng-slate-800)]">{d.month} 2026</td>
                                    <td className="px-6 py-4 text-sm font-semibold text-emerald-600">+{d.hired}</td>
                                    <td className="px-6 py-4 text-sm font-semibold text-red-600">-{d.resigned}</td>
                                    <td className="px-6 py-4 text-sm text-[var(--tng-slate-600)]">{d.leaves}</td>
                                    <td className="px-6 py-4">
                                        <span className={`text-sm font-bold ${d.hired - d.resigned >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {d.hired - d.resigned >= 0 ? '+' : ''}{d.hired - d.resigned}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </TrackngoLayout>
    );
}
