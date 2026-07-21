import React from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend
} from 'recharts';

interface BottleneckData {
    stage: string;
    count: number;
}

interface StatusDistribution {
    label: string;
    value: number;
    color: string;
}

interface AnalyticsChartsProps {
    bottlenecks: BottleneckData[];
    distribution: StatusDistribution[];
}

export function AnalyticsCharts({ bottlenecks, distribution }: AnalyticsChartsProps) {
    // Custom tooltip for BarChart
    const CustomBarTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="rounded-lg border border-[var(--tng-slate-200)] bg-white/95 p-3 shadow-lg backdrop-blur-sm">
                    <p className="mb-1 text-xs font-semibold text-[var(--tng-slate-500)]">{label}</p>
                    <p className="text-sm font-bold text-[var(--tng-blue-600)]">
                        {payload[0].value} <span className="font-normal text-[var(--tng-slate-600)]">documents</span>
                    </p>
                </div>
            );
        }
        return null;
    };

    // Custom tooltip for PieChart
    const CustomPieTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="rounded-lg border border-[var(--tng-slate-200)] bg-white/95 p-3 shadow-lg backdrop-blur-sm flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: payload[0].payload.color }} />
                    <p className="text-sm font-medium text-[var(--tng-slate-800)]">
                        {payload[0].name}: <span className="font-bold">{payload[0].value}%</span>
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Active Bottlenecks (Bar Chart) */}
            <div className="flex flex-col rounded-2xl border border-[var(--tng-slate-200)] bg-white p-6 shadow-sm">
                <div className="mb-6">
                    <h3 className="text-sm font-semibold text-[var(--tng-slate-800)] flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-[var(--tng-amber-500)]" />
                        Active Bottlenecks
                    </h3>
                    <p className="mt-1 text-xs text-[var(--tng-slate-500)]">Documents pending per stage</p>
                </div>
                <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={bottlenecks}
                            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                            layout="vertical"
                        >
                            <defs>
                                <linearGradient id="colorCount" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="var(--tng-blue-500)" stopOpacity={1} />
                                    <stop offset="100%" stopColor="var(--tng-indigo-500)" stopOpacity={1} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--tng-slate-100)" />
                            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--tng-slate-400)' }} />
                            <YAxis 
                                type="category" 
                                dataKey="stage" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 12, fill: 'var(--tng-slate-600)' }}
                                width={120}
                            />
                            <RechartsTooltip cursor={{ fill: 'var(--tng-slate-50)' }} content={<CustomBarTooltip />} />
                            <Bar dataKey="count" fill="url(#colorCount)" radius={[0, 4, 4, 0]} barSize={24} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Status Distribution (Donut Chart) */}
            <div className="flex flex-col rounded-2xl border border-[var(--tng-slate-200)] bg-white p-6 shadow-sm">
                <div className="mb-2">
                    <h3 className="text-sm font-semibold text-[var(--tng-slate-800)] flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-[var(--tng-emerald-500)]" />
                        Status Distribution
                    </h3>
                    <p className="mt-1 text-xs text-[var(--tng-slate-500)]">System-wide processing state</p>
                </div>
                <div className="h-[300px] w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={distribution}
                                cx="50%"
                                cy="50%"
                                innerRadius={70}
                                outerRadius={95}
                                paddingAngle={5}
                                dataKey="value"
                                nameKey="label"
                                stroke="none"
                            >
                                {distribution.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <RechartsTooltip content={<CustomPieTooltip />} />
                            <Legend 
                                verticalAlign="bottom" 
                                height={36} 
                                iconType="circle"
                                wrapperStyle={{ fontSize: '13px', color: 'var(--tng-slate-700)' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                    {/* Center Text */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                        <span className="text-3xl font-bold text-[var(--tng-slate-900)]">100%</span>
                        <span className="text-xs font-medium text-[var(--tng-slate-500)]">Total Share</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
