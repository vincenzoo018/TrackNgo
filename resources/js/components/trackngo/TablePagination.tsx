import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface TablePaginationProps {
    currentPage: number;
    pageSize: number;
    totalItems: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
    itemLabel?: string;
    pageSizeOptions?: number[];
    className?: string;
}

/**
 * Generates an array of page numbers with smart ellipsis for clean pagination navigation.
 */
export function getPageNumbers(current: number, total: number): (number | string)[] {
    if (total <= 7) {
        return Array.from({ length: total }, (_, i) => i + 1);
    }
    if (current <= 4) {
        return [1, 2, 3, 4, 5, '...', total];
    }
    if (current >= total - 3) {
        return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    }
    return [1, '...', current - 1, current, current + 1, '...', total];
}

export function TablePagination({
    currentPage,
    pageSize,
    totalItems,
    onPageChange,
    onPageSizeChange,
    itemLabel = 'records',
    pageSizeOptions = [20, 50, 100],
    className = '',
}: TablePaginationProps) {
    if (totalItems <= 0) {
        return null;
    }

    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
    const startIndex = (safeCurrentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);

    return (
        <div
            className={`w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-[var(--tng-slate-200)] bg-slate-50/70 px-6 py-3.5 ${className}`}
        >
            {/* Left: Record Range Summary & Items Per Page Selector */}
            <div className="flex flex-wrap items-center gap-4 text-[14px] text-slate-600 font-normal">
                <div>
                    Showing <span className="font-bold text-slate-900">{startIndex + 1}</span> to{' '}
                    <span className="font-bold text-slate-900">{endIndex}</span> of{' '}
                    <span className="font-bold text-slate-900">{totalItems}</span> {itemLabel}
                </div>

                <div className="flex items-center gap-2">
                    <label htmlFor={`perPageSelect-${itemLabel}`} className="text-[14px] font-medium text-slate-500">
                        Rows per page:
                    </label>
                    <select
                        id={`perPageSelect-${itemLabel}`}
                        value={pageSize}
                        onChange={(e) => {
                            onPageSizeChange(Number(e.target.value));
                            onPageChange(1);
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[14px] font-semibold text-slate-700 outline-none focus:border-blue-500 shadow-2xs cursor-pointer"
                    >
                        {pageSizeOptions.map((opt) => (
                            <option key={opt} value={opt}>
                                {opt}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Right: Previous, Numbered Buttons with Ellipsis, Next */}
            <div className="flex items-center gap-1.5">
                <button
                    type="button"
                    onClick={() => onPageChange(Math.max(1, safeCurrentPage - 1))}
                    disabled={safeCurrentPage <= 1}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[14px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition-colors cursor-pointer"
                >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                </button>

                <div className="flex items-center gap-1">
                    {getPageNumbers(safeCurrentPage, totalPages).map((page, idx) => {
                        if (typeof page === 'string') {
                            return (
                                <span
                                    key={`ellipsis-${idx}`}
                                    className="px-1 text-[14px] text-slate-400 font-bold select-none"
                                >
                                    …
                                </span>
                            );
                        }
                        const isCurrent = page === safeCurrentPage;
                        return (
                            <button
                                key={page}
                                type="button"
                                onClick={() => onPageChange(page)}
                                className={`min-w-[34px] h-[34px] rounded-lg text-[14px] font-bold transition-all cursor-pointer ${
                                    isCurrent
                                        ? 'bg-[var(--tng-blue-600)] text-white shadow-xs'
                                        : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs'
                                }`}
                            >
                                {page}
                            </button>
                        );
                    })}
                </div>

                <button
                    type="button"
                    onClick={() => onPageChange(Math.min(totalPages, safeCurrentPage + 1))}
                    disabled={safeCurrentPage >= totalPages}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[14px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition-colors cursor-pointer"
                >
                    Next
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}

export default TablePagination;
