const fs = require('fs');
const path = require('path');

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

    // 1. Add BaseModal import
    if (!content.includes("import { BaseModal }")) {
        content = content.replace("import * as pdfjsLib from 'pdfjs-dist';", "import * as pdfjsLib from 'pdfjs-dist';\nimport { BaseModal } from '@/components/trackngo/BaseModal';");
    }

    // 2. Remove useEffect for overflow, if it exists
    content = content.replace(/useEffect\(\(\) => \{\s*if \(isOpen\) \{\s*document\.body\.style\.overflow = 'hidden';\s*\} else \{\s*document\.body\.style\.overflow = 'unset';\s*\}\s*return \(\) => \{\s*document\.body\.style\.overflow = 'unset';\s*\};\s*\}, \[isOpen\]\);\s*/, '');

    // 3. Replace the entire return wrapper
    // Since this is a complex file, we will use regex to find the start of the return statement and replace up to the form
    const returnRegex = /return \(\s*<div className="fixed inset-0 z-\[100\].*?\{step === 'form' \? \(/s;
    
    if (returnRegex.test(content)) {
        const newWrapper = `return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            title={step === 'form' ? "Submit New Document" : undefined}
            description={step === 'form' ? "Upload document and generate routing slip" : undefined}
            icon={step === 'form' ? <Plus className="h-5 w-5" /> : undefined}
            maxWidth="max-w-3xl"
            childrenContainerClassName={step === 'form' ? "p-0" : ""}
            formProps={step === 'form' ? { onSubmit: handleSubmit } : undefined}
            footer={step === 'form' ? (
                <>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full sm:w-auto rounded-lg px-4 py-2 text-sm font-medium text-[var(--tng-slate-600)] transition-colors hover:bg-[var(--tng-slate-200)] text-center"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={processing || !ocrComplete}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-lg bg-[var(--tng-blue-600)] px-5 py-2 text-sm font-medium text-white shadow-md shadow-blue-600/25 transition-all hover:bg-[var(--tng-blue-700)] hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {processing ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Submitting...
                            </>
                        ) : (
                            'Generate & Submit'
                        )}
                    </button>
                </>
            ) : undefined}
        >
            {step === 'form' ? (
                <div className="flex flex-col h-full">
`;
        content = content.replace(returnRegex, newWrapper);
    }

    // 4. We also need to remove the form footer from the original code since we moved it to the BaseModal footer.
    const formFooterRegex = /\{?\/\* Footer \*\/\s*<div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 border-t border-\[var\(--tng-slate-100\)\] bg-\[var\(--tng-slate-50\)\] px-4 sm:px-6 py-4 rounded-b-2xl flex-shrink-0">.*?<\/div>\s*<\/form>/s;
    if (formFooterRegex.test(content)) {
        content = content.replace(formFooterRegex, '</div>');
    } else {
        // Fallback: Just replace the end form tag if the footer isn't exactly matched
        content = content.replace(/<\/form>/, '</div>');
    }

    // 5. Replace the closing divs of the original wrapper
    content = content.replace(/<\/div>\s*<\/div>\s*\);\s*\}\s*$/s, '</BaseModal>\n    );\n}\n');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
});
