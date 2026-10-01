import { Head, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { DocumentListView } from '@/components/trackngo/DocumentListView';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { isCurrentHolder } from '@/lib/document-holder';
import CreateDocumentModal from './CreateDocumentModal';

export default function DepartmentHeadEndorsements() {
    const { props } = usePage<any>();
    const documents = (props.dbDocuments || []) as any[];
    const departments = (props.dbDepartments || []) as any[];
    const documentTypes = (props.dbDocumentTypes || []) as any[];
    const users = (props.dbUsers || []) as any[];
    const authUser = props.auth?.user;
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const statusOf = (doc: any) => (doc.status || '').toLowerCase();
    const isFinished = (doc: any) => ['completed', 'approved', 'archived'].includes(statusOf(doc));
    // Received: waiting with / accepted by this Dept Head (they are the current holder)
    const isReceivedByMe = (doc: any) => isCurrentHolder(doc, authUser) &&
        ['received', 'accepted', 'sent', 'endorsed', 'pending', 'registered'].includes(statusOf(doc));
    // Sent: filed or forwarded by this Dept Head and now with someone else (forwarded_by_me comes from the route query)
    const isSentByMe = (doc: any) => !isCurrentHolder(doc, authUser) && !isFinished(doc) &&
        statusOf(doc) !== 'returned' &&
        (String(doc.submitted_by) === String(authUser?.id) || Boolean(doc.forwarded_by_me));

    return (
        <TrackngoLayout role="department-head">
            <Head title="All Documents — TrackNGo Mati" />

            <DocumentListView
                title="All Documents"
                documents={documents}
                departments={departments}
                documentTypes={documentTypes}
                basePath="/department-head/documents"
                needsAction={(doc) => isCurrentHolder(doc, authUser) && !isFinished(doc)}
                allFilter={(doc) => statusOf(doc) !== 'archived'}
                tabs={[
                    { id: 'received', label: 'Received', match: isReceivedByMe },
                    { id: 'sent', label: 'Sent', match: isSentByMe },
                    { id: 'ongoing', label: 'Ongoing', match: (d) => !isFinished(d) },
                    { id: 'completed', label: 'Completed', match: isFinished },
                ]}
                onCreate={() => setIsCreateModalOpen(true)}
                exportFileName="endorsements.csv"
            />

            <CreateDocumentModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                departments={departments}
                documentTypes={documentTypes}
                users={users}
            />
        </TrackngoLayout>
    );
}
