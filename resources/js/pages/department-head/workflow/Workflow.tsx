import { Head } from '@inertiajs/react';
import { GitMerge, Plus, ArrowRight, Settings2 } from 'lucide-react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';

export default function Workflow() {
    return (
        <TrackngoLayout role="department-head">
            <Head title="Workflow Settings" />

            <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[var(--tng-slate-900)]">Workflow Settings</h1>
                    <p className="mt-1 text-[var(--tng-slate-500)]">Manage document routing sequences within your department</p>
                </div>
                <div className="flex gap-2">
                    <button className="flex items-center gap-2 rounded-lg bg-[var(--tng-blue-600)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--tng-blue-700)]">
                        <Plus className="h-4 w-4" />
                        New Workflow
                    </button>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4 pb-4 border-b border-[var(--tng-slate-100)]">
                        <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                                <GitMerge className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-[var(--tng-slate-900)]">Standard Review</h3>
                                <p className="text-xs text-[var(--tng-slate-500)]">Default workflow for incoming documents</p>
                            </div>
                        </div>
                        <button className="p-2 text-[var(--tng-slate-400)] hover:text-[var(--tng-blue-600)] transition-colors">
                            <Settings2 className="w-5 h-5" />
                        </button>
                    </div>
                    
                    <div className="space-y-4 relative before:absolute before:inset-0 before:ml-4 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-[var(--tng-slate-200)] before:to-transparent pt-2">
                        
                        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full border-4 border-white bg-blue-100 text-blue-600 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10 font-bold text-xs">
                                1
                            </div>
                            <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2rem)] bg-[var(--tng-slate-50)] p-3 rounded-lg border border-[var(--tng-slate-200)] shadow-sm">
                                <h4 className="font-semibold text-[var(--tng-slate-800)] text-sm">Initial Assessment</h4>
                                <p className="text-xs text-[var(--tng-slate-500)] mt-1">Assigned to: Section Head</p>
                            </div>
                        </div>
                        
                        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full border-4 border-white bg-blue-100 text-blue-600 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10 font-bold text-xs">
                                2
                            </div>
                            <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2rem)] bg-[var(--tng-slate-50)] p-3 rounded-lg border border-[var(--tng-slate-200)] shadow-sm">
                                <h4 className="font-semibold text-[var(--tng-slate-800)] text-sm">Technical Review</h4>
                                <p className="text-xs text-[var(--tng-slate-500)] mt-1">Assigned to: Technical Staff</p>
                            </div>
                        </div>

                        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full border-4 border-white bg-[var(--tng-blue-600)] text-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10 font-bold text-xs">
                                3
                            </div>
                            <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2rem)] bg-blue-50 p-3 rounded-lg border border-blue-100 shadow-sm">
                                <h4 className="font-semibold text-[var(--tng-blue-800)] text-sm">Final Endorsement</h4>
                                <p className="text-xs text-[var(--tng-blue-600)] mt-1">Assigned to: Department Head</p>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </TrackngoLayout>
    );
}
