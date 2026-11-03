import { useQuery } from '@tanstack/react-query';

import { pendingSyncCountQueryKey } from '@/query/reading-sync';
import { countUnsentReadings } from '@/storage/readings';

// HU-009 CA-04: se actualiza al guardar registros y al terminar cada envío.
export function usePendingSyncCount(employeeCode: string) {
  return useQuery({
    queryKey: pendingSyncCountQueryKey(employeeCode),
    queryFn: () => countUnsentReadings(employeeCode),
    enabled: employeeCode !== '',
    networkMode: 'always',
  });
}
