import { useState } from 'react';

export function DraggableSignature({ imagePath, name }: { imagePath?: string, name?: string }) {
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [offset, setOffset] = useState({ x: 0, y: 0 });

    const handlePointerDown = (e: React.PointerEvent) => {
        setIsDragging(true);
        setOffset({
            x: e.clientX - pos.x,
            y: e.clientY - pos.y
        });
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (isDragging) {
            setPos({
                x: e.clientX - offset.x,
                y: e.clientY - offset.y
            });
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        setIsDragging(false);
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    // A nice mock signature SVG to represent the registered image if none is provided
    const signatureSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80"><path d="M20,60 Q40,10 60,40 T100,30 T140,50 T180,20" fill="transparent" stroke="%232563eb" stroke-width="3" stroke-linecap="round" /></svg>`;

    return (
        <div
            className="absolute z-20 cursor-move touch-none group"
            style={{ 
                transform: `translate(${pos.x}px, ${pos.y}px)`,
                top: '-30px', 
                left: '50%',
                marginLeft: '-75px'
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
        >
            <div className="rounded border border-transparent group-hover:border-blue-400 group-hover:bg-blue-50/50 p-2 transition-colors relative">
                {imagePath ? (
                    <img src={`/storage/${imagePath}`} alt={`Signature of ${name || 'User'}`} className="w-[150px] pointer-events-none drop-shadow-sm mix-blend-multiply" />
                ) : (
                    <img src={signatureSvg} alt="Signature Placeholder" className="w-[150px] pointer-events-none drop-shadow-sm mix-blend-multiply" />
                )}
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap pointer-events-none transition-opacity shadow-md">
                    Drag to move {name ? `${name}'s ` : ''}signature
                </div>
            </div>
        </div>
    );
}
