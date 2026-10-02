import { useState } from 'react';

/**
 * Current page of a client-side paginated list that goes back to page 1 whenever `key` (the active
 * filters) changes — derived during render instead of resetting it in an effect.
 */
export function useResettingPage(key: string): [number, (page: number) => void] {
    const [state, setState] = useState({ key, page: 1 });
    const page = state.key === key ? state.page : 1;

    return [page, (next: number) => setState({ key, page: next })];
}
