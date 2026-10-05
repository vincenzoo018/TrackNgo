import { Head, Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { DocumentVersionHistory } from '@/components/trackngo/DocumentVersionHistory';
import type { RevisionInfo } from '@/components/trackngo/DocumentVersionHistory';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';

type Props = {
    dbDocument?: { document_id: number; reference_number: string; tracking_number?: string | null; title?: string; status?: string };
    revisions?: RevisionInfo;
};

/**
 * Every version of a document's main file ({role}/documents/{id}/versions). New versions are uploaded from the
 * document page, where the person holding the document has "Upload New Version".
 */
export default function VersionHistory({ dbDocument, revisions }: Props) {
    const [toast, setToast] = useState<string | null>(null);
    const id = dbDocument?.document_id;
    const docRef = dbDocument?.tracking_number || dbDocument?.reference_number || `#${id}`;
    // The universal /documents/{id} route opens the document page of the viewer's own role
    const documentUrl = `/documents/${id}`;

    return (
        <TrackngoLayout
            breadcrumbs={[
                { title: 'Document', href: documentUrl },
                { title: docRef, href: documentUrl },
                { title: 'Version History', href: '#' },
            ]}
        >
            <Head title="Version History — TrackNGo Mati" />

            {toast && (
                <div className="fixed top-4 right-4 z-50 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-lg">{toast}</div>
            )}

            <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--tng-slate-900)]">Version History</h1>
                        <p className="mt-0.5 text-sm text-[var(--tng-slate-500)]">
                            {docRef}{dbDocument?.title ? ` — ${dbDocument.title}` : ''} · Current: Version {revisions?.current ?? 1}
                        </p>
                    </div>
                    <Link
                        href={documentUrl}
                        className="flex items-center gap-1.5 rounded-lg border border-[var(--tng-slate-200)] bg-white px-3 py-2 text-sm font-medium text-[var(--tng-slate-600)] transition-colors hover:bg-[var(--tng-slate-50)]"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Document
                    </Link>
                </div>

                <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white">
                    <DocumentVersionHistory
                        documentId={id ?? 0}
                        reference={dbDocument?.reference_number}
                        info={revisions}
                        onDownloaded={(message) => {
                            setToast(message);
                            setTimeout(() => setToast(null), 3500);
                        }}
                    />
                </div>
            </div>
        </TrackngoLayout>
    );
}
