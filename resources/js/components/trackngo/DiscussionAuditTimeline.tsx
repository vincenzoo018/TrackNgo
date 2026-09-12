import React, { useState, useEffect, useMemo, useRef } from 'react';
import { router, usePage } from '@inertiajs/react';
import { 
    Send, 
    RotateCcw, 
    CheckCircle2, 
    Forward, 
    FileSearch, 
    Download, 
    Bookmark, 
    MessageSquare, 
    History, 
    X,
    FileText,
    Sparkles,
    Paperclip,
    UploadCloud,
    AlertCircle,
    Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getStandardizedStatus, STATUS_STYLE_CONFIG, StandardizedStatus } from '@/lib/status-helper';
import { SeverityPill } from '@/components/trackngo/SeverityPill';

export interface TimelineEntry {
    _id: string;
    _type: 'action' | 'comment' | 'attachment';
    _date: Date;
    action?: string;
    description?: string;
    details?: string;
    user_name?: string;
    user_role?: string;
    department?: string;
    document_ref?: string;
    comment?: string;
    is_anchored?: boolean;
    quoted_text?: string;
    file_name?: string;
    file_path?: string;
    file_size?: number;
    file_type?: string;
    reason?: string;
    url?: string | null;
    user?: any;
}

interface DiscussionAuditTimelineProps {
    document: any;
    auditTrail?: any[];
    comments?: any[];
    attachments?: any[];
    selectedSnippet?: string;
    onClearSnippet?: () => void;
    onOpenCorrectionModal?: () => void;
    className?: string;
    onActionCompleted?: () => void;
}

function formatBytes(bytes?: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function DiscussionAuditTimeline({
    document: doc,
    auditTrail = [],
    comments = [],
    attachments = [],
    selectedSnippet = '',
    onClearSnippet,
    onOpenCorrectionModal,
    className,
    onActionCompleted,
}: DiscussionAuditTimelineProps) {
    const { auth } = usePage<any>().props;
    const authUser = auth?.user;

    // Distinct Panels: 'discussion' vs 'audit'
    const [activePanel, setActivePanel] = useState<'discussion' | 'audit'>('discussion');
    const [commentText, setCommentText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Local state for optimistic updates and real-time polling
    const [localAudit, setLocalAudit] = useState<any[]>(auditTrail);
    const [localComments, setLocalComments] = useState<any[]>(comments);
    const [localAttachments, setLocalAttachments] = useState<any[]>(attachments);
    const [localStatus, setLocalStatus] = useState<string>(doc?.status || 'Ongoing');
    const [localReturnReason, setLocalReturnReason] = useState<string>(doc?.return_reason || '');

    const discussionEndRef = useRef<HTMLDivElement>(null);
    const auditEndRef = useRef<HTMLDivElement>(null);

    // Sync when props change from Inertia visits
    useEffect(() => {
        setLocalAudit(auditTrail);
    }, [auditTrail]);

    useEffect(() => {
        setLocalComments(comments);
    }, [comments]);

    useEffect(() => {
        setLocalAttachments(attachments);
    }, [attachments]);

    useEffect(() => {
        if (doc?.status) {
            setLocalStatus(doc.status);
        }
        if (doc?.return_reason) {
            setLocalReturnReason(doc.return_reason);
        }
    }, [doc?.status, doc?.return_reason]);

    // Active real-time background sync polling every 3.5 seconds
    useEffect(() => {
        if (!doc?.document_id) return;
        const interval = setInterval(() => {
            fetch(`/documents/${doc.document_id}/timeline-sync`, {
                headers: { 'Accept': 'application/json' }
            })
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (data) {
                    if (data.status) setLocalStatus(data.status);
                    if (data.return_reason) setLocalReturnReason(data.return_reason);
                    if (data.auditTrail) setLocalAudit(data.auditTrail);
                    if (data.comments) setLocalComments(data.comments);
                    if (data.attachments) setLocalAttachments(data.attachments);
                }
            })
            .catch(() => {
                // Silent fail in background
            });
        }, 3500);

        return () => clearInterval(interval);
    }, [doc?.document_id]);

    const standardizedStatus: StandardizedStatus = getStandardizedStatus(localStatus);
    const isReturned = standardizedStatus === 'Returned';

    // Extract return reason from local state or latest audit trail entry
    const returnReason = useMemo(() => {
        if (localReturnReason) return localReturnReason;
        if (doc?.return_reason) return doc.return_reason;
        const returnEntry = [...localAudit].reverse().find(a => (a.action || '').toLowerCase() === 'return');
        if (returnEntry?.description) {
            const match = returnEntry.description.match(/Reason (?:for return: |: )(.*)/i);
            return match ? match[1] : returnEntry.description;
        }
        return 'Document requires remediation or missing files.';
    }, [localReturnReason, doc?.return_reason, localAudit]);

    // 1. Audit Trail Entries (strictly authenticated actions & uploads)
    const auditEntries = useMemo(() => {
        const attachmentFileNames = new Set(
            (localAttachments || []).map((att: any) => (att.file_name || '').toLowerCase())
        );

        const actionItems: TimelineEntry[] = (localAudit || []).filter((t: any) => {
            if ((t.action || '').toLowerCase() === 'add attachment') {
                const desc = (t.description || '').toLowerCase();
                for (const fn of attachmentFileNames) {
                    if (fn && desc.includes(fn)) return false;
                }
            }
            return true;
        }).map((t: any, idx: number) => {
            const dateVal = t.timestamp || t.created_at || new Date();
            const roleStr = t.user_role || t.user?.role?.role_name || (t.user?.role ? String(t.user.role) : 'User');
            const nameStr = t.user_name || (t.user ? (t.user.name || `${t.user.first_name || ''} ${t.user.last_name || ''}`.trim()) : 'User');
            
            return {
                _id: `audit-${t.audit_id || t.id || idx}-${dateVal}`,
                _type: 'action',
                _date: new Date(dateVal),
                action: t.action || 'Action',
                description: t.description || '',
                user_name: nameStr,
                user_role: roleStr,
                department: t.department || t.user?.department?.department_name || '',
                document_ref: t.document_ref || doc?.reference_number,
            };
        });

        const attachmentItems: TimelineEntry[] = (localAttachments || []).map((att: any, idx: number) => {
            const dateVal = att.created_at || new Date();
            const roleStr = att.user_role || att.user?.role?.role_name || 'User';
            const nameStr = att.user_name || att.user?.name || 'User';

            return {
                _id: `att-${att.attachment_id || att.id || idx}-${dateVal}`,
                _type: 'attachment',
                _date: new Date(dateVal),
                action: 'Add Attachment',
                file_name: att.file_name,
                file_path: att.file_path,
                file_size: att.file_size,
                file_type: att.file_type,
                reason: att.reason,
                url: att.url || (att.file_path ? `/storage/${att.file_path}` : null),
                user_name: nameStr,
                user_role: roleStr,
                document_ref: doc?.reference_number,
                description: `Uploaded corrected attachment: ${att.file_name}${att.reason ? ` (Note: ${att.reason})` : ''}`,
            };
        });

        const merged = [...actionItems, ...attachmentItems];
        merged.sort((a, b) => b._date.getTime() - a._date.getTime()); // Latest first in audit panel
        return merged;
    }, [localAudit, localAttachments, doc?.reference_number]);

    // 2. Discussion Entries (strictly user messages & anchored comments)
    const discussionEntries = useMemo(() => {
        const commentItems: TimelineEntry[] = (localComments || []).map((c: any, idx: number) => {
            const dateVal = c.created_at || new Date();
            const roleStr = c.user_role || c.user?.role?.role_name || (c.user?.role ? String(c.user.role) : 'User');
            const nameStr = c.user_name || (c.user ? (c.user.name || `${c.user.first_name || ''} ${c.user.last_name || ''}`.trim()) : 'User');

            return {
                _id: `comment-${c.comment_id || c.id || idx}-${dateVal}`,
                _type: 'comment',
                _date: new Date(dateVal),
                comment: c.comment,
                is_anchored: Boolean(c.is_anchored),
                quoted_text: c.quoted_text,
                user_name: nameStr,
                user_role: roleStr,
                document_ref: doc?.reference_number,
            };
        });

        commentItems.sort((a, b) => a._date.getTime() - b._date.getTime()); // Chronological reading order
        return commentItems;
    }, [localComments, doc?.reference_number]);

    // Handle Comment Submission
    const handleSendComment = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const trimmed = commentText.trim();
        if (!trimmed || isSubmitting) return;

        setIsSubmitting(true);
        const quoted = selectedSnippet.trim() || null;
        const isAnchored = Boolean(quoted);

        // Optimistic UI updates
        const now = new Date();
        const optimisticComment: any = {
            id: `opt-comment-${Date.now()}`,
            comment: trimmed,
            is_anchored: isAnchored,
            quoted_text: quoted,
            created_at: now.toISOString(),
            user_name: authUser?.name || 'You',
            user_role: authUser?.role?.role_name || 'User',
        };

        const optimisticAudit: any = {
            id: `opt-audit-${Date.now()}`,
            action: isAnchored ? 'Anchor' : 'Comment',
            description: isAnchored 
                ? `Anchored note added: "${quoted.substring(0, 50)}..." — ${trimmed}` 
                : trimmed,
            document_ref: doc?.reference_number,
            timestamp: now.toISOString(),
            user_name: authUser?.name || 'You',
            user_role: authUser?.role?.role_name || 'User',
        };

        setLocalComments(prev => [...prev, optimisticComment]);
        setLocalAudit(prev => [...prev, optimisticAudit]);
        setCommentText('');
        if (onClearSnippet) onClearSnippet();

        router.post(`/documents/${doc.document_id}/comments`, {
            comment: trimmed,
            quoted_text: quoted,
        }, {
            preserveScroll: true,
            preserveState: true,
            onFinish: () => {
                setIsSubmitting(false);
                if (onActionCompleted) onActionCompleted();
                setTimeout(() => {
                    discussionEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
            },
        });
    };

    const getActionBadge = (actionStr: string = '') => {
        const act = actionStr.toLowerCase();
        if (act.includes('attachment')) {
            return {
                label: 'Add Attachment',
                icon: <Paperclip className="h-3.5 w-3.5" />,
                bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            };
        }
        if (act.includes('submit')) {
            return {
                label: 'Submit',
                icon: <Send className="h-3.5 w-3.5" />,
                bg: 'bg-blue-50 text-blue-700 border-blue-200',
            };
        }
        if (act.includes('anchor')) {
            return {
                label: 'Anchor',
                icon: <Bookmark className="h-3.5 w-3.5" />,
                bg: 'bg-violet-50 text-violet-700 border-violet-200',
            };
        }
        if (act.includes('endorse') || act.includes('forward')) {
            return {
                label: 'Endorse',
                icon: <Forward className="h-3.5 w-3.5" />,
                bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
            };
        }
        if (act.includes('review')) {
            return {
                label: 'Review',
                icon: <FileSearch className="h-3.5 w-3.5" />,
                bg: 'bg-amber-50 text-amber-700 border-amber-200',
            };
        }
        if (act.includes('export')) {
            return {
                label: 'Export',
                icon: <Download className="h-3.5 w-3.5" />,
                bg: 'bg-teal-50 text-teal-700 border-teal-200',
            };
        }
        if (act.includes('return')) {
            return {
                label: 'Return',
                icon: <RotateCcw className="h-3.5 w-3.5" />,
                bg: 'bg-rose-50 text-rose-700 border-rose-200',
            };
        }
        if (act.includes('receive') || act.includes('accept')) {
            return {
                label: 'Receive',
                icon: <CheckCircle2 className="h-3.5 w-3.5" />,
                bg: 'bg-sky-50 text-sky-700 border-sky-200',
            };
        }
        return {
            label: actionStr,
            icon: <History className="h-3.5 w-3.5" />,
            bg: 'bg-slate-50 text-slate-700 border-slate-200',
        };
    };

    return (
        <div className={cn("flex flex-col rounded-[8px] border border-slate-200 bg-white overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.2)]", className)}>
            {/* Top Bar: Live indicator + Distinct Panel Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3">
                {/* Distinct Tabs */}
                <div className="flex items-center gap-1.5 rounded-[8px] border border-slate-200 bg-white p-1 shadow-2xs">
                    <button
                        type="button"
                        onClick={() => setActivePanel('discussion')}
                        className={cn(
                            "flex items-center gap-2 rounded-[6px] px-3 py-1.5 text-[14px] font-semibold transition-all",
                            activePanel === 'discussion'
                                ? "bg-blue-600 text-white shadow-xs"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        )}
                    >
                        <MessageSquare className="h-4 w-4" />
                        <span>Discussion</span>
                        <span className={cn(
                            "rounded-full px-1.5 py-0.2 text-[11px] font-bold",
                            activePanel === 'discussion' ? "bg-blue-700 text-white" : "bg-slate-200 text-slate-700"
                        )}>
                            {discussionEntries.length}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActivePanel('audit')}
                        className={cn(
                            "flex items-center gap-2 rounded-[6px] px-3 py-1.5 text-[14px] font-semibold transition-all",
                            activePanel === 'audit'
                                ? "bg-slate-900 text-white shadow-xs"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        )}
                    >
                        <History className="h-4 w-4" />
                        <span>Audit Trail</span>
                        <span className={cn(
                            "rounded-full px-1.5 py-0.2 text-[11px] font-bold",
                            activePanel === 'audit' ? "bg-slate-800 text-slate-100" : "bg-slate-200 text-slate-700"
                        )}>
                            {auditEntries.length}
                        </span>
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200" title="Real-time timeline synchronization active">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Live
                    </span>
                    <SeverityPill status={standardizedStatus} />
                </div>
            </div>

            {/* Returned Status Alert Banner: Prompts Document Correction Modal */}
            {isReturned && (
                <div className="border-b border-rose-200 bg-rose-50/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                            <div className="mt-0.5 rounded-[6px] bg-rose-100 p-1.5 text-rose-700">
                                <AlertCircle className="h-4 w-4" />
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-rose-950">
                                    Document Returned for Correction
                                </h4>
                                <p className="text-xs sm:text-[13px] font-medium text-slate-800 mt-1 leading-relaxed">
                                    <span className="font-semibold text-rose-900">Reason for return: </span>
                                    "{returnReason}"
                                </p>
                            </div>
                        </div>

                        {onOpenCorrectionModal && (
                            <button
                                type="button"
                                onClick={onOpenCorrectionModal}
                                className="inline-flex items-center gap-1.5 rounded-[8px] bg-rose-600 px-3 py-1.5 text-xs sm:text-[13px] font-semibold text-white shadow-[0_4px_12px_rgba(0,0,0,0.2)] hover:bg-rose-700 transition-all shrink-0 active:scale-98"
                            >
                                <Paperclip className="h-3.5 w-3.5" />
                                Correct Document
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* ── PANEL 1: DISCUSSION PANEL ── */}
            {activePanel === 'discussion' && (
                <div className="flex flex-col flex-1 min-h-[380px]">
                    {/* Discussion Message List */}
                    <div className="flex-1 overflow-y-auto tng-scrollbar p-4 space-y-3.5 max-h-[460px]">
                        {discussionEntries.length > 0 ? (
                            discussionEntries.map((item) => (
                                <div
                                    key={item._id}
                                    className="rounded-[8px] border border-slate-200/90 bg-white p-3.5 shadow-[0_4px_12px_rgba(0,0,0,0.2)] transition-all hover:border-slate-300"
                                >
                                    <div className="flex items-center justify-between gap-2 mb-1.5">
                                        <div className="flex items-center gap-2">
                                            <div className="h-6 w-6 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-[11px] font-bold text-blue-700 uppercase">
                                                {(item.user_name || 'U').substring(0, 2)}
                                            </div>
                                            <span className="text-[14px] font-semibold text-slate-900">
                                                {item.user_name}
                                            </span>
                                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200">
                                                {item.user_role}
                                            </span>
                                            {item.is_anchored && (
                                                <span className="inline-flex items-center gap-1 rounded bg-violet-50 px-1.5 py-0.5 text-[11px] font-medium text-violet-700 border border-violet-200">
                                                    <Bookmark className="h-3 w-3" />
                                                    Anchored
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[12px] font-medium text-slate-400">
                                            {item._date.toLocaleString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                hour: 'numeric',
                                                minute: '2-digit',
                                                hour12: true
                                            })}
                                        </span>
                                    </div>

                                    {/* Anchored Quote Passage */}
                                    {item.is_anchored && item.quoted_text && (
                                        <div className="mb-2 rounded-r-[6px] border-l-4 border-violet-500 bg-violet-50/70 p-2 text-[13px] text-violet-900 italic flex items-start gap-1.5">
                                            <Bookmark className="h-3.5 w-3.5 text-violet-600 shrink-0 mt-0.5" />
                                            <span>"{item.quoted_text}"</span>
                                        </div>
                                    )}

                                    {/* 14px body text */}
                                    <p className="text-[14px] text-slate-800 leading-relaxed whitespace-pre-wrap">
                                        {item.comment}
                                    </p>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full py-12 text-center text-slate-400">
                                <MessageSquare className="h-8 w-8 text-slate-300 mb-2" />
                                <p className="text-[14px] font-semibold text-slate-700">No discussion messages yet</p>
                                <p className="text-[12px] text-slate-400 mt-0.5">
                                    Leave notes or select text in the viewer to post an anchored comment.
                                </p>
                            </div>
                        )}
                        <div ref={discussionEndRef} />
                    </div>

                    {/* Active Anchored Snippet Banner */}
                    {selectedSnippet && (
                        <div className="border-t border-violet-200 bg-violet-50/90 px-4 py-2 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 truncate text-[13px] text-violet-900">
                                <Bookmark className="h-4 w-4 text-violet-600 shrink-0" />
                                <span className="font-semibold text-violet-800 shrink-0">Anchoring to text:</span>
                                <span className="truncate italic">"{selectedSnippet}"</span>
                            </div>
                            <button
                                type="button"
                                onClick={onClearSnippet}
                                className="rounded p-1 text-violet-400 hover:bg-violet-200 hover:text-violet-800 transition-colors"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    )}

                    {/* Discussion Message Composer */}
                    <form onSubmit={handleSendComment} className="border-t border-slate-200 bg-slate-50/50 p-3 flex items-center gap-2">
                        <input
                            type="text"
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder={selectedSnippet ? "Type anchored note about selected text..." : "Write a message or observation..."}
                            className="flex-1 rounded-[8px] border border-slate-200 bg-white px-3.5 py-2.5 text-[14px] text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
                        />
                        <button
                            type="submit"
                            disabled={!commentText.trim() || isSubmitting}
                            className={cn(
                                "inline-flex items-center gap-1.5 rounded-[8px] px-4 py-2.5 text-[14px] font-semibold text-white transition-all shadow-[0_4px_12px_rgba(0,0,0,0.2)] shrink-0",
                                commentText.trim() && !isSubmitting
                                    ? "bg-blue-600 hover:bg-blue-700 active:scale-98"
                                    : "bg-slate-300 cursor-not-allowed shadow-none"
                            )}
                        >
                            {isSubmitting ? (
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            ) : (
                                <>
                                    <Send className="h-4 w-4" />
                                    Send
                                </>
                            )}
                        </button>
                    </form>
                </div>
            )}

            {/* ── PANEL 2: AUDIT TRAIL PANEL ── */}
            {activePanel === 'audit' && (
                <div className="flex flex-col flex-1 min-h-[380px]">
                    <div className="flex-1 overflow-y-auto tng-scrollbar p-4 space-y-3.5 max-h-[520px]">
                        {auditEntries.length > 0 ? (
                            auditEntries.map((item) => {
                                if (item._type === 'attachment') {
                                    // Rich Attachment Card in Audit Trail
                                    return (
                                        <div
                                            key={item._id}
                                            className="rounded-[8px] border border-emerald-200 bg-white p-3.5 shadow-[0_4px_12px_rgba(0,0,0,0.2)] transition-all hover:border-emerald-300"
                                        >
                                            <div className="flex items-center justify-between gap-2 mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-0.5 text-[12px] font-semibold border bg-emerald-50 text-emerald-800 border-emerald-200">
                                                        <Paperclip className="h-3.5 w-3.5 text-emerald-600" />
                                                        Corrected Attachment
                                                    </span>
                                                    {item.document_ref && (
                                                        <span className="text-[12px] font-medium text-slate-500">
                                                            • Ref: {item.document_ref}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-[12px] font-medium text-slate-400">
                                                    {item._date.toLocaleString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        hour: 'numeric',
                                                        minute: '2-digit',
                                                        hour12: true
                                                    })}
                                                </span>
                                            </div>

                                            {/* Actor Information */}
                                            <div className="flex items-center gap-2 mb-2.5 text-[13px] text-slate-600">
                                                <div className="h-5 w-5 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center text-[10px] font-bold text-emerald-800 uppercase">
                                                    {(item.user_name || 'U').charAt(0)}
                                                </div>
                                                <span className="font-semibold text-slate-800">{item.user_name}</span>
                                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200">
                                                    {item.user_role}
                                                </span>
                                            </div>

                                            {/* File Box */}
                                            <div className="flex items-center justify-between gap-3 rounded-[6px] border border-slate-200 bg-slate-50 p-2.5">
                                                <div className="flex items-center gap-2.5 truncate">
                                                    <div className="p-1.5 rounded bg-emerald-100 text-emerald-700">
                                                        <FileText className="h-5 w-5 shrink-0" />
                                                    </div>
                                                    <div className="truncate">
                                                        <p className="text-[14px] font-semibold text-slate-800 truncate">
                                                            {item.file_name}
                                                        </p>
                                                        {item.file_size && (
                                                            <p className="text-[12px] text-slate-500">
                                                                {formatBytes(item.file_size)}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                {item.url && (
                                                    <a
                                                        href={item.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1.5 rounded-[6px] bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-xs shrink-0"
                                                    >
                                                        <Download className="h-3.5 w-3.5" />
                                                        Download / View
                                                    </a>
                                                )}
                                            </div>

                                            {item.reason && (
                                                <p className="mt-2 text-[14px] text-slate-700 leading-relaxed">
                                                    <span className="font-semibold text-slate-800">Correction Note: </span>
                                                    {item.reason}
                                                </p>
                                            )}
                                        </div>
                                    );
                                }

                                // Authenticated Workflow Action Entry
                                const badge = getActionBadge(item.action);
                                const isReturnAction = (item.action || '').toLowerCase().includes('return');

                                return (
                                    <div
                                        key={item._id}
                                        className={cn(
                                            "rounded-[8px] border p-3.5 shadow-[0_4px_12px_rgba(0,0,0,0.2)] transition-all",
                                            isReturnAction 
                                                ? "border-rose-200 bg-rose-50/40 hover:border-rose-300" 
                                                : "border-slate-200/90 bg-white hover:border-slate-300"
                                        )}
                                    >
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className={cn("inline-flex items-center gap-1 rounded-[6px] px-2 py-0.5 text-[11px] font-semibold border", badge.bg)}>
                                                    {badge.icon}
                                                    {badge.label}
                                                </span>
                                                {item.document_ref && (
                                                    <span className="text-[12px] font-medium text-slate-500">
                                                        • Ref: {item.document_ref}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-[12px] font-medium text-slate-400">
                                                {item._date.toLocaleString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: 'numeric',
                                                    minute: '2-digit',
                                                    hour12: true
                                                })}
                                            </span>
                                        </div>

                                        {/* Actor Information */}
                                        <div className="flex items-center gap-2 mb-2 text-[13px] text-slate-600">
                                            <div className="h-5 w-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-700 uppercase">
                                                {(item.user_name || 'U').charAt(0)}
                                            </div>
                                            <span className="font-semibold text-slate-800">{item.user_name}</span>
                                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200">
                                                {item.user_role}
                                            </span>
                                            {item.department && (
                                                <span className="text-[12px] text-slate-400">
                                                    • {item.department}
                                                </span>
                                            )}
                                        </div>

                                        {/* Action Description: 14px body text */}
                                        <p className="text-[14px] text-slate-700 leading-relaxed">
                                            {item.description}
                                        </p>

                                        {/* Highlight Box for Return Action */}
                                        {isReturnAction && item.description && (
                                            <div className="mt-2.5 rounded-[6px] border border-rose-200 bg-white p-2.5 text-[13px] text-rose-900 shadow-2xs">
                                                <span className="font-semibold block text-[11px] uppercase tracking-wider text-rose-700 mb-0.5">
                                                    Official Reason for Return:
                                                </span>
                                                <p className="text-[14px] text-slate-800 font-medium">
                                                    {item.description.replace(/^Document (?:marked as )?Returned\.? (?:Reason(?: for return)?: )?/i, '')}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full py-12 text-center text-slate-400">
                                <History className="h-8 w-8 text-slate-300 mb-2" />
                                <p className="text-[14px] font-semibold text-slate-700">No actions logged yet</p>
                                <p className="text-[12px] text-slate-400 mt-0.5">
                                    All authenticated workflow actions (Submit, Review, Return, etc.) are recorded here.
                                </p>
                            </div>
                        )}
                        <div ref={auditEndRef} />
                    </div>
                </div>
            )}
        </div>
    );
}

export default DiscussionAuditTimeline;
