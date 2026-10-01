/**
 * ARTA processing deadline, mirroring the backend (EscalationService / NotificationService):
 * arta_due_date when set, otherwise date filed + the document type's processing days.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const CLOSED_STATUSES = ['completed', 'released', 'archived'];

export function getArtaDueDate(doc: any): Date | null {
    if (doc?.arta_due_date) {
        const due = new Date(doc.arta_due_date);
        return isNaN(due.getTime()) ? null : due;
    }
    const start = new Date(doc?.date_filed || doc?.created_at || '');
    if (isNaN(start.getTime())) {
        return null;
    }
    return new Date(start.getTime() + (doc?.type?.arta_processing_days ?? 3) * DAY_MS);
}

/** Whole days until the deadline (negative = overdue); undefined once the document is closed. */
export function getArtaDaysLeft(doc: any): number | undefined {
    if (CLOSED_STATUSES.includes(String(doc?.status || '').toLowerCase())) {
        return undefined;
    }
    const due = getArtaDueDate(doc);
    if (!due) {
        return undefined;
    }
    return Math.ceil((due.getTime() - Date.now()) / DAY_MS);
}
