import { Head, usePage } from '@inertiajs/react';
import { useState } from 'react';
import CreateDocumentModal from '@/components/trackngo/CreateDocumentModal';
import { DocumentListView } from '@/components/trackngo/DocumentListView';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { isCurrentHolder } from '@/lib/document-holder';
import { getStandardizedStatus, isFinalizedOrArchived } from '@/lib/status-helper';

export default function AdminDocumentsIndex() {
    const { props } = usePage<any>();
    const documents = (props.dbDocuments || []) as any[];
    const departments = (props.dbDepartments || []) as any[];
    const documentTypes = (props.dbDocumentTypes || []) as any[];
    const authUser = props.auth?.user;
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // Active documents are grouped by standardized status; finished ones live under "Archived"
    const activeWithStatus = (status: string) => (doc: any) =>
        !isFinalizedOrArchived(doc.status) && getStandardizedStatus(doc.status) === status;

    return (
        <TrackngoLayout role="admin">
            <Head title="All Documents — TrackNGo Mati" />

            <DocumentListView
                title="All Documents"
                documents={documents}
                departments={departments}
                documentTypes={documentTypes}
                basePath="/admin/documents"
                needsAction={(doc) => !isFinalizedOrArchived(doc.status) && isCurrentHolder(doc, authUser)}
                allFilter={(doc) => !isFinalizedOrArchived(doc.status)}
                tabs={[
                    { id: 'received', label: 'Received', match: activeWithStatus('Received') },
                    { id: 'ongoing', label: 'Ongoing', match: activeWithStatus('Ongoing') },
                    { id: 'sent', label: 'Sent', match: activeWithStatus('Sent') },
                    { id: 'returned', label: 'Returned', match: activeWithStatus('Returned') },
                    { id: 'archived', label: 'Archived', match: (d) => isFinalizedOrArchived(d.status) },
                ]}
                deleteUrl={(doc) => `/admin/documents/${doc.document_id}`}
                onCreate={() => setIsCreateModalOpen(true)}
                exportFileName="documents.csv"
            />

            <CreateDocumentModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                departments={departments}
                documentTypes={documentTypes}
                users={(props.dbUsers || []) as any[]}
            />
        </TrackngoLayout>
    );
}
