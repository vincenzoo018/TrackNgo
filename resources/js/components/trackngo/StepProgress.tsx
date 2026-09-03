import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { WORKFLOW_STEPS } from '@/types/trackngo';

type StepProgressProps = {
    currentStep: number; // 1-indexed
    totalSteps?: number;
    className?: string;
    currentHolderName?: string;
    auditTrails?: any[];
};

export function StepProgress({ currentStep, totalSteps = 6, className, currentHolderName, auditTrails = [] }: StepProgressProps) {
    const steps = WORKFLOW_STEPS.slice(0, totalSteps);

    return (
        <div className={cn('flex items-center', className)}>
            {steps.map((step, idx) => {
                const stepNum = idx + 1;
                const isCompleted = stepNum < currentStep;
                const isCurrent = stepNum === currentStep;
                const isPending = stepNum > currentStep;

                return (
                    <div key={step.key} className="flex flex-1 items-center">
                        {/* Step Circle + Label */}
                        <div className="flex flex-col items-center relative">
                            <div
                                className={cn(
                                    'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300',
                                    isCompleted && 'bg-[var(--tng-blue-600)] text-white',
                                    isCurrent && 'border-2 border-[var(--tng-blue-600)] bg-white text-[var(--tng-blue-600)] shadow-md shadow-blue-500/20',
                                    isPending && 'border-2 border-[var(--tng-slate-200)] bg-white text-[var(--tng-slate-400)]',
                                )}
                            >
                                {isCompleted ? <Check className="h-4 w-4" /> : stepNum}
                            </div>
                            <span
                                className={cn(
                                    'mt-1.5 text-[11px] font-medium whitespace-nowrap',
                                    isCompleted && 'text-[var(--tng-blue-600)]',
                                    isCurrent && 'text-[var(--tng-blue-700)] font-semibold',
                                    isPending && 'text-[var(--tng-slate-400)]',
                                )}
                            >
                                {step.label}
                            </span>
                            
                            {(() => {
                                // Find the actor for completed/current steps
                                const matchingAudit = auditTrails.slice().reverse().find(a => a.action === step.key);
                                const actorName = matchingAudit?.user?.name || matchingAudit?.user_name || matchingAudit?.user;
                                
                                if (actorName && (isCompleted || isCurrent)) {
                                    return (
                                        <span className="absolute top-[48px] text-[9px] font-medium text-[var(--tng-slate-400)] whitespace-nowrap bg-white/80 px-1 py-0.5 rounded shadow-sm border border-[var(--tng-slate-100)]">
                                            {actorName}
                                        </span>
                                    );
                                }
                                
                                if (isCurrent && currentHolderName && !actorName) {
                                    return (
                                        <span className="absolute top-[48px] text-[10px] font-medium text-[var(--tng-slate-500)] whitespace-nowrap bg-white px-1.5 py-0.5 rounded-full border border-[var(--tng-slate-200)] shadow-sm">
                                            Held by: {currentHolderName}
                                        </span>
                                    );
                                }
                                return null;
                            })()}
                        </div>

                        {/* Connector Line */}
                        {idx < steps.length - 1 && (
                            <div className="mx-1 mb-5 h-0.5 flex-1">
                                <div
                                    className={cn(
                                        'h-full rounded-full transition-all duration-500',
                                        stepNum < currentStep
                                            ? 'bg-[var(--tng-blue-600)]'
                                            : 'bg-[var(--tng-slate-200)]',
                                    )}
                                />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

/**
 * Dot-style step progress for table rows (compact view)
 * Matches the ●●○○○ pattern from the screenshots
 */
type StepDotsProps = {
    current: number;
    total: number;
    className?: string;
};

export function StepDots({ current, total, className }: StepDotsProps) {
    return (
        <div className={cn('flex items-center gap-0.5', className)}>
            <span className="mr-1 text-[var(--tng-blue-600)]">●</span>
            {Array.from({ length: total }, (_, i) => (
                <span
                    key={i}
                    className={cn(
                        'text-sm',
                        i < current
                            ? 'text-[var(--tng-blue-600)]'
                            : 'text-[var(--tng-slate-300)]',
                    )}
                >
                    ●
                </span>
            ))}
            <span className="ml-1.5 text-xs text-[var(--tng-slate-500)]">
                {current}/{total}
            </span>
        </div>
    );
}
