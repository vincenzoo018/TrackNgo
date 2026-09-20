import { Head } from '@inertiajs/react';
import { BarChart3, Download, FileSpreadsheet, PieChart, TrendingUp } from 'lucide-react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';

export default function Reports() {
    return (
        <TrackngoLayout role="cart">
            <Head title="System Reports" />

            <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[var(--tng-slate-900)]">System Reports</h1>
                    <p className="mt-1 text-[var(--tng-slate-500)]">Generate and view system-wide analytics and performance metrics</p>
                </div>
                <div className="flex gap-2">
                    <button className="flex items-center gap-2 rounded-lg bg-[#0066cc] px-4 py-2 text-[14px] font-medium text-white shadow-xs transition-colors hover:bg-[#005bb5]">
                        <FileSpreadsheet className="h-4 w-4" />
                        Export CSV
                    </button>
                    <button className="flex items-center gap-2 rounded-lg bg-[#0066cc] px-4 py-2 text-[14px] font-medium text-white shadow-xs transition-colors hover:bg-[#005bb5]">
                        <Download className="h-4 w-4" />
                        Download Report
                    </button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3 mb-8">
                <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="rounded-lg bg-blue-50 p-3 text-blue-600">
                            <TrendingUp className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-[var(--tng-slate-500)]">Total Documents Processed</p>
                            <p className="text-2xl font-bold text-[var(--tng-slate-900)]">1,248</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="rounded-lg bg-emerald-50 p-3 text-emerald-600">
                            <PieChart className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-[var(--tng-slate-500)]">Overall ARTA Compliance</p>
                            <p className="text-2xl font-bold text-[var(--tng-slate-900)]">94.2%</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="rounded-lg bg-purple-50 p-3 text-purple-600">
                            <BarChart3 className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-[var(--tng-slate-500)]">Average Processing Time</p>
                            <p className="text-2xl font-bold text-[var(--tng-slate-900)]">2.4 Days</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white shadow-sm overflow-hidden flex flex-col">
                    <div className="border-b border-[var(--tng-slate-200)] px-6 py-4">
                        <h3 className="text-[18px] font-medium text-[#0066cc]">Department Performance</h3>
                    </div>
                    <div className="p-6 flex-1 flex items-center justify-center bg-[var(--tng-slate-50)]">
                        <p className="text-[var(--tng-slate-500)] text-sm flex flex-col items-center gap-2">
                            <BarChart3 className="w-8 h-8 opacity-20" />
                            Chart visualization will be rendered here
                        </p>
                    </div>
                </div>
                <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white shadow-sm overflow-hidden flex flex-col">
                    <div className="border-b border-[var(--tng-slate-200)] px-6 py-4">
                        <h3 className="text-[18px] font-medium text-[#0066cc]">Document Types Breakdown</h3>
                    </div>
                    <div className="p-6 flex-1 flex items-center justify-center bg-[var(--tng-slate-50)]">
                        <p className="text-[var(--tng-slate-500)] text-sm flex flex-col items-center gap-2">
                            <PieChart className="w-8 h-8 opacity-20" />
                            Chart visualization will be rendered here
                        </p>
                    </div>
                </div>
            </div>
        </TrackngoLayout>
    );
}

