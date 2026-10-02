/**
 * Final signed copy. Each signatory's HR-registered signature is stamped automatically at the bottom of the
 * last page, side by side in signing order, with their name, position and date underneath. The same layout
 * (signatureBlocks) is drawn over the page in the viewer, so what people see is what the final PDF carries.
 * PDFs are stamped in place, photos become a one-page PDF stamped in place, and Word files (which the browser
 * cannot stamp) get a separate signature page. The result is uploaded and attached to the document.
 */
import { degrees, PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { PDFFont, PDFImage, PDFPage } from 'pdf-lib';
import { csrfHeaders } from '@/lib/csrf';
import * as pdfjsLib from '@/lib/pdfjs';

export type StampableKind = 'pdf' | 'image' | 'other';

/** Area of one signature block, as fractions (0..1) of the page, origin top-left */
export type SignatureSlot = { x: number; y: number; w: number; h: number };

export type SignatureBlock = {
    key: string;
    slot: SignatureSlot;
    signed: boolean;
    image: string | null;
    name: string;
    position: string;
    date: string;
    hash: string | null;
};

const A4 = { width: 595.28, height: 841.89 };

// Signature band at the bottom of the last page
const PER_ROW = 3;
const ROW_HEIGHT = 0.105;
const BAND_BOTTOM = 0.965;
const MARGIN_X = 0.07;
const GAP = 0.03;

// Inside a block (fractions of its height): image on top, signature line, then name / position / date
export const BLOCK_LAYOUT = {
    imageBottom: 0.52,
    line: 0.55,
    name: 0.69,
    position: 0.82,
    date: 0.95,
};
// Text sizes relative to the page width (about 7.5 pt / 6.5 pt on A4)
export const TEXT_SCALE = { name: 7.5 / A4.width, small: 6.5 / A4.width };

export function stampableKind(path?: string | null): StampableKind {
    const ext =
        (path || '').split(/[?#]/)[0].split('.').pop()?.toLowerCase() || '';

    if (ext === 'pdf') {
        return 'pdf';
    }

    if (['png', 'jpg', 'jpeg'].includes(ext)) {
        return 'image';
    }

    return 'other';
}

export function signatureSlots(count: number): SignatureSlot[] {
    const perRow = Math.min(Math.max(count, 1), PER_ROW);
    const rows = Math.ceil(count / perRow);
    const width = (1 - 2 * MARGIN_X - GAP * (perRow - 1)) / perRow;

    return Array.from({ length: count }, (_, i) => {
        const row = Math.floor(i / perRow);
        const inRow = Math.min(perRow, count - row * perRow);
        // A shorter last row is centred
        const offset = ((perRow - inRow) * (width + GAP)) / 2;

        return {
            x: MARGIN_X + offset + (i % perRow) * (width + GAP),
            y: BAND_BOTTOM - (rows - row) * ROW_HEIGHT,
            w: width,
            h: ROW_HEIGHT,
        };
    });
}

function formatSignedAt(value?: string | null): string {
    if (!value) {
        return '';
    }

    const d = new Date(value);

    return isNaN(d.getTime())
        ? ''
        : d.toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
          });
}

/** One block per signatory in signing order; unsigned ones keep their place until stamped. */
export function signatureBlocks(signatories: any[] = []): SignatureBlock[] {
    const slots = signatureSlots(signatories.length);

    return signatories.map((s, i) => ({
        key: `sig-${s.signatory_id ?? i}`,
        slot: slots[i],
        signed: Boolean(s.signed_at),
        image: s.signature?.signature_image ?? null,
        name: s.user?.name || 'Signatory',
        position: [s.user?.role?.role_name, s.user?.department?.department_name]
            .filter(Boolean)
            .join(', '),
        date: formatSignedAt(s.signed_at),
        hash: s.signature?.signature_hash ?? null,
    }));
}

async function fetchBytes(url: string): Promise<ArrayBuffer> {
    const res = await fetch(url, { credentials: 'same-origin' });

    if (!res.ok) {
        throw new Error(
            res.status === 404
                ? 'The original file is missing from storage.'
                : `The original file could not be downloaded (HTTP ${res.status}).`,
        );
    }

    return res.arrayBuffer();
}

function embedImage(pdf: PDFDocument, dataUrl: string): Promise<PDFImage> {
    return /^data:image\/png/i.test(dataUrl)
        ? pdf.embedPng(dataUrl)
        : pdf.embedJpg(dataUrl);
}

/** Standard PDF fonts only cover Latin-1; anything else is replaced so text drawing never throws. */
function safeText(font: PDFFont, text: string): string {
    try {
        font.encodeText(text);

        return text;
    } catch {
        return text.replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
    }
}

function fitText(
    font: PDFFont,
    text: string,
    size: number,
    maxWidth: number,
): string {
    let value = safeText(font, text);

    while (value.length > 2 && font.widthOfTextAtSize(value, size) > maxWidth) {
        value = value.slice(0, -2) + '…';
    }

    return value;
}

type Fonts = { regular: PDFFont; bold: PDFFont };
type TextLine = {
    value: string;
    font: PDFFont;
    size: number;
    color: ReturnType<typeof rgb>;
    at: number;
};

/**
 * Draw the signed blocks on a page. Positions are in displayed-page points (origin top-left); toPdf maps them
 * to PDF user space and `angle` is the page rotation, so stamps read upright on rotated pages too.
 */
async function drawBlocks(
    pdf: PDFDocument,
    page: PDFPage,
    blocks: SignatureBlock[],
    size: { width: number; height: number },
    toPdf: (x: number, y: number) => [number, number],
    angle: number,
    fonts: Fonts,
) {
    const ink = rgb(0.1, 0.12, 0.16);
    const muted = rgb(0.38, 0.41, 0.46);

    for (const block of blocks.filter((b) => b.signed && b.image)) {
        const bx = block.slot.x * size.width;
        const by = block.slot.y * size.height;
        const bw = block.slot.w * size.width;
        const bh = block.slot.h * size.height;

        // Signature image, kept in proportion and centred above the line
        const image = await embedImage(pdf, block.image!);
        const boxH = BLOCK_LAYOUT.imageBottom * bh;
        const scale = Math.min(bw / image.width, boxH / image.height);
        const iw = image.width * scale;
        const ih = image.height * scale;
        const [ix, iy] = toPdf(bx + (bw - iw) / 2, by + boxH);
        page.drawImage(image, {
            x: ix,
            y: iy,
            width: iw,
            height: ih,
            rotate: degrees(angle),
        });

        const lineY = by + BLOCK_LAYOUT.line * bh;
        const [lx1, ly1] = toPdf(bx + bw * 0.08, lineY);
        const [lx2, ly2] = toPdf(bx + bw * 0.92, lineY);
        page.drawLine({
            start: { x: lx1, y: ly1 },
            end: { x: lx2, y: ly2 },
            thickness: 0.6,
            color: muted,
        });

        const lines: TextLine[] = [
            {
                value: block.name,
                font: fonts.bold,
                size: TEXT_SCALE.name * size.width,
                color: ink,
                at: BLOCK_LAYOUT.name,
            },
            {
                value: block.position,
                font: fonts.regular,
                size: TEXT_SCALE.small * size.width,
                color: muted,
                at: BLOCK_LAYOUT.position,
            },
            {
                value: block.date,
                font: fonts.regular,
                size: TEXT_SCALE.small * size.width,
                color: muted,
                at: BLOCK_LAYOUT.date,
            },
        ];

        for (const line of lines.filter((l) => l.value)) {
            const text = fitText(line.font, line.value, line.size, bw);
            const [tx, ty] = toPdf(
                bx + (bw - line.font.widthOfTextAtSize(text, line.size)) / 2,
                by + line.at * bh,
            );
            page.drawText(text, {
                x: tx,
                y: ty,
                size: line.size,
                font: line.font,
                color: line.color,
                rotate: degrees(angle),
            });
        }
    }
}

async function embedFonts(pdf: PDFDocument): Promise<Fonts> {
    return {
        regular: await pdf.embedFont(StandardFonts.Helvetica),
        bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    };
}

async function stampPdf(
    bytes: ArrayBuffer,
    blocks: SignatureBlock[],
): Promise<Uint8Array> {
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    // PDF.js maps displayed positions to PDF points, accounting for page rotation and crop-box offsets
    const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(bytes.slice(0)),
    });
    const viewer = await loadingTask.promise;

    try {
        const lastIndex = pdf.getPageCount() - 1;
        const page = pdf.getPage(lastIndex);
        const viewport = (await viewer.getPage(lastIndex + 1)).getViewport({
            scale: 1,
        });
        const toPdf = (x: number, y: number) =>
            viewport.convertToPdfPoint(x, y) as [number, number];
        await drawBlocks(
            pdf,
            page,
            blocks,
            viewport,
            toPdf,
            page.getRotation().angle,
            await embedFonts(pdf),
        );
    } finally {
        loadingTask.destroy();
    }

    return pdf.save();
}

async function stampImage(
    bytes: ArrayBuffer,
    blocks: SignatureBlock[],
): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    // The file signature, not the extension, decides the format (a .jpg can be a renamed PNG)
    const head = new Uint8Array(bytes.slice(0, 2));
    const base =
        head[0] === 0x89 && head[1] === 0x50
            ? await pdf.embedPng(bytes)
            : await pdf.embedJpg(bytes);
    const size = {
        width: A4.width,
        height: (A4.width * base.height) / base.width,
    };
    const page = pdf.addPage([size.width, size.height]);
    page.drawImage(base, {
        x: 0,
        y: 0,
        width: size.width,
        height: size.height,
    });
    await drawBlocks(
        pdf,
        page,
        blocks,
        size,
        (x, y) => [x, size.height - y],
        0,
        await embedFonts(pdf),
    );

    return pdf.save();
}

/** Word files cannot be stamped in the browser: the signatures go on a page of their own. */
async function signaturePage(
    blocks: SignatureBlock[],
    meta: {
        reference: string;
        tracking?: string | null;
        title: string;
        fileName?: string;
    },
): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    const fonts = await embedFonts(pdf);
    const page = pdf.addPage([A4.width, A4.height]);
    const margin = 56;
    const muted = rgb(0.38, 0.41, 0.46);
    let y = margin + 16;
    const text = (
        value: string,
        size: number,
        font: PDFFont,
        color = rgb(0.1, 0.12, 0.16),
    ) => {
        page.drawText(fitText(font, value, size, A4.width - margin * 2), {
            x: margin,
            y: A4.height - y,
            size,
            font,
            color,
        });
        y += size + 8;
    };

    text('SIGNATURE PAGE', 16, fonts.bold);
    text(
        `Reference No.: ${meta.reference}${meta.tracking ? `   Tracking No.: ${meta.tracking}` : ''}`,
        10,
        fonts.regular,
        muted,
    );
    text(meta.title, 12, fonts.bold);
    text(
        `This page forms part of the document above${meta.fileName ? ` (${meta.fileName})` : ''} and carries the signatures of its signatories.`,
        9,
        fonts.regular,
        muted,
    );

    // Same blocks as on a stamped page, moved up below the heading
    const placed = blocks.map((b) => ({
        ...b,
        slot: { ...b.slot, y: b.slot.y - BAND_BOTTOM + 0.45 },
    }));
    await drawBlocks(
        pdf,
        page,
        placed,
        A4,
        (x, yy) => [x, A4.height - yy],
        0,
        fonts,
    );

    return pdf.save();
}

export async function buildSignedPdf(
    fileUrl: string | null,
    blocks: SignatureBlock[],
    meta: {
        reference: string;
        tracking?: string | null;
        title: string;
        fileName?: string;
    },
): Promise<Uint8Array> {
    const kind = stampableKind(fileUrl);

    if (fileUrl && kind === 'pdf') {
        return stampPdf(await fetchBytes(fileUrl), blocks);
    }

    if (fileUrl && kind === 'image') {
        return stampImage(await fetchBytes(fileUrl), blocks);
    }

    return signaturePage(blocks, meta);
}

export async function uploadSignedCopy(
    documentId: number | string,
    bytes: Uint8Array,
    reference: string,
): Promise<void> {
    const form = new FormData();
    form.append(
        'file',
        new Blob([bytes as BlobPart], { type: 'application/pdf' }),
        `Signed_${reference}.pdf`,
    );

    const res = await fetch(`/documents/${documentId}/signed-copy`, {
        method: 'POST',
        headers: { ...csrfHeaders(), Accept: 'application/json' },
        credentials: 'same-origin',
        body: form,
    });

    if (!res.ok) {
        const data = await res.json().catch(() => null);
        const firstError = data?.errors
            ? Object.values(data.errors).flat()[0]
            : null;

        throw new Error(
            (firstError as string) ||
                data?.message ||
                `The signed copy could not be saved (HTTP ${res.status}).`,
        );
    }
}

/** Build the final copy from the document's signatories and attach it to the document. */
export async function generateSignedCopy(doc: any): Promise<void> {
    const fileUrl = doc.attachment_path
        ? `/storage/${doc.attachment_path}`
        : null;
    const bytes = await buildSignedPdf(
        fileUrl,
        signatureBlocks(doc.signatories),
        {
            reference: doc.reference_number,
            tracking: doc.tracking_number,
            title: doc.title || doc.reference_number,
            fileName: doc.attachment_path
                ? doc.attachment_path.split('/').pop()
                : undefined,
        },
    );
    await uploadSignedCopy(doc.document_id, bytes, doc.reference_number);
}
