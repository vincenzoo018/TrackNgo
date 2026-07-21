import { Head } from '@inertiajs/react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { PenTool, Upload, Lock, ShieldCheck, CheckCircle2, RotateCcw } from 'lucide-react';
import { useState, useRef } from 'react';

export default function ESignatureSettings({ role = 'department-head' }: { role?: 'department-head' | 'mayor' }) {
    const [pin, setPin] = useState('1234');
    const [saved, setSaved] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.beginPath();
        ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
        setIsDrawing(true);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const handleSave = () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    return (
        <TrackngoLayout role={role}>
            <Head title="E-Signature Settings — TrackNGo Mati" />

            <div className="flex h-[calc(100vh-140px)] flex-col space-y-6 overflow-y-auto tng-scrollbar pb-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between shrink-0 gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--tng-slate-900)] flex items-center gap-2">
                            <PenTool className="h-6 w-6 text-[var(--tng-blue-600)]" />
                            Digital Signature & Security
                        </h1>
                        <p className="mt-0.5 text-sm text-[var(--tng-slate-500)]">
                            Configure your e-signature appearance and batch-signing PIN code.
                        </p>
                    </div>
                    {saved && (
                        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2 text-emerald-700 border border-emerald-200 animate-in slide-in-from-right-4">
                            <CheckCircle2 className="h-4 w-4" /> Settings Saved
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    
                    {/* Canvas Section */}
                    <div className="space-y-6">
                        <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-6 shadow-sm">
                            <h2 className="text-base font-bold text-[var(--tng-slate-800)] mb-1">Draw Signature</h2>
                            <p className="text-sm text-[var(--tng-slate-500)] mb-4">Use your mouse or touchscreen to draw your official signature.</p>
                            
                            <div className="rounded-lg border-2 border-dashed border-[var(--tng-slate-300)] bg-[var(--tng-slate-50)] p-2">
                                <canvas 
                                    ref={canvasRef}
                                    width={400} 
                                    height={200} 
                                    className="w-full h-[200px] bg-white rounded cursor-crosshair shadow-inner"
                                    onMouseDown={startDrawing}
                                    onMouseMove={draw}
                                    onMouseUp={stopDrawing}
                                    onMouseLeave={stopDrawing}
                                />
                            </div>
                            <div className="flex justify-between mt-4">
                                <button onClick={clearCanvas} className="flex items-center gap-2 text-sm font-medium text-[var(--tng-slate-500)] hover:text-[var(--tng-slate-800)]">
                                    <RotateCcw className="h-4 w-4" /> Clear Pad
                                </button>
                                <button onClick={handleSave} className="rounded-lg bg-[var(--tng-slate-900)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--tng-slate-800)]">
                                    Save Signature
                                </button>
                            </div>
                        </div>

                        <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-6 shadow-sm">
                            <h2 className="text-base font-bold text-[var(--tng-slate-800)] mb-1">Upload Signature Image</h2>
                            <p className="text-sm text-[var(--tng-slate-500)] mb-4">Alternatively, upload a transparent PNG of your signature.</p>
                            
                            <div className="group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)] py-8 transition-colors hover:border-[var(--tng-blue-400)] hover:bg-[var(--tng-blue-50)]">
                                <Upload className="h-8 w-8 text-[var(--tng-slate-400)] group-hover:text-[var(--tng-blue-600)]" />
                                <span className="text-sm font-medium text-[var(--tng-slate-600)]">Click to browse or drag image here</span>
                            </div>
                        </div>
                    </div>

                    {/* Security Section */}
                    <div className="space-y-6">
                        <div className="rounded-xl border border-[var(--tng-blue-200)] bg-[var(--tng-blue-50)]/50 p-6 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--tng-blue-600)] text-white shadow-md">
                                    <Lock className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-[var(--tng-slate-900)]">Batch Signing PIN</h2>
                                    <p className="text-sm text-[var(--tng-blue-700)]">Used to authorize bulk e-signature actions.</p>
                                </div>
                            </div>
                            
                            <div className="space-y-4 bg-white p-5 rounded-lg border border-[var(--tng-blue-100)]">
                                <div>
                                    <label className="block text-sm font-semibold text-[var(--tng-slate-700)] mb-1">Current PIN</label>
                                    <input type="password" value={pin} readOnly className="w-full max-w-[200px] rounded-lg border border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)] px-3 py-2 font-mono tracking-widest" />
                                </div>
                                <div className="pt-2 border-t border-[var(--tng-slate-100)]">
                                    <label className="block text-sm font-semibold text-[var(--tng-slate-700)] mb-1">Set New PIN (4 Digits)</label>
                                    <input type="password" maxLength={4} placeholder="••••" className="w-full max-w-[200px] rounded-lg border border-[var(--tng-slate-200)] bg-white px-3 py-2 font-mono tracking-widest focus:border-[var(--tng-blue-500)] focus:ring-1 focus:ring-[var(--tng-blue-500)] outline-none" />
                                </div>
                                <button onClick={handleSave} className="rounded-lg bg-[var(--tng-blue-600)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--tng-blue-700)] mt-2">
                                    Update PIN
                                </button>
                            </div>
                        </div>

                        <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-6 shadow-sm">
                            <h2 className="text-base font-bold text-[var(--tng-slate-800)] mb-4 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-600"/> Signature Audit Log</h2>
                            <div className="space-y-3">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="flex justify-between items-center text-sm border-b border-[var(--tng-slate-100)] pb-3 last:border-0 last:pb-0">
                                        <div>
                                            <p className="font-medium text-[var(--tng-slate-800)]">Batch Signed 14 Documents</p>
                                            <p className="text-xs text-[var(--tng-slate-500)]">IP: 192.168.1.{100 + i}</p>
                                        </div>
                                        <span className="text-[var(--tng-slate-400)] text-xs">Today, {9 + i}:00 AM</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </TrackngoLayout>
    );
}
