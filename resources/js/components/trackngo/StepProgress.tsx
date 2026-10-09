import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Check, AlertTriangle, Minus, RotateCcw } from 'lucide-react';
import { EXTERNAL_7_STEPS, INTERNAL_DEPT_6_STEPS, INTERNAL_MAYOR_6_STEPS } from '@/types/trackngo';
import type { FsmProcessType, FsmStepDefinition } from '@/types/trackngo';

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
    /** Kept for existing callers; the bar always shows the document's own steps */
    showProcessBadge?: boolean;
    allowProcessSwitch?: boolean;
    /** Kept for existing callers; the page reloads the document (shared live updates) and the bar follows it */
    enableLiveSync?: boolean;
    /** Plain-text step details (no pills / icons) for the cleaned-up document view. */
    compact?: boolean;
    onDocumentUpdate?: (updatedDoc: any) => void;
};

/**
 * A step of a route-based document, computed by the server (App\Services\Document\DocumentRoute). The steps never
 * grow: the waiting step carries what is happening now (detail + tone), and every step how many times that person
 * returned the document. The public tracking page renders exactly the same steps.
 */
type RouteStepInfo = {
    label: string;
    actor: string;
    office?: string | null;
    status: 'done' | 'current' | 'pending' | 'skipped';
    at: string | null;
    detail?: string | null;
    tone?: 'normal' | 'warning' | 'danger' | 'success';
    returns?: number;
    acting?: string | null;
};

/** Documents filed before routes existed follow one of the earlier fixed flows */
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

/** Fixed-flow documents: the backend FSM owns current_step_index (status strings are ambiguous) */
function resolveCurrentStep(doc: any, processType: FsmProcessType, fallbackStep?: number): number {
    const dbStep = Number(doc?.current_step_index);
    if (Number.isFinite(dbStep) && dbStep > 0) {
        return dbStep;
    }

    const rawStatus = (doc?.status || '').toLowerCase().trim();
    const last = processType === 'external' ? 7 : 6;
    if (['completed', 'released', 'archived', 'for_release'].includes(rawStatus)) return last;
    if (rawStatus === 'approved') return last - 1;
    if (['forwarded', 'endorsed', 'sent', 'ongoing'].includes(rawStatus)) return 4;
    if (['dept_reviewed', 'reviewed', 'in_review'].includes(rawStatus)) return 3;
    if (['registered', 'accepted', 'dept_accepted'].includes(rawStatus)) return 2;

    return fallbackStep || 1;
}

function formatDbTimestamp(ts?: string | null): string | null {
    if (!ts) return null;
    const d = new Date(ts);
    if (isNaN(d.getTime())) return null;

    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const TONE_CIRCLE: Record<string, string> = {
    normal: 'bg-[#0066cc] text-white border-2 border-[#0066cc] shadow-md shadow-[#0066cc]/25 ring-4 ring-[#0066cc]/20',
    warning: 'bg-amber-500 text-white border-2 border-amber-500 shadow-md shadow-amber-500/25 ring-4 ring-amber-400/20',
    danger: 'bg-red-600 text-white border-2 border-red-600 shadow-md shadow-red-600/30 ring-4 ring-red-500/20',
    success: 'bg-emerald-600 text-white border-2 border-emerald-600 shadow-md shadow-emerald-600/25 ring-4 ring-emerald-500/20',
};

const TONE_TEXT: Record<string, string> = {
    normal: 'text-[#0066cc]',
    warning: 'text-amber-700',
    danger: 'text-red-600',
    success: 'text-emerald-700',
};

export function StepProgress({
    document: initialDoc,
    currentStep,
    processType: propProcessType,
    isInternal: propIsInternal,
    submitterName,
    currentHolderName,
    isSlaBreached: propIsSlaBreached,
    auditTrails: initialAuditTrails = [],
    className,
}: StepProgressProps) {
    const [doc, setDoc] = useState<any>(initialDoc);
    useEffect(() => {
        setDoc(initialDoc);
    }, [initialDoc]);
    const auditTrails = initialAuditTrails;

    const isInternal = propIsInternal !== undefined ? propIsInternal : (doc?.is_internal === true || doc?.is_internal === 1);
    const processType: FsmProcessType = propProcessType || doc?.process_type || (
        isInternal
            ? ((doc?.submitter?.role?.role_name || '').toLowerCase().includes('mayor') ||
               (doc?.department?.department_name || '').toLowerCase().includes('mayor') ||
               (doc?.department?.code || '').toLowerCase() === 'myr' ||
               (doc?.sender || '').toLowerCase().includes('mayor')
                ? 'internal_mayor'
                : 'internal_dept')
            : 'external'
    );

    const isSlaBreached = propIsSlaBreached !== undefined
        ? propIsSlaBreached
        : Boolean(doc?.is_escalated || (doc?.arta_days_left !== undefined && doc?.arta_days_left < 0) || doc?.status === 'overdue');

    // Route-based documents bring their own steps from the server (one per person; never longer after a return)
    const routeSteps: RouteStepInfo[] | undefined = Array.isArray(doc?.route_info?.steps) ? doc.route_info.steps : undefined;
    if (routeSteps) {
        return <RouteSteps steps={routeSteps} isSlaBreached={isSlaBreached} className={className} />;
    }

    // ── Earlier fixed flows (documents filed before routes) ────────────────────────────────────
    const steps = resolveSteps(processType);
    const isReleased = ['completed', 'released', 'archived'].includes((doc?.status || '').toLowerCase());
    const isReturned = (doc?.status || '').toLowerCase() === 'returned';
    // Vetoed: it stopped at the step it was on (the rest is not reached). Deemed approved: only the release is left.
    const isVetoed = (doc?.status || '').toLowerCase() === 'vetoed';
    const isDeemed = (doc?.status || '').toLowerCase() === 'deemed_approved';
    const effectiveStep = resolveCurrentStep(doc, processType, currentStep);
    const stoppedAt = Math.max(1, Math.min(effectiveStep, steps.length));
    const clampedStep = isReleased ? steps.length + 1 : isDeemed ? steps.length : stoppedAt;
    const uploaderName = submitterName ?? doc?.submitter_name ?? doc?.submitter?.name ?? doc?.sender ?? 'Sender';
    const currentHolder = currentHolderName ?? doc?.current_holder_name ?? doc?.current_holder?.name ?? doc?.current_holder_department?.department_name;

    const matchFor = (stepNum: number, label: string) => auditTrails
        .slice()
        .reverse()
        .find((a: any) => {
            const action = String(a.action || '').toLowerCase();
            return action.includes(label.toLowerCase())
                || (stepNum === 1 && action === 'submit')
                || (stepNum === 2 && (action === 'register' || action === 'accepted'))
                || (stepNum === 3 && action === 'review')
                || (stepNum === 4 && (action === 'forward' || action === 'endorse'))
                || (stepNum === 5 && action === 'accepted')
                || (stepNum === 6 && (action === 'approve' || action === 'review'))
                || (stepNum === steps.length && ['release', 'completed'].includes(action));
        });

    return (
        <div className={cn('w-full overflow-x-auto py-2', className)}>
            <div className="flex w-full min-w-max items-start px-2">
                {steps.map((step, idx) => {
                    const stepNum = idx + 1;
                    const isSkipped = (isVetoed && stepNum > stoppedAt) || (isDeemed && stepNum > 1 && stepNum >= stoppedAt && stepNum < steps.length);
                    const isCompleted = !isSkipped && stepNum < clampedStep;
                    // The step where it was vetoed stays marked (red) so the bar shows where it stopped
                    const isCurrent = !isSkipped && stepNum === clampedStep;
                    const audit = matchFor(stepNum, step.label);
                    const actor = audit?.user?.name || audit?.user_name;
                    const at = stepNum === 1 ? (doc?.date_filed || doc?.created_at) : isCompleted ? (audit?.timestamp || (stepNum === steps.length ? doc?.completed_at : null)) : null;
                    const detail = stepNum === 1
                        ? uploaderName
                        : isVetoed && stepNum === stoppedAt
                            ? 'Vetoed — closed'
                            : isSkipped
                                ? 'Not reached'
                                : isCurrent
                                    ? (isDeemed ? 'Deemed approved · for release' : isReturned ? `Returned to ${currentHolder || 'sender'}` : isSlaBreached ? 'Overdue' : (currentHolder || 'In progress'))
                                    : isCompleted ? actor : null;

                    return (
                        <StepNode
                            key={`${step.step}-${step.label}`}
                            index={idx}
                            last={idx === steps.length - 1}
                            label={step.label}
                            actor={step.role}
                            status={isSkipped ? 'skipped' : isCompleted ? 'done' : isCurrent ? 'current' : 'pending'}
                            tone={isCurrent && isDeemed ? 'success' : isCurrent && (isVetoed || isReturned || (isSlaBreached && !isVetoed)) ? 'danger' : 'normal'}
                            detail={detail}
                            at={at}
                            connectorDone={isCompleted}
                        />
                    );
                })}
            </div>
        </div>
    );
}

function RouteSteps({ steps, isSlaBreached, className }: { steps: RouteStepInfo[]; isSlaBreached: boolean; className?: string }) {
    // A long route scrolls sideways: bring the step that is waiting into view (the page itself does not move)
    const scroller = useRef<HTMLDivElement>(null);
    const currentIndex = steps.findIndex(step => step.status === 'current');
    useEffect(() => {
        const box = scroller.current;
        const current = box?.querySelector<HTMLElement>('[data-current-step]');
        if (box && current && box.scrollWidth > box.clientWidth) {
            box.scrollLeft = current.offsetLeft - box.clientWidth / 2 + current.offsetWidth / 2;
        }
    }, [currentIndex, steps.length]);

    return (
        <div ref={scroller} className={cn('relative w-full overflow-x-auto py-2', className)}>
            <div className="flex w-full min-w-max items-start px-2">
                {steps.map((step, idx) => {
                    // An overdue document turns the waiting step red unless something more specific is going on
                    const tone = step.status === 'current' && isSlaBreached && (step.tone ?? 'normal') === 'normal' ? 'danger' : (step.tone ?? 'normal');
                    const detail = step.status === 'current'
                        ? (step.detail || (isSlaBreached ? 'Overdue' : 'In progress')) + (isSlaBreached && step.detail ? ' · overdue' : '')
                        : step.status === 'skipped' ? 'Not reached' : null;

                    return (
                        <StepNode
                            key={`${idx}-${step.label}-${step.actor}`}
                            index={idx}
                            last={idx === steps.length - 1}
                            label={step.label}
                            actor={step.actor}
                            office={step.office}
                            status={step.status}
                            tone={tone}
                            detail={detail}
                            acting={step.acting}
                            returns={step.returns}
                            at={step.status === 'done' ? step.at : null}
                            connectorDone={step.status === 'done'}
                        />
                    );
                })}
            </div>
        </div>
    );
}

type StepNodeProps = {
    index: number;
    last: boolean;
    label: string;
    actor?: string;
    office?: string | null;
    status: 'done' | 'current' | 'pending' | 'skipped';
    tone: string;
    detail?: string | null;
    acting?: string | null;
    returns?: number;
    at?: string | null;
    connectorDone: boolean;
};

function StepNode({ index, last, label, actor, office, status, tone, detail, acting, returns = 0, at, connectorDone }: StepNodeProps) {
    const time = formatDbTimestamp(at);
    const isCurrent = status === 'current';
    const tooltip = [label, actor, office, detail, acting, returns > 0 ? `Returned ${returns}×` : null, time].filter(Boolean).join(' · ');

    return (
        <div className={cn('flex items-start', last ? 'flex-none' : 'flex-1')} data-current-step={isCurrent || undefined}>
            {/* Fixed-width column so names and status never run into the next step; only the connector stretches */}
            <div className="relative flex w-[116px] shrink-0 cursor-default flex-col items-center text-center" title={tooltip}>
                <div
                    className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 select-none',
                        status === 'done' && 'bg-[#0066cc] text-white shadow-xs',
                        isCurrent && TONE_CIRCLE[tone],
                        status === 'pending' && 'border-2 border-slate-200 bg-white text-slate-400',
                        status === 'skipped' && 'border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400',
                    )}
                    aria-current={isCurrent ? 'step' : undefined}
                >
                    {status === 'done' ? (
                        <Check className="h-4 w-4 stroke-[2.5]" />
                    ) : status === 'skipped' ? (
                        <Minus className="h-4 w-4" />
                    ) : isCurrent && tone === 'danger' ? (
                        <AlertTriangle className="h-4 w-4 stroke-[2.5]" />
                    ) : (
                        index + 1
                    )}
                </div>

                <span
                    className={cn(
                        'mt-2 text-[12px] leading-tight tracking-tight whitespace-nowrap',
                        status === 'done' && 'font-medium text-[#0066cc]',
                        isCurrent && (tone === 'normal' ? 'font-bold text-slate-900' : `font-bold ${TONE_TEXT[tone]}`),
                        (status === 'pending' || status === 'skipped') && 'font-normal text-slate-400',
                    )}
                >
                    {label}
                </span>

                {actor && (
                    <span
                        className={cn(
                            'mt-0.5 max-w-[112px] truncate text-[11px] leading-tight whitespace-nowrap',
                            isCurrent ? `font-medium ${TONE_TEXT[tone]}` : status === 'done' ? 'text-slate-600' : 'text-slate-400',
                        )}
                    >
                        {actor}
                    </span>
                )}
                {office && (
                    <span className="max-w-[112px] truncate text-[10px] leading-tight text-slate-400" title={office}>
                        {office}
                    </span>
                )}

                {detail && (
                    <span className={cn('mt-1 max-w-[112px] text-[11px] leading-snug', isCurrent ? `font-medium ${TONE_TEXT[tone]}` : 'text-slate-500')}>
                        {detail}
                    </span>
                )}
                {acting && (
                    <span className="mt-0.5 max-w-[112px] text-[10px] leading-snug text-violet-700" title={acting}>
                        {acting}
                    </span>
                )}
                {returns > 0 && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-px text-[10px] font-medium text-amber-800">
                        <RotateCcw className="h-2.5 w-2.5" />
                        Returned {returns}×
                    </span>
                )}
                {time && <span className="mt-0.5 text-[10px] tracking-tight text-slate-400">{time}</span>}
            </div>

            {!last && (
                <div className="mx-1 mt-4.5 h-0.5 min-w-[16px] flex-1">
                    <div className={cn('h-full rounded-full transition-all duration-500', connectorDone ? 'bg-[#0066cc]' : 'bg-slate-200')} />
                </div>
            )}
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
