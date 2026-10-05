import { ArrowDownToLine, CheckCircle2, Clock, FileSignature, Loader2 } from 'lucide-react';

export type SignatureSummary = {
    required: boolean;
    total: number;
    signed: number;
    allSigned: boolean;
    pending: any[];
};

/** Who still has to sign; a document without signatories needs none. */
export function summarizeSignatures(doc: any): SignatureSummary {
    const signatories: any[] = doc?.signatories || [];
    const required = Boolean(doc?.requires_signature) && signatories.length > 0;
    const pending = signatories.filter((s) => !s.signed_at);

    return {
        required,
        total: signatories.length,
        signed: signatories.length - pending.length,
        allSigned: required && pending.length === 0,
        pending,
    };
}

function formatSigned(value?: string | null): string {
    if (!value) {
        return '';
    }

    const d = new Date(value);

    return isNaN(d.getTime())
        ? ''
        : d.toLocaleString('en-US', {
              month: 'short',
              day: '2-digit',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
          });
}

type SignatoriesPanelProps = {
    doc: any;
    canGenerate: boolean;
    generating: boolean;
    generateError: string | null;
    onGenerate: () => void;
    onViewSignedCopy: () => void;
};

/**
 * Required signatories in signing order: each one's HR-registered signature is stamped automatically when
 * they forward / approve the document, and shown here once stamped. Ends with the final signed copy.
 */
export function SignatoriesPanel({
    doc,
    canGenerate,
    generating,
    generateError,
    onViewSignedCopy,
    onGenerate,
}: SignatoriesPanelProps) {
    const summary = summarizeSignatures(doc);

    if (!summary.required) {
        return (
            <p className="px-5 py-4 text-[13px] text-slate-500">
                No signatures are required for this document.
            </p>
        );
    }

    const holderId = String(doc.current_holder_id ?? '');
    // The stamped copy is rebuilt after every signature; it is up to date when it carries all given so far
    const copyCount = Number(doc.signed_copy_signatures || 0);
    const copyUpToDate = Boolean(doc.signed_file_path) && copyCount >= summary.signed;
    const whereStamped = /\.docx$/i.test(String(doc.attachment_path || ''))
        ? 'The signatures are in a "Signatures" table at the end of the Word document.'
        : 'The signatures are stamped at the bottom of the last page.';

    return (
        <div className="space-y-4 p-5">
            <ol className="space-y-3">
                {doc.signatories.map((s: any, index: number) => {
                    const signed = Boolean(s.signed_at);
                    const image = s.signature?.signature_image;
                    const withThemNow =
                        !signed && holderId && String(s.user_id) === holderId;

                    return (
                        <li
                            key={s.signatory_id ?? index}
                            className="flex items-start gap-3"
                        >
                            <span
                                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${signed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
                            >
                                {signed ? (
                                    <CheckCircle2 className="h-4 w-4" />
                                ) : (
                                    index + 1
                                )}
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="text-[14px] font-medium text-slate-900">
                                    {s.user?.name || 'Signatory'}
                                </p>
                                <p className="text-[12px] text-slate-500">
                                    {[
                                        s.user?.role?.role_name,
                                        s.user?.department?.department_name,
                                    ]
                                        .filter(Boolean)
                                        .join(' · ')}
                                </p>
                                {signed ? (
                                    <p className="mt-0.5 text-[12px] font-medium text-emerald-700">
                                        Signature stamped{' '}
                                        {formatSigned(s.signed_at)}
                                    </p>
                                ) : (
                                    <p className="mt-0.5 flex items-center gap-1 text-[12px] font-medium text-amber-700">
                                        <Clock className="h-3 w-3" />
                                        {withThemNow
                                            ? 'Will be stamped when they forward or approve it (with them now)'
                                            : 'Will be stamped when they approve it'}
                                    </p>
                                )}
                            </div>
                            {signed && image && (
                                <img
                                    src={image}
                                    alt={`Signature of ${s.user?.name ?? 'signatory'}`}
                                    className="h-12 w-28 shrink-0 rounded border border-emerald-100 bg-white object-contain p-1 mix-blend-multiply"
                                />
                            )}
                        </li>
                    );
                })}
            </ol>

            {summary.signed > 0 && (
                copyUpToDate ? (
                    <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-3">
                        <p className="flex items-center gap-2 text-[13px] font-medium text-emerald-800">
                            <FileSignature className="h-4 w-4 shrink-0" />
                            {summary.allSigned
                                ? 'Final signed copy attached'
                                : `Signed copy attached (${copyCount} of ${summary.total} signatures)`}
                        </p>
                        <p className="text-[12px] text-emerald-800/80">{whereStamped}</p>
                        <button
                            type="button"
                            onClick={onViewSignedCopy}
                            className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-[13px] font-medium text-emerald-800 hover:bg-emerald-100"
                        >
                            <ArrowDownToLine className="h-4 w-4" /> Go to signatures
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-[13px] text-amber-900">
                        <p className="font-medium">
                            {summary.signed} of {summary.total} signatures given.
                        </p>
                        {canGenerate ? (
                            <>
                                <p>
                                    {generating
                                        ? 'Stamping the signatures on the document…'
                                        : 'The signed copy could not be updated automatically.'}
                                </p>
                                <button
                                    type="button"
                                    onClick={onGenerate}
                                    disabled={generating}
                                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 py-2 font-medium text-white hover:bg-amber-700 disabled:opacity-60"
                                >
                                    {generating ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <FileSignature className="h-4 w-4" />
                                    )}
                                    {generating
                                        ? 'Stamping signatures…'
                                        : 'Stamp Signatures Now'}
                                </button>
                            </>
                        ) : (
                            <p>
                                The signatures are stamped on the document as
                                soon as the sender or someone on its route opens
                                it.
                            </p>
                        )}
                        {generateError && (
                            <p className="font-medium text-red-700">
                                {generateError}
                            </p>
                        )}
                    </div>
                )
            )}
            {!summary.allSigned && (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[12px] text-slate-600">
                    {summary.signed} of {summary.total} stamped. The document
                    cannot be completed until every signatory has approved it
                    {summary.pending[0]?.user?.name
                        ? ` — next: ${summary.pending[0].user.name}`
                        : ''}
                    .
                </p>
            )}
        </div>
    );
}
