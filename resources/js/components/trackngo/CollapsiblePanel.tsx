import React, { useState, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';

type Props = {
    title: string | ReactNode;
    children: ReactNode;
    className?: string;
    defaultExpanded?: boolean;
    headerAction?: ReactNode;
};

export function CollapsiblePanel({ title, children, className, defaultExpanded = true, headerAction }: Props) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    return (
        <div className={cn("rounded-xl border border-[var(--tng-slate-200)] bg-white overflow-hidden", className)}>
            <div 
                className="flex items-center justify-between p-6 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <h2 className="text-base font-semibold text-[var(--tng-slate-800)] flex-1">
                    {title}
                </h2>
                <div className="flex items-center gap-4">
                    {headerAction && (
                        <div onClick={(e) => e.stopPropagation()}>
                            {headerAction}
                        </div>
                    )}
                    <div className="text-[var(--tng-slate-400)]">
                        {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </div>
                </div>
            </div>
            
            {isExpanded && (
                <div className="px-6 pb-6 border-t border-[var(--tng-slate-100)] pt-4">
                    {children}
                </div>
            )}
        </div>
    );
}
