import { CheckCheck, FileInput, MapPin, Send } from 'lucide-react';
import type { TimelineStop } from '@/lib/cart';
import { formatDateTime } from '@/lib/cart';
import { cn } from '@/lib/utils';

/**
 * Where the document has been: filed → each handler (with how long they held it) → completed.
 */
export function TrackingTimeline({ stops }: { stops: TimelineStop[] }) {
    if (stops.length === 0) {
        return <p className="text-sm text-slate-500">No routing recorded yet.</p>;
    }

    return (
        <ol className="relative">
            {stops.map((stop, index) => {
                const isLast = index === stops.length - 1;
                const Icon = stop.kind === 'filed' ? FileInput : stop.kind === 'completed' ? CheckCheck : stop.is_current ? MapPin : Send;
                const meta = [stop.role, stop.department].filter(Boolean).join(' · ');

                return (
                    <li key={`${stop.kind}-${index}`} className="relative flex gap-3 pb-5 last:pb-0">
                        {!isLast && <span className="absolute top-7 bottom-0 left-[13px] w-px bg-slate-200" aria-hidden />}
                        <span
                            className={cn(
                                'relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-4 ring-white',
                                stop.is_current
                                    ? 'bg-[#0066cc] text-white'
                                    : stop.kind === 'completed'
                                      ? 'bg-emerald-500 text-white'
                                      : 'bg-slate-100 text-slate-500',
                            )}
                        >
                            <Icon className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1 pt-0.5">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                                <p className="text-[13px] font-semibold text-slate-900">{stop.kind === 'completed' ? 'Completed' : (stop.actor ?? stop.title)}</p>
                                <time className="text-xs whitespace-nowrap text-slate-500">{formatDateTime(stop.at)}</time>
                            </div>
                            {meta && <p className="text-xs text-slate-500">{meta}</p>}
                            {stop.kind !== 'completed' && (
                                <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-600">
                                    <span>{stop.title}</span>
                                    {stop.duration && (
                                        <span
                                            className={cn(
                                                'rounded px-1.5 py-0.5 font-medium',
                                                stop.is_current ? 'bg-blue-50 text-[#0066cc]' : 'bg-slate-100 text-slate-600',
                                            )}
                                        >
                                            {stop.is_current ? `With them for ${stop.duration}` : `Held ${stop.duration}`}
                                        </span>
                                    )}
                                </p>
                            )}
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}

export default TrackingTimeline;
