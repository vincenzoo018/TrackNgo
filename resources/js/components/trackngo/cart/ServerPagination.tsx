import { router } from '@inertiajs/react';
import { useRef } from 'react';
import { TablePagination } from '@/components/trackngo/TablePagination';
import type { Pagination } from '@/lib/cart';

/** TablePagination for lists paginated on the server: keeps the current filters in the query string. */
export function ServerPagination({ pagination, itemLabel }: { pagination: Pagination; itemLabel: string }) {
    // TablePagination calls onPageChange(1) right after a size change; that visit would cancel this one
    const resizing = useRef(false);

    const visit = (changes: Record<string, number>) => {
        const params = Object.fromEntries(new URLSearchParams(window.location.search));
        router.get(window.location.pathname, { ...params, ...changes }, { preserveScroll: true, preserveState: true, onFinish: () => (resizing.current = false) });
    };

    return (
        <TablePagination
            currentPage={pagination.current_page}
            pageSize={pagination.per_page}
            totalItems={pagination.total}
            itemLabel={itemLabel}
            onPageChange={(page) => {
                if (!resizing.current && page !== pagination.current_page) {
                    visit({ page });
                }
            }}
            onPageSizeChange={(size) => {
                resizing.current = true;
                visit({ per_page: size, page: 1 });
            }}
        />
    );
}

export default ServerPagination;
