import * as api from '../lib/api';
import { useLoad } from './useLoad';

/** The basket a manager screen is about (GET /dtfs/:id, with its corporate actions). */
export function useManagedBasket(id: string | undefined) {
  return useLoad(
    async () => (id ? api.getDtf(id) : undefined),
    `manager-basket#${id ?? ''}`,
  );
}
