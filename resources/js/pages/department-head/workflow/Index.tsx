import { Head } from '@inertiajs/react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { GitMerge, MoreHorizontal, MessageSquare, Clock, ArrowRight } from 'lucide-react';
import { mockDocuments } from '@/lib/mock-data';
import { SeverityPill } from '@/components/trackngo/SeverityPill';

export default function WorkflowApprovals() {
    const incoming = mockDocuments.filter(d => d.status === 'submitted' || d.status === 'received');
    const inReview = mockDocuments.filter(d => d.status === 'in_progress');
    const completed = mockDocuments.filter(d => d.status === 'approved' || d.status === 'escalated'); // Mock grouping

    const KanbanCard = ({ doc }: { doc: any }) => (
        <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-4 shadow-sm cursor-grab active:cursor-grabbing hover:border-[var(--tng-blue-300)] transition-colors">
            <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold text-[var(--tng-blue-600)]">{doc.reference_number}</span>
                <button className="text-[var(--tng-slate-400)] hover:text-[var(--tng-slate-700)]"><MoreHorizontal className="h-4 w-4" /></button>
            </div>
            <h4 className="text-sm font-semibold text-[var(--tng-slate-800)] mb-2 line-clamp-2">{doc.title}</h4>
            <div className="flex items-center justify-between mt-4 border-t border-[var(--tng-slate-100)] pt-3">
                <SeverityPill status={doc.status} />
                <div className="flex items-center gap-2 text-[var(--tng-slate-400)] text-xs">
                    <Clock className="h-3.5 w-3.5" /> {doc.arta_days_left}d
                </div>
            </div>
        </div>
    );

    return (
        <TrackngoLayout role="department-head">
            <Head title="Workflow Approvals — TrackNGo Mati" />

            <div className="flex h-[calc(100vh-140px)] flex-col space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between shrink-0 gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--tng-slate-900)] flex items-center gap-2">
                            <GitMerge className="h-6 w-6 text-[var(--tng-blue-600)]" />
                            Workflow Approvals (Kanban)
                        </h1>
                        <p className="mt-0.5 text-sm text-[var(--tng-slate-500)]">
                            Drag and drop documents to update their processing status.
                        </p>
                    </div>
                </div>

                {/* Kanban Board */}
                <div className="flex-1 overflow-x-auto pb-4">
                    <div className="flex h-full min-w-[900px] gap-6">
                        
                        {/* Column 1 */}
                        <div className="flex h-full w-1/3 flex-col rounded-xl bg-[var(--tng-slate-50)] p-4 border border-[var(--tng-slate-200)]">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-[var(--tng-slate-700)]">Incoming Queue</h3>
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-[var(--tng-slate-500)] shadow-sm">{incoming.length}</span>
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-3 tng-scrollbar pr-2">
                                {incoming.map(doc => <KanbanCard key={doc.id} doc={doc} />)}
                            </div>
                        </div>

                        {/* Column 2 */}
                        <div className="flex h-full w-1/3 flex-col rounded-xl bg-amber-50/50 p-4 border border-amber-200/50">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-amber-800">In Review</h3>
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-amber-600 shadow-sm">{inReview.length}</span>
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-3 tng-scrollbar pr-2">
                                {inReview.map(doc => <KanbanCard key={doc.id} doc={doc} />)}
                            </div>
                        </div>

                        {/* Column 3 */}
                        <div className="flex h-full w-1/3 flex-col rounded-xl bg-emerald-50/50 p-4 border border-emerald-200/50">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-emerald-800">Endorsed / Completed</h3>
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-emerald-600 shadow-sm">{completed.length}</span>
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-3 tng-scrollbar pr-2">
                                {completed.map(doc => <KanbanCard key={doc.id} doc={doc} />)}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </TrackngoLayout>
    );
}
