const fs = require('fs');

const files = [
    'c:/laragon/www/TrackNgo/resources/js/pages/receiving/documents/Show.tsx',
    'c:/laragon/www/TrackNgo/resources/js/pages/mayor/documents/Show.tsx'
];

files.forEach(filePath => {
    if (!fs.existsSync(filePath)) {
        console.log(`File not found: ${filePath}`);
        return;
    }

    let content = fs.readFileSync(filePath, 'utf8');

    // Add import for CollapsiblePanel
    if (!content.includes("import { CollapsiblePanel }")) {
        content = content.replace("import { StepProgress } from '@/components/trackngo/StepProgress';", "import { StepProgress } from '@/components/trackngo/StepProgress';\nimport { CollapsiblePanel } from '@/components/trackngo/CollapsiblePanel';");
    }

    // Replace Document Metadata panel
    const metaPanelRegex = /<div className="rounded-xl border border-\[var\(--tng-slate-200\)\] bg-white p-6">\s*<h2 className="mb-4 text-base font-semibold text-\[var\(--tng-slate-800\)\]">\s*Document Metadata\s*<\/h2>\s*<div className="grid grid-cols-2 gap-x-8 gap-y-4">([\s\S]*?)<\/div>\s*<\/div>/g;
    
    content = content.replace(metaPanelRegex, (match, inner) => {
        return `<CollapsiblePanel title="Document Metadata">
                                    <div className="grid grid-cols-2 gap-x-8 gap-y-4">${inner}</div>
                                </CollapsiblePanel>`;
    });
    
    // Check if Initial Routing slip can also be collapsed, usually it looks like this:
    /*
    <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-6 shadow-sm font-mono relative overflow-hidden">
        {doc.routing_slips && doc.routing_slips.length > 0 ? (
    */
    const routingRegex = /<div className="rounded-xl border border-\[var\(--tng-slate-200\)\] bg-white p-6 shadow-sm font-mono relative overflow-hidden">([\s\S]*?)(?=<\!-- Document Preview -->|<div className="rounded-xl border border-\[var\(--tng-slate-200\)\] bg-white p-6 flex flex-col min-h-\[800px\]">)/g;
    
    content = content.replace(routingRegex, (match, inner) => {
        // we need to be careful with regex replacement of the routing slip since it might have a trailing closing div.
        // It's safer to only do Metadata if the routing slip regex isn't precise.
        return match; 
    });


    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
});
