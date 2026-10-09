import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import { useState } from 'react';

type Notice = {
    notice_number: string;
    issued_at: string;
    reason: string;
    previous_due_date: string;
    new_due_date: string;
    extended_days: number;
    working_days: boolean;
    notified_client: boolean;
    extended_by: { name: string | null; position: string | null; office: string | null };
    client: { name: string; address: string | null; contact: string | null } | null;
    document: { reference_number: string; tracking_number: string | null; title: string; type: string | null; office: string | null; date_filed: string | null };
};

type Props = { notice: Notice; document: { document_id: number; reference_number: string } };

function longDate(value?: string | null): string {
    if (!value) return '';
    const date = value.length <= 10 ? new Date(`${value}T12:00:00+08:00`) : new Date(value);

    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' });
}

/**
 * Written notice of the one extension of the processing period (RA 11032 Sec. 9(b)): printed or saved as PDF and
 * given to the client, who is also texted the new release date.
 */
export default function ExtensionNotice({ notice, document: doc }: Props) {
    const [downloading, setDownloading] = useState(false);
    const number = notice.document.tracking_number || notice.document.reference_number;

    const downloadPdf = async () => {
        const element = window.document.getElementById('extension-notice');
        if (!element) return;
        setDownloading(true);
        try {
            const module = await import('html2pdf.js');
            const html2pdf = (module as any).default || module;
            await html2pdf().set({
                margin: [15, 15, 15, 15],
                filename: `Notice_of_Extension_${number}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, logging: false },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            }).from(element).save();
        } catch {
            window.print();
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
            <Head title={`Notice of Extension — ${number}`} />
            <style>{'@media print { .no-print { display: none !important; } @page { size: A4; margin: 15mm; } }'}</style>

            <div className="no-print mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-2 px-4">
                <Link href={`/documents/${doc.document_id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                    <ArrowLeft className="h-4 w-4" /> Back to Document
                </Link>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                        <Printer className="h-4 w-4" /> Print
                    </button>
                    <button type="button" onClick={downloadPdf} disabled={downloading} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0066cc] px-3 py-2 text-sm font-medium text-white hover:bg-[#005bb5] disabled:opacity-60">
                        <Download className="h-4 w-4" /> {downloading ? 'Preparing…' : 'Download PDF'}
                    </button>
                </div>
            </div>

            <article id="extension-notice" className="mx-auto max-w-[210mm] bg-white px-[18mm] py-[16mm] text-[13.5px] leading-relaxed text-slate-900 shadow-sm print:shadow-none" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                <header className="flex items-center gap-4 border-b-2 border-slate-800 pb-4">
                    <div className="flex-1 text-center">
                        <p className="text-[12px] tracking-wide">Republic of the Philippines</p>
                        <p className="text-[12px] tracking-wide">Province of Davao Oriental</p>
                        <p className="text-[16px] font-bold tracking-wide">CITY GOVERNMENT OF MATI</p>
                        {notice.extended_by.office && <p className="text-[13px]">{notice.extended_by.office}</p>}
                    </div>
                </header>

                <div className="mt-6 flex items-start justify-between gap-4 text-[12.5px]">
                    <p>Notice No. {notice.notice_number}</p>
                    <p>{longDate(notice.issued_at)}</p>
                </div>

                <h1 className="mt-6 text-center text-[15px] font-bold tracking-wide uppercase">Notice of Extension of Processing Time</h1>

                <div className="mt-6 space-y-0.5">
                    <p className="font-semibold">{notice.client?.name ?? 'The Applicant'}</p>
                    {notice.client?.address && <p>{notice.client.address}</p>}
                    {notice.client?.contact && <p>{notice.client.contact}</p>}
                </div>

                <table className="mt-5 w-full border-collapse text-[12.5px]">
                    <tbody>
                        <tr><td className="w-44 py-0.5 align-top font-semibold">Tracking No.</td><td className="py-0.5">{number}</td></tr>
                        <tr><td className="py-0.5 align-top font-semibold">Request</td><td className="py-0.5">{notice.document.title}{notice.document.type ? ` (${notice.document.type})` : ''}</td></tr>
                        <tr><td className="py-0.5 align-top font-semibold">Date filed</td><td className="py-0.5">{longDate(notice.document.date_filed)}</td></tr>
                        <tr><td className="py-0.5 align-top font-semibold">Original release date</td><td className="py-0.5">{longDate(notice.previous_due_date)}</td></tr>
                        <tr><td className="py-0.5 align-top font-semibold">New release date</td><td className="py-0.5 font-semibold">{longDate(notice.new_due_date)}</td></tr>
                    </tbody>
                </table>

                <div className="mt-6 space-y-4 text-justify">
                    <p>Dear {notice.client?.name ?? 'Applicant'}:</p>
                    <p>
                        Pursuant to Section 9(b) of Republic Act No. 11032, the Ease of Doing Business and Efficient Government Service Delivery Act of 2018,
                        we respectfully inform you that the processing of your request is extended by <strong>{notice.extended_days} {notice.working_days ? 'working ' : ''}day{notice.extended_days === 1 ? '' : 's'}</strong>,
                        for the following reason:
                    </p>
                    <blockquote className="border-l-4 border-slate-300 pl-4 italic">{notice.reason}</blockquote>
                    <p>
                        Your document is expected to be released on or before <strong>{longDate(notice.new_due_date)}</strong>. Under the law this extension is
                        given only once. You may follow its progress with the tracking number above on the TrackNGo public tracking page or by scanning the QR code on your routing slip.
                    </p>
                    <p>We apologize for the inconvenience and thank you for your patience.</p>
                </div>

                <div className="mt-14 w-72">
                    <p className="border-b border-slate-800 pb-1 text-center font-semibold uppercase">{notice.extended_by.name ?? 'Authorized Official'}</p>
                    <p className="mt-1 text-center text-[12.5px]">{[notice.extended_by.position, notice.extended_by.office].filter(Boolean).join(', ')}</p>
                </div>

                <footer className="mt-12 border-t border-slate-300 pt-3 text-[11px] text-slate-500">
                    Generated by TrackNGo Mati · Ref. {notice.document.reference_number}
                    {notice.notified_client ? ' · The applicant was also notified by SMS.' : ''}
                </footer>
            </article>
        </div>
    );
}
