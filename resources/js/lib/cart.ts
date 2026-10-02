/**
 * CART monitoring layer: shared types, status vocabulary and formatters.
 * Rows are built on the server (App\Services\Cart\CartMonitoringService) so every CART page agrees.
 */
import type { LucideIcon } from 'lucide-react';
import { AlarmClock, AlertTriangle, CheckCircle2, CircleCheckBig, Clock, ShieldAlert } from 'lucide-react';

export type MonitorStatus = 'within_time' | 'approaching' | 'due' | 'overdue' | 'escalated' | 'completed';
export type EscalationLevel = 'Warning' | 'Critical' | 'Overdue' | 'Manual';

export type Escalation = {
    id: number;
    level: EscalationLevel;
    status: 'active' | 'resolved';
    escalated_at: string | null;
    reason: string | null;
    allowed_days: number;
    elapsed_days: number;
    overdue_days: number;
    resolved_at: string | null;
    resolved_by: string | null;
    notes: string | null;
    responsible?: string | null;
};

export type MonitorRow = {
    id: number;
    tracking_number: string;
    reference_number: string;
    title: string;
    is_confidential: boolean;
    document_type: string;
    type_id: number;
    origin_department: string | null;
    department_id: number;
    current_department: string | null;
    current_department_id: number | null;
    current_handler: string | null;
    current_handler_id: number | null;
    current_handler_role: string | null;
    submitted_by: string | null;
    is_internal: boolean;
    status: string;
    status_label: string;
    stage: { label: string; step: number; total: number };
    is_closed: boolean;
    is_pending: boolean;
    date_received: string | null;
    holder_since: string | null;
    last_activity: string | null;
    days_with_handler: number | null;
    idle_days: number | null;
    allowed_days: number;
    elapsed_days: number;
    remaining_days: number;
    overdue_days: number;
    deadline: string;
    arta_status: MonitorStatus;
    monitor_status: MonitorStatus;
    severity: EscalationLevel | null;
    completed_at: string | null;
    completed_late: boolean;
    escalation: Escalation | null;
    escalation_count: number;
    last_follow_up_at: string | null;
    can_follow_up: boolean;
};

export type TimelineStop = {
    kind: 'filed' | 'hop' | 'completed';
    title: string;
    actor: string | null;
    role: string | null;
    department: string | null;
    at: string | null;
    duration: string | null;
    is_current: boolean;
};

export type Option = { id: number; name: string; days?: number };

export type FilterOptions = { departments: Option[]; documentTypes: Option[] };

export type EscalationRules = {
    working_days: boolean;
    warning_max_days: number;
    critical_max_days: number;
    approaching_ratio: number;
    inactivity_days: number;
    follow_up_hours: number;
};

export type Pagination = { current_page: number; per_page: number; total: number };

/** Green = within time, yellow = near the deadline, red = delayed — always shown with an icon and a label */
export const MONITOR_STATUS: Record<MonitorStatus, { label: string; short: string; icon: LucideIcon; badge: string; dot: string; bar: string; text: string }> = {
    within_time: {
        label: 'Within time',
        short: 'Within time',
        icon: CheckCircle2,
        badge: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
        dot: 'bg-emerald-500',
        bar: 'bg-emerald-500',
        text: 'text-emerald-700',
    },
    approaching: {
        label: 'Approaching deadline',
        short: 'Approaching',
        icon: Clock,
        badge: 'bg-amber-50 text-amber-800 ring-amber-600/25',
        dot: 'bg-amber-400',
        bar: 'bg-amber-400',
        text: 'text-amber-700',
    },
    due: {
        label: 'Due today',
        short: 'Due today',
        icon: AlarmClock,
        badge: 'bg-orange-50 text-orange-800 ring-orange-600/25',
        dot: 'bg-orange-500',
        bar: 'bg-orange-500',
        text: 'text-orange-700',
    },
    overdue: {
        label: 'Overdue',
        short: 'Overdue',
        icon: AlertTriangle,
        badge: 'bg-red-50 text-red-700 ring-red-600/20',
        dot: 'bg-red-500',
        bar: 'bg-red-500',
        text: 'text-red-700',
    },
    escalated: {
        label: 'Escalated',
        short: 'Escalated',
        icon: ShieldAlert,
        badge: 'bg-rose-100 text-rose-800 ring-rose-700/25',
        dot: 'bg-rose-700',
        bar: 'bg-rose-700',
        text: 'text-rose-800',
    },
    completed: {
        label: 'Completed',
        short: 'Completed',
        icon: CircleCheckBig,
        badge: 'bg-slate-100 text-slate-600 ring-slate-500/20',
        dot: 'bg-slate-400',
        bar: 'bg-slate-300',
        text: 'text-slate-600',
    },
};

export const STATUS_ORDER: MonitorStatus[] = ['escalated', 'overdue', 'due', 'approaching', 'within_time', 'completed'];

export const LEVEL_STYLE: Record<EscalationLevel, string> = {
    Warning: 'bg-amber-50 text-amber-800 ring-amber-600/25',
    Critical: 'bg-orange-50 text-orange-800 ring-orange-600/25',
    Overdue: 'bg-red-50 text-red-700 ring-red-600/20',
    Manual: 'bg-violet-50 text-violet-700 ring-violet-600/20',
};

export const LEVEL_HINT: Record<EscalationLevel, string> = {
    Warning: '1–2 days past the processing period',
    Critical: '3–5 days past the processing period',
    Overdue: 'More than 5 days past the processing period',
    Manual: 'Escalated to CART by a handler',
};

// ── Formatters ─────────────────────────────────────────────────────────────────────────────────

const parse = (value?: string | null): Date | null => {
    if (!value) {
        return null;
    }

    const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);

    return isNaN(date.getTime()) ? null : date;
};

export function formatDate(value?: string | null): string {
    const date = parse(value);

    return date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
}

export function formatDateTime(value?: string | null): string {
    const date = parse(value);

    return date
        ? `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
        : '—';
}

/** Compact date for table cells ("Oct 5"); the year is shown only when it is not the current one */
export function formatShortDate(value?: string | null): string {
    const date = parse(value);

    if (!date) {
        return '—';
    }

    const sameYear = date.getFullYear() === new Date().getFullYear();

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** Compact date and time for table cells; the year is shown only when it is not the current one */
export function formatShortDateTime(value?: string | null): string {
    const date = parse(value);

    if (!date) {
        return '—';
    }

    const sameYear = date.getFullYear() === new Date().getFullYear();

    return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) })}, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

/** "3 hours ago", "2 days ago" */
export function timeAgo(value?: string | null): string {
    const date = parse(value);

    if (!date) {
        return '—';
    }

    const minutes = Math.round((Date.now() - date.getTime()) / 60000);

    if (minutes < 1) {
        return 'just now';
    }

    if (minutes < 60) {
        return `${minutes} min ago`;
    }

    const hours = Math.round(minutes / 60);

    if (hours < 24) {
        return `${hours} hr${hours === 1 ? '' : 's'} ago`;
    }

    const days = Math.round(hours / 24);

    return `${days} day${days === 1 ? '' : 's'} ago`;
}

export const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** Time elapsed since a moment, as the timeline shows it: "1 day 4 hrs", "5 hrs", "under 1 hr" */
export function elapsedSince(value?: string | null): string {
    const date = parse(value);

    if (!date) {
        return '—';
    }

    const hours = Math.max(0, Math.round((Date.now() - date.getTime()) / 3_600_000));

    if (hours < 1) {
        return 'under 1 hr';
    }

    if (hours < 24) {
        return plural(hours, 'hr');
    }

    const days = Math.floor(hours / 24);
    const rest = hours % 24;

    return `${plural(days, 'day')}${rest ? ` ${plural(rest, 'hr')}` : ''}`;
}

/** Remaining time in words: "3 days left", "Due today", "2 days overdue", "Completed on time" */
export function remainingLabel(row: Pick<MonitorRow, 'is_closed' | 'remaining_days' | 'overdue_days' | 'completed_late'>): string {
    if (row.is_closed) {
        return row.completed_late ? `Completed ${plural(row.overdue_days, 'day')} late` : 'Completed on time';
    }

    if (row.overdue_days > 0) {
        return `${plural(row.overdue_days, 'day')} overdue`;
    }

    if (row.remaining_days === 0) {
        return 'Due today';
    }

    return `${plural(row.remaining_days, 'day')} left`;
}

export function handlerLabel(row: Pick<MonitorRow, 'current_handler' | 'current_department'>): string {
    return row.current_handler ?? row.current_department ?? 'Unassigned';
}

export const dayUnit = (rules?: Pick<EscalationRules, 'working_days'>) => (rules?.working_days ? 'working days' : 'days');

/** Case-insensitive match of a search term against several fields */
export function matches(term: string, ...fields: (string | null | undefined)[]): boolean {
    const needle = term.trim().toLowerCase();

    return needle === '' || fields.some((field) => (field ?? '').toLowerCase().includes(needle));
}

/** Whether an ISO date falls in an inclusive yyyy-mm-dd range (either end optional) */
export function inDateRange(value: string | null, from: string, to: string): boolean {
    if (!from && !to) {
        return true;
    }

    const date = parse(value);

    if (!date) {
        return false;
    }

    const day = date.toLocaleDateString('en-CA');

    return (!from || day >= from) && (!to || day <= to);
}
