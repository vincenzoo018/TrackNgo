/**
 * Current-holder helpers shared by the role document pages.
 *
 * The FSM moves a document by reassigning current_holder_id / current_holder_department_id
 * (see DocumentWorkflowService). Only the holder may act on it; everyone else sees a read-only status.
 * The same rule is enforced server-side in DocumentService::executeWorkflowAction().
 */

type HolderUser = { id?: number | string; department_id?: number | string | null } | null | undefined;

export function isCurrentHolder(doc: any, user: HolderUser): boolean {
    if (!doc || !user) return false;
    if (doc.current_holder_id) {
        return String(doc.current_holder_id) === String(user.id);
    }
    // Unassigned within an office: anyone in the holding department may act
    return Boolean(doc.current_holder_department_id) &&
        String(doc.current_holder_department_id) === String(user.department_id);
}

/** "Dr. Elena Pascual (Department Head, City Health Office)" — falls back to whatever is known. */
export function describeHolder(doc: any, users: any[] = []): string {
    const holder = doc?.current_holder;
    const holderUser = users.find((u: any) => String(u.id) === String(doc?.current_holder_id));
    const name = (holder?.name || holderUser?.name ||
        [holderUser?.first_name, holderUser?.last_name].filter(Boolean).join(' ')).replace(/\s+/g, ' ').trim();
    const role = holderUser?.role_name;
    const office = doc?.current_holder_department?.department_name || holderUser?.department_name;
    const details = [role, office].filter(Boolean).join(', ');

    if (name) return details ? `${name} (${details})` : name;
    return office || 'the next office';
}

export function isClosedStatus(status?: string | null): boolean {
    return ['completed', 'released', 'archived'].includes((status || '').toLowerCase());
}
