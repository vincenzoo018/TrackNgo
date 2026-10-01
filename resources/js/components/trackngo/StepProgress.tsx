import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Check, AlertTriangle, AlertCircle, User, ShieldAlert, Radio } from 'lucide-react';
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
    enableLiveSync?: boolean;
    /** Plain-text step details (no pills / icons) for the cleaned-up document view. */
    compact?: boolean;
    onDocumentUpdate?: (updatedDoc: any) => void;
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

    // The backend FSM (DocumentWorkflowService) owns current_step_index; status strings are ambiguous
    // (e.g. "Sent" is used both at Submitted and Forwarded), so only fall back to them when no index exists.
    const dbStep = Number(doc?.current_step_index);
    if (Number.isFinite(dbStep) && dbStep > 0) {
        return dbStep;
    }

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

/**
 * Cleanly format database timestamp into readable string
 */
function formatDbTimestamp(ts?: string | null): string | null {
    if (!ts) return null;
    try {
        const d = new Date(ts);
        if (isNaN(d.getTime())) return null;
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return null;
    }
}

export function StepProgress({
    document: initialDoc,
    currentStep,
    totalSteps,
    processType: propProcessType,
    isInternal: propIsInternal,
    submitterName,
    currentHolderName,
    isSlaBreached: propIsSlaBreached,
    auditTrails: initialAuditTrails = [],
    className,
    showProcessBadge = true,
    allowProcessSwitch = false,
    enableLiveSync = true,
    compact = false,
    onDocumentUpdate,
}: StepProgressProps) {
    // ── Live Real-Time Integration State ──────────────────────────────
    const [doc, setDoc] = useState<any>(initialDoc);
    const [auditTrails, setAuditTrails] = useState<any[]>(initialAuditTrails);
    const [isLiveActive, setIsLiveActive] = useState(false);
    const lastSyncRef = useRef<number>(Date.now());

    useEffect(() => {
        setDoc(initialDoc);
    }, [initialDoc]);

    useEffect(() => {
        setAuditTrails(initialAuditTrails);
    }, [initialAuditTrails]);

    // Live background polling & custom action event listener
    useEffect(() => {
        const docId = doc?.document_id || initialDoc?.document_id;
        if (!docId || !enableLiveSync) return;

        let isMounted = true;

        const syncFromDatabase = async () => {
            try {
                const res = await fetch(`/documents/${docId}/timeline-sync`, {
                    headers: { 'Accept': 'application/json' },
                });
                if (!res.ok || !isMounted) return;

                const data = await res.json();
                if (!data || !isMounted) return;

                setIsLiveActive(true);
                lastSyncRef.current = Date.now();

                // Check for live updates
                if (data.document) {
                    setDoc((prev: any) => {
                        const hasChanged =
                            !prev ||
                            prev.status !== data.document.status ||
                            prev.current_step_index !== data.document.current_step_index ||
                            prev.updated_at !== data.document.updated_at ||
                            prev.current_holder_id !== data.document.current_holder_id;

                        if (hasChanged) {
                            onDocumentUpdate?.(data.document);
                            return { ...prev, ...data.document };
                        }
                        return prev;
                    });
                } else if (data.status) {
                    setDoc((prev: any) => {
                        if (!prev || prev.status !== data.status || prev.current_step_index !== data.current_step_index) {
                            const updated = {
                                ...prev,
                                status: data.status,
                                current_step_index: data.current_step_index,
                                return_reason: data.return_reason,
                            };
                            onDocumentUpdate?.(updated);
                            return updated;
                        }
                        return prev;
                    });
                }

                if (Array.isArray(data.auditTrail)) {
                    setAuditTrails(data.auditTrail);
                }
            } catch (err) {
                // Background network error, continue silently
            }
        };

        // Real-time polling every 3 seconds for instant updates without page refresh
        const interval = setInterval(syncFromDatabase, 3000);

        // Immediate sync listener for custom frontend events (triggered immediately upon action submit)
        const handleCustomRefresh = () => {
            syncFromDatabase();
        };
        window.addEventListener('tng:fsm-refresh', handleCustomRefresh);
        window.addEventListener('tng:document-updated', handleCustomRefresh);

        return () => {
            isMounted = false;
            clearInterval(interval);
            window.removeEventListener('tng:fsm-refresh', handleCustomRefresh);
            window.removeEventListener('tng:document-updated', handleCustomRefresh);
        };
    }, [doc?.document_id, initialDoc?.document_id, enableLiveSync, onDocumentUpdate]);

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
    // Released documents show every stage as completed (clampedStep past the last step)
    const isReleased = ['completed', 'released', 'archived'].includes((doc?.status || '').toLowerCase());
    const isReturned = (doc?.status || '').toLowerCase() === 'returned';
    const clampedStep = isReleased
        ? steps.length + 1
        : Math.max(1, Math.min(effectiveStep, steps.length));

    // 5. Determine SLA breach (red indicator)
    const isSlaBreached = propIsSlaBreached !== undefined
        ? propIsSlaBreached
        : Boolean(
            doc?.is_escalated ||
            (doc?.arta_days_left !== undefined && doc?.arta_days_left < 0) ||
            doc?.status === 'escalated' ||
            doc?.status === 'overdue'
        );

    // 6. Submitter / Uploader name for Step 1
    // GENERAL RULE: Always display the authenticated user who uploaded the document directly below the “Submitted” label.
    const uploaderName = submitterName ??
        doc?.submitter_name ??
        doc?.submitter?.name ??
        doc?.submitted_by_name ??
        doc?.sender ??
        (doc?.submitter
            ? `${doc.submitter.first_name || ''} ${doc.submitter.last_name || ''}`.trim()
            : null) ??
        'Authenticated User';

    const currentHolder = currentHolderName ??
        doc?.current_holder_name ??
        doc?.current_holder?.name ??
        doc?.currentHolder?.name ??
        doc?.current_holder_department_name ??
        doc?.current_holder_department?.department_name;

    return (
        <div className={cn('w-full flex flex-col gap-3', className)}>
            {/* Header with Process Badge & Live Real-Time Integration Indicator */}
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

                        {/* Live Database Sync Indicator */}
                        {enableLiveSync && doc?.document_id && (
                            <span
                                className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-medium text-emerald-700 select-none"
                                title="Live Integration: Real-time database sync active without page refresh"
                            >
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                                <span>Live DB Sync</span>
                            </span>
                        )}

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
                <div className="flex items-start min-w-[760px] sm:min-w-full px-2">
                    {steps.map((step, idx) => {
                        const stepNum = idx + 1;
                        const isCompleted = stepNum < clampedStep;
                        const isCurrent = stepNum === clampedStep;
                        const isPending = stepNum > clampedStep;

                        // ⚙️ Database Binding: Match database action, handler user_id, handler_role, timestamp
                        const matchingAudit = auditTrails
                            .slice()
                            .reverse()
                            .find(
                                (a) =>
                                    (a.action || '').toLowerCase().includes(step.label.toLowerCase()) ||
                                    (a.action || '').toLowerCase().includes((step.role || '').toLowerCase()) ||
                                    (stepNum === 1 && (a.action || '').toLowerCase() === 'submit') ||
                                    (stepNum === 2 && ((a.action || '').toLowerCase() === 'register' || (a.action || '').toLowerCase() === 'accepted')) ||
                                    (stepNum === 3 && (a.action || '').toLowerCase() === 'review') ||
                                    (stepNum === 4 && ((a.action || '').toLowerCase() === 'forward' || (a.action || '').toLowerCase() === 'endorse')) ||
                                    (stepNum === 5 && (a.action || '').toLowerCase() === 'accepted') ||
                                    (stepNum === 6 && ((a.action || '').toLowerCase() === 'approve' || (a.action || '').toLowerCase() === 'review')) ||
                                    (stepNum === steps.length && (a.action || '').toLowerCase() === 'release')
                            );

                        const auditActor =
                            matchingAudit?.user?.name || matchingAudit?.user_name || matchingAudit?.user;
                        const auditUserId = matchingAudit?.user_id;
                        const auditRole = matchingAudit?.user_role || step.role;

                        // Database bound timestamp
                        const stageTimestamp =
                            stepNum === 1
                                ? doc?.date_filed || doc?.created_at || matchingAudit?.timestamp
                                : isCompleted
                                ? matchingAudit?.timestamp || (stepNum === steps.length ? doc?.completed_at : null)
                                : null;
                        const formattedTime = formatDbTimestamp(stageTimestamp);

                        // Tooltip text for explicit database binding inspection
                        const dbTooltip = [
                            `Stage ${stepNum}: ${step.label}`,
                            `Handler Role: ${step.role}`,
                            stepNum === 1
                                ? `Uploaded By: ${uploaderName} (User ID: ${doc?.submitted_by ?? 'Auth'})`
                                : isCompleted && auditActor
                                ? `Handled By: ${auditActor}${auditUserId ? ` (User ID: ${auditUserId})` : ''}`
                                : isCurrent
                                ? `Current Holder: ${currentHolder || step.role}`
                                : `Pending Action: ${step.role}`,
                            stageTimestamp ? `Timestamp: ${formattedTime}` : null,
                            `DB Status: ${doc?.status || 'N/A'}`,
                        ]
                            .filter(Boolean)
                            .join(' • ');

                        return (
                            <div key={`${step.step}-${step.label}`} className="flex flex-1 items-start">
                                {/* Step Node + Labels */}
                                <div
                                    className="flex flex-col items-center relative flex-1 text-center group cursor-default"
                                    title={dbTooltip}
                                >
                                    {/* Circle Indicator: Blue active, Gray pending, Red SLA breach */}
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
                                            'mt-0.5 text-[11px] whitespace-nowrap leading-tight max-w-[130px] truncate',
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

                                    {/* GENERAL RULE: Submitted Stage (Step 1) -> ALWAYS display authenticated user directly below Submitted */}
                                    {idx === 0 && compact && (
                                        <div className="flex flex-col items-center mt-1">
                                            <span className="text-[11px] text-slate-600 max-w-[130px] truncate">{uploaderName}</span>
                                            {formattedTime && <span className="text-[10px] text-slate-400">{formattedTime}</span>}
                                        </div>
                                    )}
                                    {idx === 0 && !compact && (
                                        <div className="flex flex-col items-center mt-1.5">
                                            <div
                                                className="flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200/90 px-2 py-0.5 text-[10.5px] font-semibold text-[#0066cc] shadow-2xs max-w-[135px]"
                                                title={`Authenticated Uploader: ${uploaderName} (User ID: ${doc?.submitted_by || 'Auth'})`}
                                            >
                                                <User className="h-3 w-3 shrink-0 text-[#0066cc]" />
                                                <span className="truncate">{uploaderName}</span>
                                            </div>
                                            {formattedTime && (
                                                <span className="mt-0.5 text-[9.5px] text-slate-400 tracking-tight">
                                                    {formattedTime}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Active Stage Details (if not step 1) */}
                                    {idx > 0 && isCurrent && compact && (
                                        <span className={cn('mt-1 text-[11px] max-w-[130px] truncate', isReturned || isSlaBreached ? 'text-red-600 font-medium' : 'text-slate-600')}>
                                            {isReturned
                                                ? `Returned to ${currentHolder || 'sender'}`
                                                : isSlaBreached ? 'Overdue' : (currentHolder || auditActor || 'In progress')}
                                        </span>
                                    )}
                                    {idx > 0 && isCurrent && !compact && (
                                        <div className="mt-1.5 flex flex-col items-center">
                                            {isSlaBreached ? (
                                                <span className="inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 border border-red-200">
                                                    <AlertCircle className="h-3 w-3" /> Overdue
                                                </span>
                                            ) : currentHolder ? (
                                                <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-[#0066cc] border border-blue-100 max-w-[125px] truncate">
                                                    {currentHolder}
                                                </span>
                                            ) : auditActor ? (
                                                <span className="text-[10px] text-slate-500 max-w-[100px] truncate">
                                                    {auditActor}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                                                    In Progress
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Completed Stage Actor & Timestamp Info */}
                                    {idx > 0 && isCompleted && (
                                        <div className="mt-1 flex flex-col items-center">
                                            {auditActor && (
                                                <span className="text-[10px] text-slate-600 font-medium max-w-[110px] truncate">
                                                    {auditActor}
                                                </span>
                                            )}
                                            {formattedTime && (
                                                <span className="text-[9.5px] text-slate-400 tracking-tight">
                                                    {formattedTime}
                                                </span>
                                            )}
                                        </div>
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
