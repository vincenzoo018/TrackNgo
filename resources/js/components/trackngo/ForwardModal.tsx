import { cn } from '@/lib/utils';
import { Search, Building2, User, Send } from 'lucide-react';
import { useState } from 'react';
import { BaseModal } from './BaseModal';

type ForwardModalProps = {
    open: boolean;
    onClose: () => void;
    onConfirm?: (destinationType: string, destinationId: string, remarks: string) => void;
    onForward?: (destinationId: string, remarks: string) => void;
    departments?: any[];
    users?: any[];
    identifier?: string;
    defaultRemarks?: string;
};

export function ForwardModal({ 
    open, 
    onClose, 
    onConfirm, 
    onForward,
    departments = [], 
    users = [], 
    identifier,
    defaultRemarks = ''
}: ForwardModalProps) {
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'department' | 'user'>('all');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [selectedType, setSelectedType] = useState<string | null>(null);
    const [remarks, setRemarks] = useState(defaultRemarks);

    const destinations = [
        ...(departments || []).map(d => ({
            id: d.department_id,
            type: 'department',
            name: d.department_name,
            description: d.description || 'Department'
        })),
        ...(users || []).map(u => ({
            id: u.id,
            type: 'user',
            name: u.name,
            description: `${u.role_name || 'Staff'} (${u.department_name || 'No Dept'})`
        }))
    ];

    const filteredDestinations = destinations.filter(dest => {
        const matchesSearch = dest.name.toLowerCase().includes(search.toLowerCase()) || dest.description.toLowerCase().includes(search.toLowerCase());
        const matchesFilter = filter === 'all' || dest.type === filter;
        return matchesSearch && matchesFilter;
    });

    const handleConfirm = () => {
        if (selectedId) {
            if (onConfirm && selectedType) {
                onConfirm(selectedType, selectedId, remarks);
            } else if (onForward) {
                onForward(selectedId, remarks);
            }
        }
    };

    return (
        <BaseModal
            isOpen={open}
            onClose={onClose}
            title="Forward Document"
            identifier={identifier}
            description="Select the next recipient or department for endorsement."
            icon={<Send className="h-5 w-5" />}
            maxWidth="max-w-lg"
            footer={
                <>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={!selectedId}
                        className={cn(
                            "flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium text-white transition-all",
                            selectedId 
                                ? "bg-[var(--tng-blue-600)] hover:bg-[var(--tng-blue-700)] shadow-md shadow-blue-600/25"
                                : "bg-slate-300 cursor-not-allowed"
                        )}
                    >
                        Confirm & Forward
                    </button>
                </>
            }
        >
            <div className="space-y-6">
                {/* Search & Filters */}
                <div className="space-y-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search departments or personnel..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-1 focus:ring-[var(--tng-blue-500)]"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setFilter('all')}
                            className={cn("rounded-md px-3 py-1.5 text-xs font-medium transition-colors", filter === 'all' ? "bg-[var(--tng-blue-100)] text-[var(--tng-blue-700)]" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
                        >
                            All
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilter('department')}
                            className={cn("rounded-md px-3 py-1.5 text-xs font-medium transition-colors", filter === 'department' ? "bg-[var(--tng-blue-100)] text-[var(--tng-blue-700)]" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
                        >
                            Departments
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilter('user')}
                            className={cn("rounded-md px-3 py-1.5 text-xs font-medium transition-colors", filter === 'user' ? "bg-[var(--tng-blue-100)] text-[var(--tng-blue-700)]" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
                        >
                            Personnel
                        </button>
                    </div>
                </div>

                {/* Destination List */}
                <div className="space-y-2 border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto bg-slate-50 p-2">
                    {filteredDestinations.length === 0 ? (
                        <div className="p-8 text-center text-sm text-slate-500">
                            No recipients found.
                        </div>
                    ) : (
                        filteredDestinations.map((dest) => (
                            <label
                                key={`${dest.type}-${dest.id}`}
                                className={cn(
                                    "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                                    selectedId === dest.id
                                        ? "border-[var(--tng-blue-500)] bg-[var(--tng-blue-50)]"
                                        : "border-transparent bg-white hover:border-slate-200 hover:bg-slate-100"
                                )}
                                onClick={() => { setSelectedId(dest.id); setSelectedType(dest.type); }}
                            >
                                <input
                                    type="radio"
                                    name="destination"
                                    checked={selectedId === dest.id}
                                    onChange={() => { setSelectedId(dest.id); setSelectedType(dest.type); }}
                                    className="mt-1 h-4 w-4 border-gray-300 text-[var(--tng-blue-600)] focus:ring-[var(--tng-blue-500)]"
                                />
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        {dest.type === 'department' ? <Building2 className="h-4 w-4 text-emerald-500" /> : <User className="h-4 w-4 text-purple-500" />}
                                        <p className="text-sm font-semibold text-slate-900">{dest.name}</p>
                                    </div>
                                    <p className="mt-0.5 text-xs text-slate-500">{dest.description}</p>
                                </div>
                            </label>
                        ))
                    )}
                </div>

                {/* Remarks */}
                <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-700">
                        Remarks / Instructions (Optional)
                    </label>
                    <textarea
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="Add any notes for the recipient..."
                        rows={3}
                        className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-1 focus:ring-[var(--tng-blue-500)]"
                    />
                </div>
            </div>
        </BaseModal>
    );
}
