/**
 * Signed copy of a Word document: the signatures are added to the .docx itself, as a "Signatures" table at the
 * end of the document (signature image above a line, then name, position and date), so the stamped file is
 * still the Word document and opens in Word and in the TrackNGo viewer.
 */
import JSZip from 'jszip';
import type { SignatureBlock } from '@/lib/signed-pdf';

const PER_ROW = 3;
// Signature image box, in EMU (914400 per inch)
const IMAGE_MAX_W = 1.6 * 914400;
const IMAGE_MAX_H = 0.6 * 914400;
const REL_IMAGE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';

const NS = {
    wp: 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
    a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
    pic: 'http://schemas.openxmlformats.org/drawingml/2006/picture',
    r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
};

const escapeXml = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; ext: 'png' | 'jpeg' } {
    const [header, base64 = ''] = dataUrl.split(',');
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return { bytes, ext: /image\/jpe?g/i.test(header) ? 'jpeg' : 'png' };
}

function imageSize(dataUrl: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth || 400, height: img.naturalHeight || 150 });
        img.onerror = () => resolve({ width: 400, height: 150 });
        img.src = dataUrl;
    });
}

function run(text: string, opts: { bold?: boolean; size: number; color?: string }): string {
    return `<w:r><w:rPr>${opts.bold ? '<w:b/>' : ''}${opts.color ? `<w:color w:val="${opts.color}"/>` : ''}<w:sz w:val="${opts.size}"/><w:szCs w:val="${opts.size}"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function paragraph(content: string, opts: { line?: boolean; spaceAfter?: number } = {}): string {
    const border = opts.line ? '<w:pBdr><w:top w:val="single" w:sz="4" w:space="1" w:color="808080"/></w:pBdr>' : '';

    return `<w:p><w:pPr>${border}<w:spacing w:before="0" w:after="${opts.spaceAfter ?? 0}"/><w:jc w:val="center"/></w:pPr>${content}</w:p>`;
}

function drawing(relId: string, id: number, cx: number, cy: number): string {
    return `<w:r><w:drawing><wp:inline xmlns:wp="${NS.wp}" distT="0" distB="0" distL="0" distR="0">`
        + `<wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Signature ${id}"/>`
        + `<a:graphic xmlns:a="${NS.a}"><a:graphicData uri="${NS.pic}"><pic:pic xmlns:pic="${NS.pic}">`
        + `<pic:nvPicPr><pic:cNvPr id="${id}" name="signature-${id}"/><pic:cNvPicPr/></pic:nvPicPr>`
        + `<pic:blipFill><a:blip xmlns:r="${NS.r}" r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`
        + `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>`
        + '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
}

/** Add the signed blocks to the end of the Word document and return the new .docx bytes. */
export async function stampDocx(bytes: ArrayBuffer, blocks: SignatureBlock[]): Promise<Uint8Array> {
    const zip = await JSZip.loadAsync(bytes);
    const docPath = 'word/document.xml';
    const relsPath = 'word/_rels/document.xml.rels';
    const typesPath = '[Content_Types].xml';
    let xml = await zip.file(docPath)?.async('string');
    let rels = (await zip.file(relsPath)?.async('string'))
        ?? '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
    let types = await zip.file(typesPath)?.async('string');

    if (!xml || !types) {
        throw new Error('This Word file could not be read, so the signatures could not be added to it.');
    }

    const signed = blocks.filter((b) => b.signed && b.image);
    const cells: string[] = [];

    for (const [index, block] of signed.entries()) {
        const { bytes: image, ext } = decodeDataUrl(block.image!);
        const { width, height } = await imageSize(block.image!);
        const scale = Math.min(IMAGE_MAX_W / width, IMAGE_MAX_H / height);
        const relId = `rIdTngSignature${index + 1}`;
        const target = `media/tng_signature_${index + 1}.${ext}`;

        zip.file(`word/${target}`, image);
        rels = rels.replace('</Relationships>', `<Relationship Id="${relId}" Type="${REL_IMAGE}" Target="${target}"/></Relationships>`);

        if (!new RegExp(`Extension="${ext}"`, 'i').test(types)) {
            types = types.replace('</Types>', `<Default Extension="${ext}" ContentType="image/${ext}"/></Types>`);
        }

        cells.push(
            paragraph(drawing(relId, 7100 + index, Math.round(width * scale), Math.round(height * scale)))
            + paragraph(run(block.name, { bold: true, size: 18 }), { line: true })
            + (block.position ? paragraph(run(block.position, { size: 15, color: '5F6670' })) : '')
            + (block.date ? paragraph(run(`Signed ${block.date}`, { size: 15, color: '5F6670' }), { spaceAfter: 120 }) : ''),
        );
    }

    // Up to three signatures per row, in signing order
    const rows: string[] = [];

    for (let i = 0; i < cells.length; i += PER_ROW) {
        const row = cells.slice(i, i + PER_ROW);

        while (row.length < PER_ROW) {
            row.push('<w:p/>');
        }

        rows.push(`<w:tr>${row.map((cell) => `<w:tc><w:tcPr><w:tcW w:w="${Math.floor(5000 / PER_ROW)}" w:type="pct"/></w:tcPr>${cell}</w:tc>`).join('')}</w:tr>`);
    }

    const noBorders = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((side) => `<w:${side} w:val="nil"/>`).join('');
    const section = paragraph(run('Signatures', { bold: true, size: 22 }), { spaceAfter: 120 }).replace('<w:jc w:val="center"/>', '<w:keepNext/>')
        + `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:jc w:val="center"/><w:tblBorders>${noBorders}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr>`
        + `<w:tblGrid>${'<w:gridCol w:w="3000"/>'.repeat(PER_ROW)}</w:tblGrid>${rows.join('')}</w:tbl>`;

    // Before the document's final section properties (a direct child of the body), else at the end of the body
    const bodyEnd = xml.lastIndexOf('</w:body>');
    const sectPr = xml.lastIndexOf('<w:sectPr', bodyEnd);
    const insideBlock = sectPr > -1 && /<\/w:(p|tbl)>/.test(xml.slice(sectPr, bodyEnd));
    const insertAt = sectPr > -1 && !insideBlock ? sectPr : bodyEnd;
    xml = xml.slice(0, insertAt) + section + xml.slice(insertAt);

    zip.file(docPath, xml);
    zip.file(relsPath, rels);
    zip.file(typesPath, types);

    return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
