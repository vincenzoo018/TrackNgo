// ── User Roles ──────────────────────────────────────────────────────
export type UserRole = 'admin' | 'mayor' | 'department_head' | 'receiving' | 'cart' | 'hr' | 'client';

export const ROLE_LABELS: Record<UserRole, string> = {
    admin: 'System Administrator',
    mayor: 'City Mayor',
    department_head: 'Department Head',
    receiving: 'Receiving Office',
    cart: 'CART Personnel',
    hr: 'Human Resources',
    client: 'Client',
};

// ── Department ──────────────────────────────────────────────────────
export type Department = {
    id: number;
    name: string;
    code: string;
    description?: string;
    head_id?: number;
    is_active: boolean;
};

// ── Document Type ───────────────────────────────────────────────────
export type DocumentType = {
    id: number;
    name: string;
    description?: string;
    arta_processing_days: 3 | 7 | 20;
    is_active: boolean;
};

// ── Document Status (FSM States) ────────────────────────────────────
export type DocumentStatus =
    | 'submitted'
    | 'dept_accepted'
    | 'endorsed'
    | 'mayor_accepted'
    | 'reviewed'
    | 'approved'
    | 'released'
    | 'returned'
    | 'rejected'
    | 'escalated'
    | 'completed'
    | 'archived';

export const STATUS_LABELS: Record<DocumentStatus, string> = {
    submitted: 'Submitted',
    dept_accepted: 'Accepted',
    endorsed: 'Endorsed',
    mayor_accepted: 'Accepted',
    reviewed: 'Reviewed',
    approved: 'Approved',
    released: 'Released',
    returned: 'Returned',
    rejected: 'Rejected',
    escalated: 'Escalated',
    completed: 'Completed',
    archived: 'Archived',
};

export const WORKFLOW_STEPS: { key: DocumentStatus; label: string }[] = [
    { key: 'submitted', label: 'Submitted' },
    { key: 'dept_accepted', label: 'Accepted' },
    { key: 'endorsed', label: 'Endorsed' },
    { key: 'mayor_accepted', label: 'Accepted' },
    { key: 'reviewed', label: 'Reviewed' },
    { key: 'approved', label: 'Approved' },
    { key: 'released', label: 'Released' },
];

// ── Classification ──────────────────────────────────────────────────
export type DocumentClassification = 'normal' | 'urgent';

// ── Document ────────────────────────────────────────────────────────
export type Document = {
    id: number;
    reference_number: string; // TNG-YYYY-NNNN
    tracking_number: string;
    title: string;
    document_type: DocumentType;
    department: Department;
    submitted_by: string;
    current_holder?: string;
    current_holder_department?: string;
    classification: DocumentClassification;
    urgency_justification?: string;
    status: DocumentStatus;
    contact_number?: string;
    file_path?: string;
    qr_code_path?: string;
    ocr_text?: string;
    step_progress: number; // current step 1-5
    total_steps: number; // typically 5
    arta_due_date?: string;
    arta_days_left?: number; // positive = days remaining, negative = overdue
    arta_threshold?: 3 | 7 | 20;
    submitted_at: string;
    completed_at?: string;
    created_at: string;
    updated_at: string;
    linked_document?: string;
    version?: string;
    sender?: string;
};

// ── Routing Slip ────────────────────────────────────────────────────
export type RoutingSlip = {
    id: number;
    document_id: number;
    document?: Document;
    from_user_id?: number;
    from_user: string;
    to_user_id?: number;
    to_user: string;
    from_department_id?: number;
    from_department: string;
    to_department_id?: number;
    to_department: string;
    instruction: string;
    action: 'forward' | 'return' | 'reject' | 'endorse';
    status: 'active' | 'completed' | 'returned';
    created_at: string;
};

// ── Digital Signature ───────────────────────────────────────────────
export type DigitalSignature = {
    id: number;
    signed_by_user_id: number;
    user_name: string;
    document_id: number;
    signature_image?: string;
    signature_hash: string;
    action_type?: string;
    ip_address: string;
    signed_at: string;
};

// ── ARTA Escalation ─────────────────────────────────────────────────
export type EscalationLevel = 'warning' | 'critical' | 'overdue';

export type ArtaEscalation = {
    id: number;
    document_id: number;
    document?: Document;
    arta_threshold: 3 | 7 | 20;
    days_elapsed: number;
    escalation_level: EscalationLevel;
    notified_user: string;
    notification_sent: boolean;
    resolved: boolean;
    escalated_at: string;
    resolved_at?: string;
};

// ── Audit Trail ─────────────────────────────────────────────────────
export type AuditTrailEntry = {
    id: number;
    document_id?: number;
    user_id?: number;
    user: string;
    user_role: UserRole;
    department: string;
    document_ref?: string;
    action: string;
    description: string;
    ip_address: string;
    timestamp: string;
};

// ── SMS Notification ────────────────────────────────────────────────
export type SmsNotification = {
    id: number;
    document_ref: string;
    recipient_name: string;
    mobile_number: string;
    message: string;
    status: 'sent' | 'failed' | 'pending';
    sent_at?: string;
    created_at: string;
};

// ── Document Comment ────────────────────────────────────────────────
export type DocumentComment = {
    id: number;
    document_id: number;
    user: string;
    user_role: UserRole;
    comment: string;
    is_anchored: boolean;
    created_at: string;
};

// ── Dashboard Stats ─────────────────────────────────────────────────
export type DashboardStats = {
    total_documents: number;
    completed: number;
    in_progress: number;
    returned: number;
    pending: number;
    escalated: number;
    completion_rate: number;
};

// ── Chart Data ──────────────────────────────────────────────────────
export type BottleneckData = {
    stage: string;
    count: number;
};

export type StatusDistribution = {
    label: string;
    value: number;
    color: string;
};

// ── Page Props ──────────────────────────────────────────────────────
export type TrackngoUser = {
    id: number;
    name: string;
    email: string;
    role: UserRole;
    department?: Department;
    avatar?: string;
    phone?: string;
    is_active: boolean;
};
