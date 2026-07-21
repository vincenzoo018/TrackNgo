import { cn } from '@/lib/utils';
import { X, Search, Building2, User } from 'lucide-react';
import { useState } from 'react';

type ForwardModalProps = {
    open: boolean;
    onClose: () => void;
    onConfirm: (destinationId: string, remarks: string) => void;
};

// Mock data for departments and users
const destinations = [
    { id: 'dept-1', type: 'department', name: 'Office of the Mayor', description: 'Final Approvals' },
    { id: 'dept-2', type: 'department', name: 'City Engineering Office', description: 'Infrastructure & Planning' },
    { id: 'dept-3', type: 'department', name: 'City Budget Office', description: 'Financial Clearances' },
    { id: 'user-1', type: 'user', name: 'Juan Dela Cruz', description: 'Technical Reviewer (Engineering)' },
    { id: 'user-2', type: 'user', name: 'Maria Santos', description: 'Admin Assistant (Mayor)' },
];

export function ForwardModal({ open, onClose, onConfirm }: ForwardModalProps) {
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'department' | 'user'>('all');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [remarks, setRemarks] = useState('');

    if (!open) return null;

    const filteredDestinations = destinations.filter(dest => {
        const matchesSearch = dest.name.toLowerCase().includes(search.toLowerCase()) || dest.description.toLowerCase().includes(search.toLowerCase());
        const matchesFilter = filter === 'all' || dest.type === filter;
        return matchesSearch && matchesFilter;
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose} />

            {/* Modal */}
            <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[var(--tng-slate-100)] px-6 py-4 shrink-0">
                    <div>
                        <h3 className="text-lg font-bold text-[var(--tng-slate-900)]">
                            Forward Document
                        </h3>
                        <p className="text-sm text-[var(--tng-slate-500)]">
                            Select the next recipient or department for endorsement.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-2 text-[var(--tng-slate-400)] transition-colors hover:bg-[var(--tng-slate-100)] hover:text-[var(--tng-slate-600)]"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Search & Filters */}
                    <div className="space-y-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--tng-slate-400)]" />
                            <input
                                type="text"
                                placeholder="Search departments or personnel..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="h-10 w-full rounded-lg border border-[var(--tng-slate-200)] bg-white pl-9 pr-4 text-sm text-[var(--tng-slate-900)] placeholder:text-[var(--tng-slate-400)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-1 focus:ring-[var(--tng-blue-500)]"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setFilter('all')}
                                className={cn("rounded-md px-3 py-1.5 text-xs font-medium transition-colors", filter === 'all' ? "bg-[var(--tng-blue-100)] text-[var(--tng-blue-700)]" : "bg-[var(--tng-slate-100)] text-[var(--tng-slate-600)] hover:bg-[var(--tng-slate-200)]")}
                            >
                                All
                            </button>
                            <button
                                onClick={() => setFilter('department')}
                                className={cn("rounded-md px-3 py-1.5 text-xs font-medium transition-colors", filter === 'department' ? "bg-[var(--tng-blue-100)] text-[var(--tng-blue-700)]" : "bg-[var(--tng-slate-100)] text-[var(--tng-slate-600)] hover:bg-[var(--tng-slate-200)]")}
                            >
                                Departments
                            </button>
                            <button
                                onClick={() => setFilter('user')}
                                className={cn("rounded-md px-3 py-1.5 text-xs font-medium transition-colors", filter === 'user' ? "bg-[var(--tng-blue-100)] text-[var(--tng-blue-700)]" : "bg-[var(--tng-slate-100)] text-[var(--tng-slate-600)] hover:bg-[var(--tng-slate-200)]")}
                            >
                                Personnel
                            </button>
                        </div>
                    </div>

                    {/* Destination List */}
                    <div className="space-y-2 border border-[var(--tng-slate-200)] rounded-xl overflow-hidden max-h-60 overflow-y-auto bg-[var(--tng-slate-50)] p-2">
                        {filteredDestinations.length === 0 ? (
                            <div className="p-8 text-center text-sm text-[var(--tng-slate-500)]">
                                No recipients found.
                            </div>
                        ) : (
                            filteredDestinations.map((dest) => (
                                <label
                                    key={dest.id}
                                    className={cn(
                                        "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                                        selectedId === dest.id
                                            ? "border-[var(--tng-blue-500)] bg-[var(--tng-blue-50)]"
                                            : "border-transparent bg-white hover:border-[var(--tng-slate-200)] hover:bg-[var(--tng-slate-100)]"
                                    )}
                                    onClick={() => setSelectedId(dest.id)}
                                >
                                    <input
                                        type="radio"
                                        name="destination"
                                        checked={selectedId === dest.id}
                                        onChange={() => setSelectedId(dest.id)}
                                        className="mt-1 h-4 w-4 border-gray-300 text-[var(--tng-blue-600)] focus:ring-[var(--tng-blue-500)]"
                                    />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            {dest.type === 'department' ? <Building2 className="h-4 w-4 text-emerald-500" /> : <User className="h-4 w-4 text-purple-500" />}
                                            <p className="text-sm font-semibold text-[var(--tng-slate-900)]">{dest.name}</p>
                                        </div>
                                        <p className="mt-0.5 text-xs text-[var(--tng-slate-500)]">{dest.description}</p>
                                    </div>
                                </label>
                            ))
                        )}
                    </div>

                    {/* Remarks */}
                    <div>
                        <label className="mb-1.5 block text-xs font-medium text-[var(--tng-slate-700)]">
                            Remarks / Instructions (Optional)
                        </label>
                        <textarea
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            placeholder="Add any notes for the recipient..."
                            rows={3}
                            className="w-full rounded-lg border border-[var(--tng-slate-200)] bg-white p-3 text-sm text-[var(--tng-slate-900)] placeholder:text-[var(--tng-slate-400)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-1 focus:ring-[var(--tng-blue-500)]"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 border-t border-[var(--tng-slate-100)] bg-[var(--tng-slate-50)] px-6 py-4 rounded-b-2xl shrink-0">
                    <button
                        onClick={onClose}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--tng-slate-600)] transition-colors hover:bg-[var(--tng-slate-200)]"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => selectedId && onConfirm(selectedId, remarks)}
                        disabled={!selectedId}
                        className={cn(
                            "flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium text-white transition-all",
                            selectedId 
                                ? "bg-[var(--tng-blue-600)] hover:bg-[var(--tng-blue-700)] shadow-md shadow-blue-600/25"
                                : "bg-[var(--tng-slate-300)] cursor-not-allowed"
                        )}
                    >
                        Confirm & Forward
                    </button>
                </div>
            </div>
        </div>
    );
}
