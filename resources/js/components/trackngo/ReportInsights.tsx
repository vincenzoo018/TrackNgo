import { Sparkles } from 'lucide-react';

interface Bottleneck {
    name: string;
    avgDays: number;
    sla: number;
}

interface Volume {
    day: string;
    volume: number;
}

interface ReportInsightsProps {
    bottlenecks?: Bottleneck[];
    volume?: Volume[];
    title?: string;
}

export function ReportInsights({ bottlenecks = [], volume = [], title = "AI Analytics Insights" }: ReportInsightsProps) {
    // Generate dynamic insights based on data
    const generateInsights = () => {
        const insights = [];

        // Bottleneck analysis
        if (bottlenecks.length > 0) {
            const worstOffender = [...bottlenecks].sort((a, b) => (b.avgDays - b.sla) - (a.avgDays - a.sla))[0];
            const exceedSla = worstOffender.avgDays - worstOffender.sla;
            if (exceedSla > 0) {
                insights.push(`The ${worstOffender.name} is currently experiencing the highest processing delay, exceeding its SLA by ${exceedSla.toFixed(1)} days on average.`);
            } else {
                insights.push(`All departments are currently operating within their specified SLA limits.`);
            }
        }

        // Volume analysis
        if (volume.length > 0) {
            const peakDay = [...volume].sort((a, b) => b.volume - a.volume)[0];
            const totalVolume = volume.reduce((sum, item) => sum + item.volume, 0);
            const avgVolume = Math.round(totalVolume / volume.length);
            
            insights.push(`Document volume peaked on ${peakDay.day} with ${peakDay.volume} submissions. The weekly average sits at ${avgVolume} documents per day.`);
        }

        if (insights.length === 0) {
            insights.push("No significant insights could be generated from the current dataset.");
        }

        return insights;
    };

    const insights = generateInsights();

    return (
        <div className="rounded-2xl border border-[var(--tng-blue-200)] bg-gradient-to-br from-[var(--tng-blue-50)] to-white p-6 shadow-sm">
            <h3 className="mb-4 text-sm font-bold text-[var(--tng-blue-900)] flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-[var(--tng-blue-500)]" />
                {title}
            </h3>
            <ul className="space-y-3">
                {insights.map((insight, index) => (
                    <li key={index} className="flex gap-3 text-sm text-[var(--tng-slate-700)] leading-relaxed">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--tng-blue-500)]" />
                        <span>{insight}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
