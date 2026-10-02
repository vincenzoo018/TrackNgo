import { BLOCK_LAYOUT, TEXT_SCALE } from '@/lib/signed-pdf';
import type { SignatureBlock } from '@/lib/signed-pdf';

const pct = (v: number) => `${v * 100}%`;

/**
 * Signature block drawn over the last page of the document in the viewer: stamped signatures exactly where
 * the final signed copy carries them, and a dashed placeholder for signatories who have not approved yet.
 * Sizes are relative to the page width (container query units) so it matches the PDF at any zoom.
 */
export function SignatureStampLayer({ blocks }: { blocks: SignatureBlock[] }) {
    return (
        <div
            className="pointer-events-none absolute inset-0 z-30"
            style={{ containerType: 'inline-size' }}
        >
            {blocks.map((block) => (
                <div
                    key={block.key}
                    className={`absolute ${block.signed ? '' : 'rounded border border-dashed border-amber-400 bg-amber-50/40'}`}
                    style={{
                        left: pct(block.slot.x),
                        top: pct(block.slot.y),
                        width: pct(block.slot.w),
                        height: pct(block.slot.h),
                    }}
                    title={
                        block.signed
                            ? `Signed by ${block.name}${block.date ? ` · ${block.date}` : ''}`
                            : `Awaiting the signature of ${block.name}`
                    }
                >
                    {block.signed && block.image ? (
                        <img
                            src={block.image}
                            alt={`Signature of ${block.name}`}
                            className="absolute inset-x-0 top-0 mx-auto h-full w-full object-contain object-bottom mix-blend-multiply"
                            style={{ height: pct(BLOCK_LAYOUT.imageBottom) }}
                        />
                    ) : (
                        <span
                            className="absolute inset-x-0 text-center font-medium text-amber-700 italic"
                            style={{
                                top: pct(BLOCK_LAYOUT.imageBottom / 2),
                                fontSize: `${TEXT_SCALE.small * 100}cqw`,
                            }}
                        >
                            Awaiting signature
                        </span>
                    )}
                    <span
                        className="absolute inset-x-[8%] border-t border-slate-500/70"
                        style={{ top: pct(BLOCK_LAYOUT.line) }}
                    />
                    {[
                        {
                            value: block.name,
                            at: BLOCK_LAYOUT.name,
                            size: TEXT_SCALE.name,
                            className: 'font-bold text-slate-900',
                        },
                        {
                            value: block.position,
                            at: BLOCK_LAYOUT.position,
                            size: TEXT_SCALE.small,
                            className: 'text-slate-600',
                        },
                        {
                            value: block.date,
                            at: BLOCK_LAYOUT.date,
                            size: TEXT_SCALE.small,
                            className: 'text-slate-600',
                        },
                    ]
                        .filter((line) => line.value)
                        .map((line) => (
                            // Positioned by baseline like the PDF text, hence the translate by the line height
                            <span
                                key={line.at}
                                className={`absolute inset-x-0 truncate text-center leading-none ${line.className}`}
                                style={{
                                    top: pct(line.at),
                                    fontSize: `${line.size * 100}cqw`,
                                    transform: 'translateY(-85%)',
                                }}
                            >
                                {line.value}
                            </span>
                        ))}
                </div>
            ))}
        </div>
    );
}
