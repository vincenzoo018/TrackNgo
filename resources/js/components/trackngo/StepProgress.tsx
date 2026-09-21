import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Check, AlertTriangle, AlertCircle, User, ShieldAlert } from 'lucide-react';
import {
    EXTERNAL_7_STEPS,
    INTERNAL_DEPT_6_STEPS,
    INTERNAL_MAYOR_6_STEPS,
    FsmProcessType,
    FsmStepDefinition,
} from '@/types/trackngo';

export type StepProgressProps = {
    document?: any;
    currentStep?: number; // 1-indexed
    totalSteps?: number;
    processType?: FsmProcessType;
    isInternal?: boolean;
    submitterName?: string;
    currentHolderName?: string;
    isSlaBreached?: boolean;
    auditTrails?: any[];
    className?: string;
    showProcessBadge?: boolean;
    allowProcessSwitch?: boolean;
};

/**
 * Determine the exact step definition and total count
 */
function resolveSteps(processType: FsmProcessType): FsmStepDefinition[] {
    switch (processType) {
        case 'internal_dept':
            return INTERNAL_DEPT_6_STEPS;
        case 'internal_mayor':
            return INTERNAL_MAYOR_6_STEPS;
        case 'external':
        default:
            return EXTERNAL_7_STEPS;
    }
}

/**
 * Map document status string to FSM step index for external or internal workflows
 */
function resolveCurrentStep(doc: any, processType: FsmProcessType, fallbackStep?: number): number {
    if (!doc && fallbackStep !== undefined && fallbackStep > 0) {
        return fallbackStep;
    }

    const rawStatus = (doc?.status || '').toLowerCase().trim();

    if (processType === 'external') {
        // 7 Steps: 1. Submitted -> 2. Accepted (Dept) -> 3. Reviewed (Dept) -> 4. Forwarded -> 5. Accepted (Mayor) -> 6. Reviewed (Mayor) -> 7. Released
        if (rawStatus === 'submitted' || rawStatus === 'pending_registration') return 1;
        if (rawStatus === 'registered') return 2;
        if (rawStatus === 'dept_accepted' || rawStatus === 'accepted') {
            const holderDept = (doc?.current_holder_department?.department_name || doc?.department?.department_name || '').toLowerCase();
            if (holderDept.includes('mayor') || doc?.current_step_index >= 5) return 5;
            return 2;
        }
        if (rawStatus === 'dept_reviewed' || rawStatus === 'reviewed' || rawStatus === 'in_review') {
            const holderDept = (doc?.current_holder_department?.department_name || '').toLowerCase();
            if (holderDept.includes('mayor') || doc?.current_step_index >= 6) return 6;
            return 3;
        }
        if (rawStatus === 'forwarded' || rawStatus === 'endorsed' || rawStatus === 'sent' || rawStatus === 'ongoing') {
            if (doc?.current_step_index && doc.current_step_index >= 4) return Math.min(doc.current_step_index, 6);
            return 4;
        }
        if (rawStatus === 'mayor_accepted') return 5;
        if (rawStatus === 'approved' || rawStatus === 'mayor_reviewed') return 6;
        if (rawStatus === 'for_release' || rawStatus === 'released' || rawStatus === 'completed' || rawStatus === 'archived') return 7;
        
        if (doc?.current_step_index && doc.current_step_index > 0) {
            return Math.min(doc.current_step_index, 7);
        }
        return fallbackStep || 1;
    } else {
        // 6 Steps: 1. Submitted -> 2. Registered -> 3. Reviewed -> 4. Forwarded -> 5. Accepted -> 6. Released
        if (rawStatus === 'submitted') return 1;
        if (rawStatus === 'pending_registration' || rawStatus === 'registered') return 2;
        if (rawStatus === 'dept_reviewed' || rawStatus === 'reviewed' || rawStatus === 'in_review') return 3;
        if (rawStatus === 'forwarded' || rawStatus === 'endorsed' || rawStatus === 'sent' || rawStatus === 'ongoing') {
            if (doc?.current_step_index && doc.current_step_index >= 4) return Math.min(doc.current_step_index, 5);
            return 4;
        }
        if (rawStatus === 'accepted' || rawStatus === 'dept_accepted' || rawStatus === 'mayor_accepted') return 5;
        if (rawStatus === 'approved' || rawStatus === 'for_release' || rawStatus === 'released' || rawStatus === 'completed' || rawStatus === 'archived') return 6;
        
        if (doc?.current_step_index && doc.current_step_index > 0) {
            return Math.min(doc.current_step_index, 6);
        }
        return fallbackStep || 1;
    }
}

export function StepProgress({
    document: doc,
    currentStep,
    totalSteps,
    processType: propProcessType,
    isInternal: propIsInternal,
    submitterName,
    currentHolderName,
    isSlaBreached: propIsSlaBreached,
    auditTrails = [],
    className,
    showProcessBadge = true,
    allowProcessSwitch = false,
}: StepProgressProps) {
    // 1. Determine whether internal or external
    const isInternal = propIsInternal !== undefined
        ? propIsInternal
        : (doc?.is_internal === true || doc?.is_internal === 1);

    // 2. Determine initial process type
    const initialProcessType: FsmProcessType = propProcessType || (
        isInternal
            ? ((doc?.submitter?.role?.role_name || '').toLowerCase().includes('mayor') ||
               (doc?.department?.department_name || '').toLowerCase().includes('mayor') ||
               (doc?.department?.code || '').toLowerCase() === 'myr' ||
               (doc?.sender || '').toLowerCase().includes('mayor')
                ? 'internal_mayor'
                : 'internal_dept')
            : 'external'
    );

    const [activeProcessType, setActiveProcessType] = useState<FsmProcessType>(initialProcessType);

    // 3. Resolve step array
    const steps = resolveSteps(activeProcessType);

    // 4. Resolve current step
    const effectiveStep = resolveCurrentStep(doc, activeProcessType, currentStep);
    const clampedStep = Math.max(1, Math.min(effectiveStep, steps.length));

    // 5. Determine SLA breach
    const isSlaBreached = propIsSlaBreached !== undefined
        ? propIsSlaBreached
        : Boolean(
            doc?.is_escalated ||
            (doc?.arta_days_left !== undefined && doc?.arta_days_left < 0) ||
            doc?.status === 'escalated' ||
            doc?.status === 'overdue'
        );

    // 6. Submitter / Uploader name for Step 1
    const uploaderName = submitterName ??
        doc?.submitter?.name ??
        doc?.submitted_by_name ??
        doc?.sender ??
        (doc?.submitter
            ? `${doc.submitter.first_name || ''} ${doc.submitter.last_name || ''}`.trim()
            : null) ??
        'Authenticated User';

    const currentHolder = currentHolderName ?? doc?.current_holder?.name ?? doc?.currentHolder?.name;

    return (
        <div className={cn('w-full flex flex-col gap-3', className)}>
            {/* Header with Process Badge & Optional Process Switcher */}
            {showProcessBadge && (
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-[#0066cc]/10 border border-[#0066cc]/20 px-2.5 py-1 text-[12px] font-medium text-[#0066cc]">
                            {activeProcessType === 'external' ? (
                                <>
                                    <span>📤</span>
                                    <span>External Process (7 Steps)</span>
                                </>
                            ) : activeProcessType === 'internal_dept' ? (
                                <>
                                    <span>🏢</span>
                                    <span>Internal Process (6 Steps) — Dept. Head</span>
                                </>
                            ) : (
                                <>
                                    <span>🏛️</span>
                                    <span>Internal Process (6 Steps) — Mayor</span>
                                </>
                            )}
                        </span>

                        {isSlaBreached && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-red-50 border border-red-200 px-2.5 py-1 text-[12px] font-semibold text-red-700 animate-pulse">
                                <ShieldAlert className="h-3.5 w-3.5" />
                                SLA Breached
                            </span>
                        )}
                    </div>

                    {/* Interactive Process Switcher (if permitted) */}
                    {allowProcessSwitch && (
                        <div className="flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                            <button
                                type="button"
                                onClick={() => setActiveProcessType('external')}
                                className={cn(
                                    'px-2 py-1 rounded transition-colors',
                                    activeProcessType === 'external'
                                        ? 'bg-white text-[#0066cc] font-semibold shadow-xs'
                                        : 'hover:text-slate-900'
                                )}
                            >
                                External (7)
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveProcessType('internal_dept')}
                                className={cn(
                                    'px-2 py-1 rounded transition-colors',
                                    activeProcessType === 'internal_dept'
                                        ? 'bg-white text-[#0066cc] font-semibold shadow-xs'
                                        : 'hover:text-slate-900'
                                )}
                            >
                                Internal Dept (6)
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveProcessType('internal_mayor')}
                                className={cn(
                                    'px-2 py-1 rounded transition-colors',
                                    activeProcessType === 'internal_mayor'
                                        ? 'bg-white text-[#0066cc] font-semibold shadow-xs'
                                        : 'hover:text-slate-900'
                                )}
                            >
                                Internal Mayor (6)
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* FSM Visualizer Pipeline */}
            <div className="w-full overflow-x-auto py-2">
                <div className="flex items-start min-w-[720px] sm:min-w-full px-2">
                    {steps.map((step, idx) => {
                        const stepNum = idx + 1;
                        const isCompleted = stepNum < clampedStep;
                        const isCurrent = stepNum === clampedStep;
                        const isPending = stepNum > clampedStep;

                        // Match actor name from audit trail if available
                        const matchingAudit = auditTrails
                            .slice()
                            .reverse()
                            .find(
                                (a) =>
                                    (a.action || '').toLowerCase().includes(step.label.toLowerCase()) ||
                                    (a.action || '').toLowerCase().includes((step.role || '').toLowerCase())
                            );
                        const auditActor =
                            matchingAudit?.user?.name || matchingAudit?.user_name || matchingAudit?.user;

                        return (
                            <div key={`${step.step}-${step.label}`} className="flex flex-1 items-start">
                                {/* Step Node + Labels */}
                                <div className="flex flex-col items-center relative flex-1 text-center">
                                    {/* Circle Indicator */}
                                    <div
                                        className={cn(
                                            'flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 select-none shrink-0',
                                            // Completed: System Blue filled
                                            isCompleted && 'bg-[#0066cc] text-white shadow-xs',
                                            // Active & SLA Breached: Red indicator
                                            isCurrent && isSlaBreached &&
                                                'bg-red-600 text-white border-2 border-red-600 shadow-md shadow-red-600/30 ring-4 ring-red-500/20',
                                            // Active & Normal: Blue indicator
                                            isCurrent && !isSlaBreached &&
                                                'bg-[#0066cc] text-white border-2 border-[#0066cc] shadow-md shadow-[#0066cc]/25 ring-4 ring-[#0066cc]/20',
                                            // Pending: Neutral Gray
                                            isPending && 'border-2 border-slate-200 bg-white text-slate-400'
                                        )}
                                        aria-current={isCurrent ? 'step' : undefined}
                                    >
                                        {isCompleted ? (
                                            <Check className="h-4 w-4 stroke-[2.5]" />
                                        ) : isCurrent && isSlaBreached ? (
                                            <AlertTriangle className="h-4 w-4 stroke-[2.5]" />
                                        ) : (
                                            stepNum
                                        )}
                                    </div>

                                    {/* Stage Title */}
                                    <span
                                        className={cn(
                                            'mt-2 text-[12px] whitespace-nowrap tracking-tight leading-tight',
                                            isCompleted && 'text-[#0066cc] font-medium',
                                            isCurrent && isSlaBreached && 'text-red-700 font-bold',
                                            isCurrent && !isSlaBreached && 'text-slate-900 font-bold',
                                            isPending && 'text-slate-400 font-normal'
                                        )}
                                    >
                                        {step.label}
                                    </span>

                                    {/* Role / Office Subtitle */}
                                    <span
                                        className={cn(
                                            'mt-0.5 text-[11px] whitespace-nowrap leading-tight',
                                            isCurrent && isSlaBreached
                                                ? 'text-red-600 font-medium'
                                                : isCurrent
                                                ? 'text-[#0066cc] font-medium'
                                                : isCompleted
                                                ? 'text-slate-600 font-normal'
                                                : 'text-slate-400 font-normal'
                                        )}
                                    >
                                        {step.role}
                                    </span>

                                    {/* RULE: Submitted Stage (Step 1) -> ALWAYS display authenticated uploader */}
                                    {idx === 0 && (
                                        <div
                                            className="mt-1.5 flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200/80 px-2 py-0.5 text-[10.5px] font-semibold text-[#0066cc] shadow-2xs max-w-[130px]"
                                            title={`Uploaded by: ${uploaderName}`}
                                        >
                                            <User className="h-3 w-3 shrink-0 text-[#0066cc]" />
                                            <span className="truncate">{uploaderName}</span>
                                        </div>
                                    )}

                                    {/* Active Stage Details (if not step 1) */}
                                    {idx > 0 && isCurrent && (
                                        <div className="mt-1.5 flex flex-col items-center">
                                            {isSlaBreached ? (
                                                <span className="inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 border border-red-200">
                                                    <AlertCircle className="h-3 w-3" /> Overdue
                                                </span>
                                            ) : currentHolder ? (
                                                <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-[#0066cc] border border-blue-100 max-w-[120px] truncate">
                                                    {currentHolder}
                                                </span>
                                            ) : auditActor ? (
                                                <span className="text-[10px] text-slate-500 max-w-[100px] truncate">
                                                    {auditActor}
                                                </span>
                                            ) : null}
                                        </div>
                                    )}

                                    {/* Completed Stage Actor info (if available) */}
                                    {idx > 0 && isCompleted && auditActor && (
                                        <span className="mt-1 text-[10px] text-slate-500 max-w-[100px] truncate">
                                            {auditActor}
                                        </span>
                                    )}
                                </div>

                                {/* Connector Line */}
                                {idx < steps.length - 1 && (
                                    <div className="mx-1 mt-4.5 h-0.5 flex-1 min-w-[20px]">
                                        <div
                                            className={cn(
                                                'h-full rounded-full transition-all duration-500',
                                                stepNum < clampedStep ? 'bg-[#0066cc]' : 'bg-slate-200'
                                            )}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

/**
 * Dot-style step progress for table rows (compact view)
 * Synchronized with External (7) and Internal (6) lifecycle steps
 */
export type StepDotsProps = {
    current: number;
    total?: number;
    isInternal?: boolean;
    isSlaBreached?: boolean;
    className?: string;
};

export function StepDots({
    current,
    total,
    isInternal = false,
    isSlaBreached = false,
    className,
}: StepDotsProps) {
    const effectiveTotal = total || (isInternal ? 6 : 7);
    const clampedCurrent = Math.max(0, Math.min(current, effectiveTotal));

    return (
        <div className={cn('flex items-center gap-1 select-none', className)}>
            <div className="flex items-center gap-0.5">
                {Array.from({ length: effectiveTotal }, (_, i) => {
                    const stepNum = i + 1;
                    const isCompleted = stepNum < clampedCurrent;
                    const isCurrent = stepNum === clampedCurrent;

                    return (
                        <span
                            key={i}
                            className={cn(
                                'text-sm transition-colors',
                                isCurrent && isSlaBreached && 'text-red-600 animate-pulse font-bold',
                                isCurrent && !isSlaBreached && 'text-[#0066cc] font-bold',
                                isCompleted && 'text-[#0066cc]',
                                !isCurrent && !isCompleted && 'text-slate-300'
                            )}
                            title={`Step ${stepNum} of ${effectiveTotal}`}
                        >
                            ●
                        </span>
                    );
                })}
            </div>
            <span
                className={cn(
                    'ml-1 text-[12px]',
                    isSlaBreached ? 'text-red-700 font-semibold' : 'text-slate-500 font-normal'
                )}
            >
                {clampedCurrent}/{effectiveTotal}
            </span>
        </div>
    );
}
