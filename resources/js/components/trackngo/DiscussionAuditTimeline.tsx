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
    Radio, 
    X,
    Filter,
    FileText,
    Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getStandardizedStatus, STATUS_STYLE_CONFIG, StandardizedStatus } from '@/lib/status-helper';
import { SeverityPill } from '@/components/trackngo/SeverityPill';

export interface TimelineEntry {
    _id: string;
    _type: 'action' | 'comment';
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
    user?: any;
}

interface DiscussionAuditTimelineProps {
    document: any;
    auditTrail?: any[];
    comments?: any[];
    selectedSnippet?: string;
    onClearSnippet?: () => void;
    className?: string;
    onActionCompleted?: () => void;
}

export function DiscussionAuditTimeline({
    document: doc,
    auditTrail = [],
    comments = [],
    selectedSnippet = '',
    onClearSnippet,
    className,
    onActionCompleted,
}: DiscussionAuditTimelineProps) {
    const { auth } = usePage<any>().props;
    const authUser = auth?.user;

    const [commentText, setCommentText] = useState('');
    const [filter, setFilter] = useState<'all' | 'actions' | 'comments'>('all');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Local state for optimistic updates
    const [localAudit, setLocalAudit] = useState<any[]>(auditTrail);
    const [localComments, setLocalComments] = useState<any[]>(comments);
    const [localStatus, setLocalStatus] = useState<string>(doc?.status || 'Ongoing');

    const timelineEndRef = useRef<HTMLDivElement>(null);

    // Sync when props change from Inertia reloads
    useEffect(() => {
        setLocalAudit(auditTrail);
    }, [auditTrail]);

    useEffect(() => {
        setLocalComments(comments);
    }, [comments]);

    useEffect(() => {
        if (doc?.status) {
            setLocalStatus(doc.status);
        }
    }, [doc?.status]);

    // Active real-time sync polling every 4 seconds without page reload
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
                    if (data.auditTrail) setLocalAudit(data.auditTrail);
                    if (data.comments) setLocalComments(data.comments);
                }
            })
            .catch(() => {
                // Background sync fail silent
            });
        }, 4000);

        return () => clearInterval(interval);
    }, [doc?.document_id]);

    // Unified chronological timeline
    const unifiedTimeline = useMemo(() => {
        const actionItems: TimelineEntry[] = (localAudit || []).map((t: any, idx: number) => {
            const dateVal = t.timestamp || t.created_at || new Date();
            const roleStr = t.user_role || t.user?.role?.role_name || (t.user?.role ? String(t.user.role) : 'User');
            const nameStr = t.user_name || (t.user ? (t.user.name || `${t.user.first_name || ''} ${t.user.last_name || ''}`.trim()) : 'User');
            
            return {
                _id: `audit-${t.audit_id || t.id || idx}-${dateVal}`,
                _type: 'action',
                _date: new Date(dateVal),
                action: t.action || 'Workflow Action',
                description: t.description || t.details || '',
                user_name: nameStr,
                user_role: roleStr,
                department: t.department || t.user?.department?.department_name || '',
                document_ref: t.document_ref || doc?.reference_number,
                user: t.user,
            };
        });

        const commentItems: TimelineEntry[] = (localComments || []).map((c: any, idx: number) => {
            const dateVal = c.created_at || new Date();
            const roleStr = c.user_role || c.user?.role?.role_name || 'User';
            const nameStr = c.user_name || (c.user ? (c.user.name || `${c.user.first_name || ''} ${c.user.last_name || ''}`.trim()) : 'User');

            return {
                _id: `comment-${c.id || idx}-${dateVal}`,
                _type: 'comment',
                _date: new Date(dateVal),
                comment: c.comment,
                is_anchored: Boolean(c.is_anchored || c.quoted_text),
                quoted_text: c.quoted_text,
                user_name: nameStr,
                user_role: roleStr,
                document_ref: doc?.reference_number,
                user: c.user,
            };
        });

        const combined = [...actionItems, ...commentItems];
        combined.sort((a, b) => a._date.getTime() - b._date.getTime());
        return combined;
    }, [localAudit, localComments, doc?.reference_number]);

    // Filtered timeline
    const filteredTimeline = useMemo(() => {
        if (filter === 'actions') return unifiedTimeline.filter(t => t._type === 'action');
        if (filter === 'comments') return unifiedTimeline.filter(t => t._type === 'comment');
        return unifiedTimeline;
    }, [unifiedTimeline, filter]);

    const standardizedStatus = getStandardizedStatus(localStatus);
    const statusConfig = STATUS_STYLE_CONFIG[standardizedStatus];

    // Handle Comment / Anchored Note Submit
    const handleSendComment = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const trimmed = commentText.trim();
        if (!trimmed) return;

        setIsSubmitting(true);
        const quoted = selectedSnippet ? selectedSnippet.trim() : null;

        // Optimistic entry
        const optimisticComment: TimelineEntry = {
            _id: `temp-${Date.now()}`,
            _type: 'comment',
            _date: new Date(),
            comment: trimmed,
            is_anchored: Boolean(quoted),
            quoted_text: quoted || undefined,
            user_name: authUser?.name || 'You',
            user_role: authUser?.role?.role_name || 'User',
            document_ref: doc?.reference_number,
        };

        const optimisticAudit: TimelineEntry = {
            _id: `temp-audit-${Date.now()}`,
            _type: 'action',
            _date: new Date(),
            action: quoted ? 'Anchor' : 'Comment',
            description: quoted 
                ? `Anchored note added on excerpt: "${quoted.substring(0, 50)}..."` 
                : `Comment posted: ${trimmed.substring(0, 60)}`,
            user_name: authUser?.name || 'You',
            user_role: authUser?.role?.role_name || 'User',
            document_ref: doc?.reference_number,
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
            },
        });
    };

    const getActionBadge = (actionStr: string = '') => {
        const act = actionStr.toLowerCase();
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
        <div className={cn("flex flex-col h-[560px] rounded-[8px] border border-slate-200 bg-white overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.2)]", className)}>
            {/* Header: 16px semi-bold with Standardized Status Badge & Real-Time Pulse */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                    <h3 className="text-[16px] font-semibold text-slate-900 tracking-tight flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-blue-600" />
                        Discussion & Audit Timeline
                    </h3>
                    <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200" title="Real-time timeline synchronization active">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Live
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    {/* Status Pill */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-medium text-slate-500">Status:</span>
                        <SeverityPill status={standardizedStatus} />
                    </div>

                    {/* Filter Pills */}
                    <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-[12px]">
                        <button
                            type="button"
                            onClick={() => setFilter('all')}
                            className={cn(
                                "px-2.5 py-1 rounded-[6px] font-medium transition-colors",
                                filter === 'all' 
                                    ? "bg-slate-800 text-white shadow-xs" 
                                    : "text-slate-600 hover:text-slate-900"
                            )}
                        >
                            All ({unifiedTimeline.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilter('actions')}
                            className={cn(
                                "px-2 py-1 rounded-[6px] font-medium transition-colors",
                                filter === 'actions' 
                                    ? "bg-slate-800 text-white shadow-xs" 
                                    : "text-slate-600 hover:text-slate-900"
                            )}
                        >
                            Actions ({localAudit.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilter('comments')}
                            className={cn(
                                "px-2 py-1 rounded-[6px] font-medium transition-colors",
                                filter === 'comments' 
                                    ? "bg-slate-800 text-white shadow-xs" 
                                    : "text-slate-600 hover:text-slate-900"
                            )}
                        >
                            Messages ({localComments.length})
                        </button>
                    </div>
                </div>
            </div>

            {/* Timeline Stream: Spacing between entries */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30 tng-scrollbar">
                {filteredTimeline.length > 0 ? (
                    filteredTimeline.map((item) => {
                        if (item._type === 'action') {
                            const badge = getActionBadge(item.action);
                            return (
                                <div
                                    key={item._id}
                                    className="rounded-[8px] border border-slate-200/90 bg-white p-3.5 shadow-[0_4px_12px_rgba(0,0,0,0.2)] transition-all hover:border-slate-300"
                                >
                                    {/* Action Header Row */}
                                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className={cn(
                                                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] text-[12px] font-semibold border",
                                                badge.bg
                                            )}>
                                                {badge.icon}
                                                Action: {badge.label}
                                            </span>
                                            {item.document_ref && (
                                                <span className="font-mono text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                                                    Ref: {item.document_ref}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[12px] font-medium text-slate-400">
                                            {item._date.toLocaleString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
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
                                </div>
                            );
                        } else {
                            // Comment or Anchored Note
                            return (
                                <div
                                    key={item._id}
                                    className="rounded-[8px] border border-slate-200/90 bg-white p-3.5 shadow-[0_4px_12px_rgba(0,0,0,0.2)] transition-all hover:border-slate-300"
                                >
                                    <div className="flex items-center justify-between gap-2 mb-2">
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
                                                year: 'numeric',
                                                hour: 'numeric',
                                                minute: '2-digit',
                                                hour12: true
                                            })}
                                        </span>
                                    </div>

                                    {/* Quoted passage if anchored note */}
                                    {item.is_anchored && item.quoted_text && (
                                        <div className="mb-2.5 rounded-r-[6px] border-l-4 border-violet-500 bg-violet-50/70 p-2 text-[13px] text-violet-900 italic flex items-start gap-1.5">
                                            <Bookmark className="h-3.5 w-3.5 text-violet-600 shrink-0 mt-0.5" />
                                            <span>"{item.quoted_text}"</span>
                                        </div>
                                    )}

                                    {/* 14px body text */}
                                    <p className="text-[14px] text-slate-800 leading-relaxed whitespace-pre-wrap">
                                        {item.comment}
                                    </p>
                                </div>
                            );
                        }
                    })
                ) : (
                    <div className="flex flex-col items-center justify-center h-full py-12 text-center text-slate-400">
                        <MessageSquare className="h-8 w-8 text-slate-300 mb-2" />
                        <p className="text-[14px] font-medium">No activity or discussion entries yet.</p>
                        <p className="text-[12px] text-slate-400 mt-0.5">Workflow actions and user messages will appear here in real time.</p>
                    </div>
                )}
                <div ref={timelineEndRef} />
            </div>

            {/* Input Composer: Compiled within Discussion */}
            <div className="border-t border-slate-200 bg-white p-3">
                {/* Active Anchor Banner */}
                {selectedSnippet && (
                    <div className="mb-2 flex items-center justify-between gap-2 rounded-[6px] border border-violet-200 bg-violet-50/80 px-3 py-1.5 text-[12px] text-violet-900 animate-in fade-in duration-150">
                        <div className="flex items-center gap-1.5 truncate">
                            <Bookmark className="h-3.5 w-3.5 text-violet-600 shrink-0" />
                            <span className="font-semibold">Anchor to:</span>
                            <span className="truncate italic">"{selectedSnippet}"</span>
                        </div>
                        {onClearSnippet && (
                            <button
                                type="button"
                                onClick={onClearSnippet}
                                className="text-violet-600 hover:text-violet-900 p-0.5 rounded hover:bg-violet-100"
                                title="Cancel anchor quote"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                )}

                <form onSubmit={handleSendComment} className="flex items-center gap-2">
                    <input
                        type="text"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder={selectedSnippet ? "Write an anchored note on this excerpt..." : "Write a message or observation..."}
                        className="flex-1 rounded-[8px] border border-slate-200 bg-slate-50 px-3.5 py-2 text-[14px] text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                        disabled={isSubmitting}
                    />
                    <button
                        type="submit"
                        disabled={!commentText.trim() || isSubmitting}
                        className={cn(
                            "inline-flex items-center justify-center gap-1.5 rounded-[8px] px-4 py-2 text-[14px] font-semibold text-white transition-all",
                            commentText.trim() && !isSubmitting
                                ? "bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/20 active:scale-98"
                                : "bg-slate-300 text-slate-500 cursor-not-allowed"
                        )}
                    >
                        <Send className="h-4 w-4" />
                        <span>{selectedSnippet ? "Anchor" : "Send"}</span>
                    </button>
                </form>
            </div>
        </div>
    );
}

export default DiscussionAuditTimeline;
