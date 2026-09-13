import { Head, Link } from '@inertiajs/react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { UserPlus, Save, ArrowLeft, Upload, PenTool, RotateCcw } from 'lucide-react';
import { useState, useRef } from 'react';

export default function CreateUser() {
    // Signature Pad State
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSignature, setHasSignature] = useState(false);

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.beginPath();
        ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
        setIsDrawing(true);
        setHasSignature(true);
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
        setHasSignature(false);
    };

    return (
        <TrackngoLayout>
            <Head title="Create New User — TrackNGo Mati" />

            <div className="space-y-6 pb-8">
                
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between shrink-0 gap-4">
                    <div className="flex items-center gap-4">
                        <Link href="/admin/users" className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--tng-slate-200)] bg-white text-[var(--tng-slate-500)] hover:bg-[var(--tng-slate-50)] hover:text-[var(--tng-slate-800)] transition-colors">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-[var(--tng-slate-900)] flex items-center gap-2">
                                <UserPlus className="h-6 w-6 text-[var(--tng-blue-600)]" />
                                Create New User
                            </h1>
                            <p className="mt-0.5 text-sm text-[var(--tng-slate-500)]">
                                Register a new LGU employee and capture their digital signature.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link href="/admin/users" className="px-4 py-2 text-sm font-medium text-[var(--tng-slate-600)] hover:text-[var(--tng-slate-900)]">
                            Cancel
                        </Link>
                        <button className="flex items-center gap-2 rounded-lg bg-[var(--tng-blue-600)] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[var(--tng-blue-700)] transition-colors shadow-md">
                            <Save className="h-4 w-4" /> Save User Account
                        </button>
                    </div>
                </div>

                {/* Main Content Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    
                    {/* Left Column: Staff Details */}
                    <div className="space-y-6">
                        <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-6 shadow-sm">
                            <h2 className="text-base font-bold text-[var(--tng-slate-900)] mb-5">Staff Information</h2>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--tng-slate-700)] mb-1.5">Full Name</label>
                                    <input type="text" placeholder="e.g. Juan Dela Cruz" className="w-full rounded-lg border border-[var(--tng-slate-200)] px-4 py-2.5 text-sm focus:border-[var(--tng-blue-500)] focus:ring-4 focus:ring-[var(--tng-blue-500)]/10 outline-none transition-all" />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-[var(--tng-slate-700)] mb-1.5">Email Address</label>
                                    <input type="email" placeholder="juan@maticity.gov.ph" className="w-full rounded-lg border border-[var(--tng-slate-200)] px-4 py-2.5 text-sm focus:border-[var(--tng-blue-500)] focus:ring-4 focus:ring-[var(--tng-blue-500)]/10 outline-none transition-all" />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--tng-slate-700)] mb-1.5">System Role</label>
                                        <select className="w-full rounded-lg border border-[var(--tng-slate-200)] px-4 py-2.5 text-sm focus:border-[var(--tng-blue-500)] focus:ring-4 focus:ring-[var(--tng-blue-500)]/10 outline-none transition-all bg-white">
                                            <option value="">Select Role...</option>
                                            <option value="receiving">Receiving Clerk</option>
                                            <option value="cart">CART Officer</option>
                                            <option value="dh">Department Head</option>
                                            <option value="mayor">Office of the Mayor</option>
                                            <option value="admin">System Admin</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--tng-slate-700)] mb-1.5">Department</label>
                                        <select className="w-full rounded-lg border border-[var(--tng-slate-200)] px-4 py-2.5 text-sm focus:border-[var(--tng-blue-500)] focus:ring-4 focus:ring-[var(--tng-blue-500)]/10 outline-none transition-all bg-white">
                                            <option value="">Select Department...</option>
                                            <option value="mayor">Office of the Mayor</option>
                                            <option value="legal">City Legal Office</option>
                                            <option value="engineering">City Engineering Office</option>
                                            <option value="hr">HRMO</option>
                                            <option value="budget">City Budget Office</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-[var(--tng-slate-700)] mb-1.5">Temporary Password</label>
                                    <input type="password" placeholder="••••••••" className="w-full rounded-lg border border-[var(--tng-slate-200)] px-4 py-2.5 text-sm font-mono focus:border-[var(--tng-blue-500)] focus:ring-4 focus:ring-[var(--tng-blue-500)]/10 outline-none transition-all" />
                                    <p className="mt-1.5 text-xs text-[var(--tng-slate-500)]">User will be required to change this upon first login.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Signature Pad */}
                    <div className="space-y-6">
                        <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-6 shadow-sm relative overflow-hidden">
                            {/* Visual accent line */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--tng-blue-500)] to-indigo-500"></div>

                            <div className="flex items-center gap-2 mb-1 mt-1">
                                <PenTool className="h-5 w-5 text-[var(--tng-blue-600)]" />
                                <h2 className="text-base font-bold text-[var(--tng-slate-900)]">Official Signature Registration</h2>
                            </div>
                            <p className="text-sm text-[var(--tng-slate-500)] mb-5">
                                Please ask the staff member to draw their signature below. This will be saved as an image and bound to their account for e-signing documents.
                            </p>
                            
                            <div className={`rounded-xl border-2 border-dashed transition-colors ${hasSignature ? 'border-[var(--tng-blue-400)] bg-[var(--tng-blue-50)]' : 'border-[var(--tng-slate-300)] bg-[var(--tng-slate-50)]'} p-3`}>
                                <canvas 
                                    ref={canvasRef}
                                    width={500} 
                                    height={220} 
                                    className="w-full h-[220px] bg-white rounded-lg cursor-crosshair shadow-sm border border-[var(--tng-slate-200)]"
                                    onMouseDown={startDrawing}
                                    onMouseMove={draw}
                                    onMouseUp={stopDrawing}
                                    onMouseLeave={stopDrawing}
                                />
                            </div>

                            <div className="flex items-center justify-between mt-4">
                                <button onClick={clearCanvas} className="flex items-center gap-2 text-sm font-medium text-[var(--tng-slate-500)] hover:text-[var(--tng-slate-900)] transition-colors">
                                    <RotateCcw className="h-4 w-4" /> Clear Canvas
                                </button>
                                
                                {hasSignature && (
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 animate-in fade-in">
                                        Signature Captured
                                    </span>
                                )}
                            </div>

                            <div className="mt-6 pt-6 border-t border-[var(--tng-slate-100)]">
                                <p className="text-sm font-medium text-[var(--tng-slate-700)] mb-3">Or Upload Existing Signature</p>
                                <div className="group flex cursor-pointer items-center justify-center gap-3 rounded-lg border border-[var(--tng-slate-200)] bg-white px-4 py-3 hover:border-[var(--tng-blue-400)] hover:bg-[var(--tng-blue-50)] transition-all">
                                    <Upload className="h-5 w-5 text-[var(--tng-slate-400)] group-hover:text-[var(--tng-blue-600)]" />
                                    <span className="text-sm font-medium text-[var(--tng-slate-600)] group-hover:text-[var(--tng-blue-700)]">Upload Transparent PNG</span>
                                </div>
                            </div>

                        </div>
                    </div>

                </div>
            </div>
        </TrackngoLayout>
    );
}
