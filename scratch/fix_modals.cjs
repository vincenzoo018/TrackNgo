const fs = require('fs');
const path = require('path');

const files = [
    'C:/laragon/www/TrackNgo/resources/js/components/trackngo/ConfirmActionModal.tsx',
    'C:/laragon/www/TrackNgo/resources/js/components/trackngo/ExportPasswordModal.tsx',
    'C:/laragon/www/TrackNgo/resources/js/components/trackngo/ForwardModal.tsx',
    'C:/laragon/www/TrackNgo/resources/js/components/trackngo/ReturnModal.tsx',
    'C:/laragon/www/TrackNgo/resources/js/components/trackngo/SuccessModal.tsx',
    'C:/laragon/www/TrackNgo/resources/js/pages/department-head/documents/CreateDocumentModal.tsx',
    'C:/laragon/www/TrackNgo/resources/js/pages/mayor/documents/CreateDocumentModal.tsx',
    'C:/laragon/www/TrackNgo/resources/js/pages/receiving/documents/CreateDocumentModal.tsx'
];

for (const file of files) {
    if (!fs.existsSync(file)) {
        console.log(`File not found: ${file}`);
        continue;
    }
    
    let content = fs.readFileSync(file, 'utf8');
    
    // 1. Update overlay class (bg-black/60)
    // Looking for: <div className="absolute inset-0 bg-[var(--tng-slate-900)]/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
    // or similar things.
    content = content.replace(/className="absolute inset-0 (?:bg-\[var\(--tng-slate-900\)\]\/\d+|bg-black\/\d+|bg-white\/\d+) backdrop-blur-sm transition-opacity"/g, 'className="absolute inset-0 z-0 bg-black/60 backdrop-blur-sm transition-opacity"');
    content = content.replace(/className="absolute inset-0 (?:bg-\[var\(--tng-slate-900\)\]\/\d+|bg-black\/\d+|bg-white\/\d+) backdrop-blur-sm"/g, 'className="absolute inset-0 z-0 bg-black/60 backdrop-blur-sm transition-opacity"');

    // Make sure overlay has z-0 if it doesn't have it yet. (If it didn't match above)
    // Some might have 'className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"'
    content = content.replace(/className="absolute inset-0 bg-black\/40 backdrop-blur-sm transition-opacity"/g, 'className="absolute inset-0 z-0 bg-black/60 backdrop-blur-sm transition-opacity"');

    // 2. Add z-10 to the modal content container
    // Looking for: <div className="relative w-full max-w-... rounded-2xl bg-white shadow-2xl...
    content = content.replace(/className="relative w-full /g, 'className="relative z-10 w-full ');
    
    // If it already has z-10, this might double it up, let's fix
    content = content.replace(/z-10 z-10/g, 'z-10');

    // 3. Disable scrolling
    // We need to inject useEffect if it doesn't exist, and the logic.
    // Let's see if the file imports useEffect
    if (!content.includes('useEffect')) {
        content = content.replace(/import React, { useState } from 'react';/, "import React, { useState, useEffect } from 'react';");
        content = content.replace(/import { useState } from 'react';/, "import { useState, useEffect } from 'react';");
    }

    // Determine the prop name for open state (isOpen or open)
    const openProp = content.includes('isOpen: boolean') || content.includes('isOpen}:') || content.includes('isOpen,') ? 'isOpen' : 'open';

    // Check if body overflow logic already exists
    if (!content.includes('document.body.style.overflow')) {
        // Inject right after the component declaration or first useState
        // A safe place is before `if (!isOpen) return null;`
        const injection = `
    useEffect(() => {
        if (${openProp}) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [${openProp}]);
`;
        // Find the `if (!isOpen) return null;` or `if (!open) return null;`
        if (content.includes(`if (!${openProp}) return null;`)) {
            content = content.replace(`if (!${openProp}) return null;`, injection + `\n    if (!${openProp}) return null;`);
        } else if (content.includes(`if (!${openProp} || !mounted) return null;`)) {
            content = content.replace(`if (!${openProp} || !mounted) return null;`, injection + `\n    if (!${openProp} || !mounted) return null;`);
        }
    }
    
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
}
