const fs = require('fs');

const files = [
    'c:\\laragon\\www\\TrackNgo\\resources\\js\\Pages\\department-head\\documents\\ReviewAndActions.tsx',
    'c:\\laragon\\www\\TrackNgo\\resources\\js\\Pages\\mayor\\documents\\Show.tsx'
];

const routingSlipBlock = `                            </div>
                            
                            {/* Initial Routing Slip (Receipt Style) */}
                            <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-6 shadow-sm font-mono relative overflow-hidden">
                                {doc.routing_slips && doc.routing_slips.length > 0 ? (
                                    <div className="flex flex-col gap-6 text-[var(--tng-slate-900)]">
                                        {/* Header */}
                                        <div className="flex justify-between items-start border-b border-[var(--tng-slate-200)] pb-6">
                                            <div>
                                                <h2 className="text-lg font-bold uppercase tracking-tight">Routing Slip</h2>
                                                <p className="text-sm font-semibold mt-2">{doc.department?.department_name ?? 'Origin Department'}</p>
                                                <p className="text-xs text-[var(--tng-slate-600)]">{doc.sender ?? doc.submitter?.name ?? 'Unknown Sender'}</p>
                                            </div>
                                            <div className="flex flex-col items-end text-right">
                                                <img 
                                                    src={\`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=\${doc.tracking_number ?? doc.reference_number}\`}
                                                    alt="QR Code"
                                                    className="w-16 h-16 mb-2 mix-blend-multiply"
                                                />
                                                <p className="text-sm font-bold tracking-tight">Stop #1</p>
                                                <p className="text-sm font-semibold">{doc.tracking_number ?? doc.reference_number}</p>
                                                <p className="text-xs text-[var(--tng-slate-600)]">Submitted on {new Date(doc.routing_slips[0].created_at).toISOString().split('T')[0]}</p>
                                            </div>
                                        </div>

                                        {/* Sender and Receiver */}
                                        <div className="flex justify-between">
                                            <div className="w-1/2 pr-4">
                                                <p className="text-[10px] font-semibold text-[var(--tng-slate-500)] mb-1 uppercase tracking-wider">From:</p>
                                                <p className="text-sm font-bold">{doc.routing_slips[0].sender_name ?? doc.routing_slips[0].from_user?.name ?? 'Unknown'}</p>
                                                <p className="text-xs text-[var(--tng-slate-700)] mt-0.5 leading-tight">{doc.routing_slips[0].from_department?.department_name ?? 'N/A'}</p>
                                            </div>
                                            <div className="w-1/2 pl-4">
                                                <p className="text-[10px] font-semibold text-[var(--tng-slate-500)] mb-1 uppercase tracking-wider">To:</p>
                                                <p className="text-sm font-bold">{doc.routing_slips[0].target_department?.department_name ?? 'N/A'}</p>
                                                <p className="text-xs text-[var(--tng-slate-700)] mt-0.5 leading-tight">{doc.routing_slips[0].to_user?.name ?? 'Department Pool'}</p>
                                            </div>
                                        </div>

                                        {/* Table details */}
                                        <div className="border-t border-b border-[var(--tng-slate-800)] py-3 mt-2">
                                            <table className="w-full text-left text-sm">
                                                <thead>
                                                    <tr className="text-[10px] font-bold uppercase tracking-wider text-[var(--tng-slate-800)] border-b border-[var(--tng-slate-200)]">
                                                        <th className="pb-2">Action</th>
                                                        <th className="pb-2">Status</th>
                                                        <th className="pb-2 text-right">Remarks</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr>
                                                        <td className="pt-3 align-top font-bold uppercase">{doc.routing_slips[0].action ?? 'forward'}</td>
                                                        <td className="pt-3 align-top">
                                                            <span className="uppercase text-xs font-bold text-[var(--tng-slate-700)]">
                                                                {doc.routing_slips[0].status ?? 'Pending'}
                                                            </span>
                                                        </td>
                                                        <td className="pt-3 align-top text-right text-xs text-[var(--tng-slate-700)] break-words max-w-[120px]">
                                                            {doc.routing_slips[0].instruction || 'None'}
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="mb-4 flex items-center justify-between">
                                            <h2 className="text-base font-semibold text-[var(--tng-slate-800)] flex items-center gap-2">
                                                <Send className="h-4 w-4 text-[var(--tng-slate-500)]" />
                                                Initial Routing Slip
                                            </h2>
                                        </div>
                                        <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-dashed border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)] text-[var(--tng-slate-500)] font-sans">
                                            <FileClock className="mb-2 h-6 w-6 text-[var(--tng-slate-400)]" />
                                            <p className="text-sm font-medium">No routing slip generated yet.</p>
                                            <p className="text-xs text-[var(--tng-slate-400)] mt-1">Pending Registration</p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>`;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');

    if (!content.includes('Send,') && content.includes('import { ArrowLeft,')) {
        content = content.replace("import { ArrowLeft,", "import { Send, FileClock, ArrowLeft,");
    }

    if (content.includes('className="grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-3"')) {
        content = content.replace(
            '<div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-6">\\n                            <h2 className="mb-4 text-base font-semibold text-[var(--tng-slate-800)]">\\n                                Document Metadata\\n                            </h2>\\n                            <div className="grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-3">',
            '<div className="grid grid-cols-1 xl:grid-cols-2 gap-6">\\n                            <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-6">\\n                                <h2 className="mb-4 text-base font-semibold text-[var(--tng-slate-800)]">\\n                                    Document Metadata\\n                                </h2>\\n                                <div className="grid grid-cols-2 gap-x-8 gap-y-4">'
        );
        
        const replaceString1 = '                            </div>\\n                        </div>\\n\\n                        {/* Document Preview */}';
        const replaceString2 = '                            </div>\\n                        ' + routingSlipBlock + '\\n\\n                        {/* Document Preview */}';
        
        // Let's use simple string replacement by searching for Document Preview
        const index = content.indexOf('{/* Document Preview */}');
        if (index !== -1) {
             // find the closing divs before it
             const preBlock = content.substring(0, index);
             // We need to inject routingSlipBlock right before '{/* Document Preview */}'
             // Since we know we already changed the open div to a grid, let's just insert before the Document preview
             
             // First we need to close the first grid col, which we actually do inside routingSlipBlock (it starts with </div>)
             
             // Wait, the structure was:
             // <div class="rounded-xl..."> ... metadata grid ... </div>
             // </div>
             // {/* Document Preview */}
             
             // Let's replace:
             //                            </div>
             //                        </div>
             //
             //                        {/* Document Preview */}
             // With routingSlipBlock.
             
             content = content.replace(
                 /\\s*<\\/div>\\s*<\\/div>\\s*\\{\\/\\* Document Preview \\*\\/\\}/,
                 '\\n' + routingSlipBlock + '\\n\\n                        {/* Document Preview */}'
             );
        }
    }
    
    fs.writeFileSync(file, content);
});
