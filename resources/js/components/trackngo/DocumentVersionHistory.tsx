import { Download, Eye, FileText, PenLine } from 'lucide-react';
import { useState } from 'react';
import { formatBytes } from './DocumentRevisionModal';
import { ExportPasswordModal } from './ExportPasswordModal';
import { documentFileUrl } from '@/lib/document-files';

export type DocumentVersion = {
    revision_id: number;
    version_number: number;
    is_current: boolean;
    file_path: string;
    file_name: string;
    file_size: number | null;
    file_hash: string | null;
    reason: string;
    created_by: string;
    created_at: string | null;
    signed_file_path: string | null;
    signed_copy_signatures: number;
    signed_by: string[];
};

export type RevisionInfo = { current: number; versions: DocumentVersion[] };

type Props = {
    documentId: number | string;
    reference?: string;
    info: RevisionInfo | null | undefined;
    /** Show a version (or the copy signed on it) in the page's viewer; without it, files open in a new tab */
    onView?: (version: DocumentVersion, signedCopy: boolean) => void;
    onDownloaded?: (message: string) => void;
};

function formatDateTime(value?: string | null): string {
    if (!value) {
        return '';
    }

    const d = new Date(value);

    return isNaN(d.getTime())
        ? ''
        : `${d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}, ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
}

const linkButton = 'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-[#0066cc] hover:bg-blue-50';

/**
 * Every version of the document's main file, newest first: who uploaded it, when and why, and who signed it.
 * Earlier versions (and the copy signed on them) are viewed or downloaded; nothing here can change them.
 */
export function DocumentVersionHistory({ documentId, reference, info, onView, onDownloaded }: Props) {
    const [download, setDownload] = useState<{ revisionId: number; signed: boolean } | null>(null);
    const versions = info?.versions || [];

    if (versions.length === 0) {
        return <p className="p-5 text-[13px] text-slate-500">No file versions recorded for this document.</p>;
    }

    const view = (version: DocumentVersion, signedCopy: boolean) => {
        if (onView) {
            onView(version, signedCopy);
        } else {
            const url = signedCopy
                ? documentFileUrl(documentId, version.is_current ? 'signed' : 'revision-signed', version.signed_file_path, version.is_current ? null : version.revision_id)
                : documentFileUrl(documentId, 'revision', version.file_path, version.revision_id);
            if (url) {
                window.open(url, '_blank', 'noopener');
            }
        }
    };

    return (
        <>
            <ol className="divide-y divide-slate-100">
                {versions.map(version => (
                    <li key={version.revision_id} className="flex gap-3 px-5 py-4">
                        <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${version.is_current ? 'bg-blue-100 text-[#0066cc]' : 'bg-slate-100 text-slate-500'}`}
                            aria-hidden
                        >
                            v{version.version_number}
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-slate-900">
                                Version {version.version_number}
                                {version.is_current && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">Current</span>}
                            </p>
                            <p className="mt-0.5 text-[13px] text-slate-700 break-words">{version.reason}</p>
                            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[12px] text-slate-500">
                                <FileText className="h-3.5 w-3.5" />
                                <span className="max-w-[220px] truncate" title={version.file_name}>{version.file_name}</span>
                                <span>· {formatBytes(version.file_size)}</span>
                            </p>
                            <p className="text-[12px] text-slate-500">{version.created_by} · {formatDateTime(version.created_at)}</p>
                            {version.signed_by.length > 0 && (
                                <p className="mt-1 flex items-center gap-1 text-[12px] text-emerald-700">
                                    <PenLine className="h-3.5 w-3.5" /> Signed by {version.signed_by.join(', ')}
                                </p>
                            )}
                            <div className="mt-2 flex flex-wrap gap-1">
                                <button type="button" onClick={() => view(version, false)} className={linkButton}>
                                    <Eye className="h-3.5 w-3.5" /> View
                                </button>
                                <button type="button" onClick={() => setDownload({ revisionId: version.revision_id, signed: false })} className={linkButton}>
                                    <Download className="h-3.5 w-3.5" /> Download
                                </button>
                                {/* The current version's signed copy is the document's own (shown in the viewer) */}
                                {!version.is_current && version.signed_file_path && (
                                    <button type="button" onClick={() => view(version, true)} className={linkButton}>
                                        <PenLine className="h-3.5 w-3.5" /> Signed Copy
                                    </button>
                                )}
                            </div>
                        </div>
                    </li>
                ))}
            </ol>

            <ExportPasswordModal
                isOpen={download !== null}
                onClose={() => setDownload(null)}
                documentId={documentId}
                revisionId={download?.revisionId ?? null}
                variant={download?.signed ? 'signed' : null}
                identifier={reference}
                onSuccess={(message) => onDownloaded?.(message)}
            />
        </>
    );
}
