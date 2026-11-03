import { useQuery } from '@tanstack/react-query';

import { getReadingMonth } from '@/domain/reading';
import { pendingSyncCountQueryKey } from '@/query/reading-sync';
import { summarizePeriodSync } from '@/storage/readings';

// Comparte el prefijo del contador de pendientes: se actualiza al guardar y al terminar cada envío.
export function useSyncPeriodSummary(employeeCode: string) {
  const month = getReadingMonth(new Date());

  return useQuery({
    queryKey: [...pendingSyncCountQueryKey(employeeCode), 'period', month],
    queryFn: () => summarizePeriodSync(employeeCode, month),
    enabled: employeeCode !== '',
    networkMode: 'always',
  });
}
