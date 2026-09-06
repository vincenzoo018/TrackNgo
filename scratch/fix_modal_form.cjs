const fs = require('fs');

const files = [
    'c:/laragon/www/TrackNgo/resources/js/pages/department-head/documents/CreateDocumentModal.tsx',
    'c:/laragon/www/TrackNgo/resources/js/pages/mayor/documents/CreateDocumentModal.tsx',
    'c:/laragon/www/TrackNgo/resources/js/pages/receiving/documents/CreateDocumentModal.tsx'
];

files.forEach(filePath => {
    if (!fs.existsSync(filePath)) {
        console.log(`File not found: ${filePath}`);
        return;
    }

    let content = fs.readFileSync(filePath, 'utf8');

    // Replace the stray form tag and combine its classes with the wrapper div
    const formRegex = /<div className="flex flex-col h-full">\s*<form onSubmit=\{handleSubmit\} className="flex-1 overflow-y-auto">/g;
    
    content = content.replace(formRegex, `<div className="flex flex-col h-full flex-1 overflow-y-auto">`);

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
});
