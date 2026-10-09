import { usePage } from '@inertiajs/react';

/** Formats the system can display and stamp (old .doc files cannot be previewed in the browser) */
export const ACCEPTED_FILE_TYPES = '.pdf,.docx,.png,.jpg,.jpeg';
const ACCEPTED_NAME = /\.(pdf|docx|png|jpe?g)$/i;

export type UploadLimits = {
    /** Largest single file (PHP upload_max_filesize / post_max_size / app rule) */
    maxBytes: number;
    maxLabel: string;
    /** Largest whole request: files posted together must fit in it */
    maxPostBytes: number;
    /** Files in one upload */
    maxFiles: number;
};

/** The server's upload limits, shared by HandleInertiaRequests (see StoreDocumentRequest) */
export function useUploadLimits(): UploadLimits {
    const upload = (usePage<any>().props.upload ?? {}) as { max_bytes?: number; max_label?: string; max_post_bytes?: number; max_files?: number };

    return {
        maxBytes: upload.max_bytes || 10 * 1024 * 1024,
        maxLabel: upload.max_label || '10 MB',
        maxPostBytes: upload.max_post_bytes || Infinity,
        maxFiles: upload.max_files || 5,
    };
}

export const megabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

const sameFile = (a: File, b: File) => a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;

/**
 * Which of the picked files can join the ones already chosen: viewable types only, each within the per-file
 * limit, at most maxFiles in all and together within the request limit (PHP silently drops anything larger).
 * A file already chosen is skipped; every other refusal is explained in `problems`.
 */
export function acceptFiles(chosen: File[], picked: File[], limits: UploadLimits): { accepted: File[]; problems: string[] } {
    const accepted: File[] = [];
    const problems: string[] = [];
    let total = chosen.reduce((sum, file) => sum + file.size, 0);
    let overCount = 0;

    for (const file of picked) {
        if ([...chosen, ...accepted].some(other => sameFile(other, file))) {
            continue;
        }

        if (!ACCEPTED_NAME.test(file.name)) {
            problems.push(`${file.name}: only PDF, Word (.docx), PNG or JPG files can be uploaded.`);
        } else if (file.size > limits.maxBytes) {
            problems.push(`${file.name} is ${megabytes(file.size)}; each file can be up to ${limits.maxLabel}.`);
        } else if (chosen.length + accepted.length >= limits.maxFiles) {
            overCount++;
        } else if (total + file.size > limits.maxPostBytes) {
            problems.push(`${file.name} was not added: together the files would exceed the ${megabytes(limits.maxPostBytes)} the server accepts in one upload.`);
        } else {
            accepted.push(file);
            total += file.size;
        }
    }

    if (overCount) {
        problems.push(`Up to ${limits.maxFiles} files per upload; ${overCount} file${overCount === 1 ? ' was' : 's were'} not added.`);
    }

    return { accepted, problems };
}
