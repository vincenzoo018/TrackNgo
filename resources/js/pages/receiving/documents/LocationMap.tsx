import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, MapPin, Search } from 'lucide-react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';

export default function LocationMap() {
    return (
        <TrackngoLayout
            breadcrumbs={[
                { title: 'Home', href: '/receiving' },
                { title: 'My Documents', href: '/receiving/documents' },
                { title: 'TNG-2026-0004', href: '/receiving/documents/1' },
                { title: 'Location Map', href: '#' },
            ]}
        >
            <Head title="Physical Location Map — TrackNGo Mati" />

            <div className="flex h-[calc(100vh-140px)] flex-col space-y-4">
                <div className="flex items-center justify-between shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--tng-slate-900)] flex items-center gap-2">
                            <MapPin className="h-6 w-6 text-[var(--tng-emerald-600)]" />
                            Physical Location Map
                        </h1>
                        <p className="mt-0.5 text-sm text-[var(--tng-slate-500)]">
                            TNG-2026-0004 — Currently located at City Engineering Office (Floor 2, Wing A)
                        </p>
                    </div>
                    <Link
                        href="/receiving/documents/1"
                        className="flex items-center gap-1.5 rounded-lg border border-[var(--tng-slate-200)] bg-white px-3 py-2 text-sm font-medium text-[var(--tng-slate-600)] transition-colors hover:bg-[var(--tng-slate-50)]"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Document
                    </Link>
                </div>

                <div className="flex-1 rounded-xl border border-[var(--tng-slate-200)] bg-white overflow-hidden flex flex-col relative">
                    <div className="absolute top-4 left-4 z-10 w-72 rounded-xl bg-white/90 p-4 shadow-lg backdrop-blur">
                        <div className="mb-3 relative">
                            <input type="text" placeholder="Search departments..." className="w-full rounded-lg border border-[var(--tng-slate-200)] bg-white py-2 pl-9 pr-3 text-sm focus:border-[var(--tng-emerald-500)] focus:ring-1 focus:ring-[var(--tng-emerald-500)]" />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--tng-slate-400)]" />
                        </div>
                        <h3 className="text-sm font-bold text-[var(--tng-slate-800)] mb-2">Location Details</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-[var(--tng-slate-500)]">Building:</span> <span className="font-medium text-[var(--tng-slate-900)]">City Hall Main</span></div>
                            <div className="flex justify-between"><span className="text-[var(--tng-slate-500)]">Floor:</span> <span className="font-medium text-[var(--tng-slate-900)]">2nd Floor</span></div>
                            <div className="flex justify-between"><span className="text-[var(--tng-slate-500)]">Wing:</span> <span className="font-medium text-[var(--tng-slate-900)]">East Wing (A)</span></div>
                            <div className="flex justify-between"><span className="text-[var(--tng-slate-500)]">Room:</span> <span className="font-medium text-[var(--tng-slate-900)]">204 (Engineering)</span></div>
                        </div>
                    </div>

                    {/* Mock Map UI */}
                    <div className="flex-1 bg-[var(--tng-slate-100)] relative overflow-hidden flex items-center justify-center p-8">
                        <div className="w-full max-w-4xl h-full border-4 border-slate-300 rounded-3xl bg-white relative p-6 grid grid-cols-3 grid-rows-3 gap-4">
                            {/* Rooms */}
                            <div className="border-2 border-slate-200 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 font-bold">HR Office</div>
                            <div className="border-2 border-slate-200 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 font-bold">Mayor's Office</div>
                            <div className="border-2 border-slate-200 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 font-bold">Legal Office</div>
                            
                            <div className="border-2 border-emerald-400 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700 font-bold relative ring-4 ring-emerald-500/20 shadow-lg">
                                City Engineering
                                <div className="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white shadow-lg animate-bounce">
                                    <MapPin className="h-5 w-5" />
                                </div>
                            </div>
                            <div className="col-span-2 border-2 border-slate-200 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 font-bold tracking-widest uppercase">Main Hallway</div>
                            
                            <div className="border-2 border-slate-200 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 font-bold">Budget Office</div>
                            <div className="border-2 border-slate-200 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 font-bold">Receiving Area</div>
                            <div className="border-2 border-slate-200 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 font-bold">IT Department</div>
                        </div>
                    </div>
                </div>
            </div>
        </TrackngoLayout>
    );
}
