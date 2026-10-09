/**
 * ARTA processing deadline, mirroring the backend (WorkingDayCalendar): arta_due_date is set at filing
 * (working days with the Holiday Calendar skipped; calendar days for ordinances / resolutions) and moved by the
 * one extension. The office may act until the end of the due day, office time (Asia/Manila).
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const CLOSED_STATUSES = ['completed', 'released', 'archived', 'vetoed', 'deemed_approved'];

/** "2026-10-13" from "2026-10-13", "2026-10-13T00:00:00.000000Z" or a Date */
function datePart(value: any): string | null {
    if (!value) {
        return null;
    }
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);

    return match ? match[0] : null;
}

/** Today's date in office time */
function officeToday(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/** The due day (shown as a date); null when the document has no deadline yet. */
export function getArtaDueDate(doc: any): Date | null {
    const due = datePart(doc?.arta_due_date);
    if (!due) {
        return null;
    }
    // Noon office time, so the date shows the same day in any viewer time zone
    const date = new Date(`${due}T12:00:00+08:00`);

    return isNaN(date.getTime()) ? null : date;
}

/** Whole calendar days until the due day (0 = due today, negative = overdue); undefined once the document is closed. */
export function getArtaDaysLeft(doc: any): number | undefined {
    if (CLOSED_STATUSES.includes(String(doc?.status || '').toLowerCase())) {
        return undefined;
    }
    const due = datePart(doc?.arta_due_date);
    if (!due) {
        return undefined;
    }

    return Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${officeToday()}T00:00:00Z`)) / DAY_MS);
}
