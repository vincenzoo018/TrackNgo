import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { WORKFLOW_STEPS } from '@/types/trackngo';

type StepProgressProps = {
    currentStep: number; // 1-indexed (1 to 6)
    totalSteps?: number;
    className?: string;
    currentHolderName?: string;
    auditTrails?: any[];
};

export function StepProgress({
    currentStep,
    totalSteps = 6,
    className,
    currentHolderName,
    auditTrails = [],
}: StepProgressProps) {
    const steps = WORKFLOW_STEPS.slice(0, totalSteps);

    return (
        <div className={cn('w-full overflow-x-auto py-2', className)}>
            <div className="flex items-center min-w-[580px] sm:min-w-full px-2">
                {steps.map((step, idx) => {
                    const stepNum = idx + 1;
                    const isCompleted = stepNum < currentStep;
                    const isCurrent = stepNum === currentStep;
                    const isPending = stepNum > currentStep;

                    // Actor name if available in audit trails
                    const matchingAudit = auditTrails.slice().reverse().find(a => a.action === step.key);
                    const actorName = matchingAudit?.user?.name || matchingAudit?.user_name || matchingAudit?.user;

                    return (
                        <div key={step.key} className="flex flex-1 items-center">
                            {/* Step Circle + Label */}
                            <div className="flex flex-col items-center relative flex-1">
                                <div
                                    className={cn(
                                        'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 select-none',
                                        isCompleted && 'bg-[#0066cc] text-white shadow-xs',
                                        isCurrent && 'border-2 border-[#0066cc] bg-white text-[#0066cc] shadow-md shadow-[#0066cc]/20 ring-4 ring-[#0066cc]/10',
                                        isPending && 'border-2 border-slate-200 bg-white text-slate-400'
                                    )}
                                    aria-current={isCurrent ? 'step' : undefined}
                                >
                                    {isCompleted ? <Check className="h-4 w-4 stroke-[2.5]" /> : stepNum}
                                </div>
                                <span
                                    className={cn(
                                        'mt-2 text-[12px] whitespace-nowrap tracking-tight',
                                        isCompleted && 'text-[#0066cc] font-semibold',
                                        isCurrent && 'text-slate-900 font-bold',
                                        isPending && 'text-slate-400 font-normal'
                                    )}
                                >
                                    {step.label}
                                </span>

                                {actorName && (isCompleted || isCurrent) ? (
                                    <span className="mt-0.5 text-[10px] text-slate-500 whitespace-nowrap max-w-[100px] truncate">
                                        {actorName}
                                    </span>
                                ) : isCurrent && currentHolderName ? (
                                    <span className="mt-0.5 text-[10px] font-medium text-blue-700 whitespace-nowrap bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 max-w-[120px] truncate">
                                        {currentHolderName}
                                    </span>
                                ) : (
                                    <span className="mt-0.5 text-[10px] text-transparent select-none">
                                        &nbsp;
                                    </span>
                                )}
                            </div>

                            {/* Connector Line */}
                            {idx < steps.length - 1 && (
                                <div className="mx-1.5 mb-7 h-0.5 flex-1 min-w-[24px]">
                                    <div
                                        className={cn(
                                            'h-full rounded-full transition-all duration-500',
                                            stepNum < currentStep ? 'bg-[#0066cc]' : 'bg-slate-200'
                                        )}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/**
 * Dot-style step progress for table rows (compact view)
 */
type StepDotsProps = {
    current: number;
    total: number;
    className?: string;
};

export function StepDots({ current, total, className }: StepDotsProps) {
    return (
        <div className={cn('flex items-center gap-0.5', className)}>
            <span className="mr-1 text-[#0066cc]">●</span>
            {Array.from({ length: total }, (_, i) => (
                <span
                    key={i}
                    className={cn(
                        'text-sm',
                        i < current ? 'text-[#0066cc]' : 'text-slate-300'
                    )}
                >
                    ●
                </span>
            ))}
            <span className="ml-1.5 text-xs text-slate-500">
                {current}/{total}
            </span>
        </div>
    );
}
