const fs = require('fs');

const files = [
    'c:\\laragon\\www\\TrackNgo\\resources\\js\\Pages\\department-head\\documents\\ReviewAndActions.tsx',
    'c:\\laragon\\www\\TrackNgo\\resources\\js\\Pages\\mayor\\documents\\Show.tsx'
];

const importSignature = "import DraggableSignature from '@/components/DraggableSignature';\n";

const signatureBlock = `
                        {/* Signatures Section */}
                        <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-6 flex flex-col gap-12">
                            {/* Sender */}
                            <div className="text-center relative w-full flex flex-col items-center">
                                <DraggableSignature imagePath={doc.submitter?.signature} name={doc.sender ?? doc.submitter?.name ?? 'Unknown'} />
                                <div className="h-16"></div> {/* Space for signature */}
                                <div className="font-bold text-slate-800 underline underline-offset-4 decoration-slate-400 pb-1 mb-1">{doc.sender ?? doc.submitter?.name ?? 'Unknown'}</div>
                                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mt-2">Prepared By</div>
                            </div>

                            {/* Authenticated User */}
                            <div className="text-center relative w-full flex flex-col items-center">
                                <DraggableSignature imagePath={auth?.user?.signature} name={auth?.user?.name} />
                                <div className="h-16"></div> {/* Space for signature */}
                                <div className="font-bold text-slate-800 underline underline-offset-4 decoration-slate-400 pb-1 mb-1">{auth?.user?.name ?? 'System Admin (You)'}</div>
                                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mt-2">Approved By</div>
                            </div>
                        </div>
`;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');

    // Add import if not present
    if (!content.includes('import DraggableSignature')) {
        content = content.replace("import TrackngoLayout from", importSignature + "import TrackngoLayout from");
    }

    // Locate the end of the Audit Trail div
    // We look for the form tag end and the subsequent closing divs
    if (!content.includes('{/* Signatures Section */}')) {
        content = content.replace(
            '                                        </form>\n                                    </div>\n                                )}\n                            </div>\n                        </div>',
            '                                        </form>\n                                    </div>\n                                )}\n                            </div>\n                        </div>' + signatureBlock
        );
    }
    
    fs.writeFileSync(file, content);
});
