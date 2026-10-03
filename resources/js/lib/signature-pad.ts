/** Whether nothing has been drawn on a react-signature-canvas pad (pads without isEmpty() count as signed). */
export function isSignaturePadEmpty(pad: any): boolean {
    if (!pad) {
        return true;
    }

    return typeof pad.isEmpty === 'function' ? pad.isEmpty() : false;
}

/** The drawn signature as a PNG data URL (trimmed to the strokes when possible), or '' if it cannot be read. */
export function signaturePadDataUrl(pad: any): string {
    try {
        let canvas = null;

        if (pad) {
            if (typeof pad.getTrimmedCanvas === 'function') {
                try {
                    canvas = pad.getTrimmedCanvas();
                } catch {
                    console.warn('getTrimmedCanvas failed, trying getCanvas');

                    if (typeof pad.getCanvas === 'function') {
                        canvas = pad.getCanvas();
                    }
                }
            } else if (typeof pad.getCanvas === 'function') {
                canvas = pad.getCanvas();
            } else if (pad instanceof HTMLCanvasElement) {
                canvas = pad;
            }
        }

        return canvas ? canvas.toDataURL('image/png') : '';
    } catch (err) {
        console.error('Error extracting signature canvas:', err);

        return '';
    }
}
