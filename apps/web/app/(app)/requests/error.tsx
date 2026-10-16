'use client';

import { ErrorState } from '@/components/ui/error-state';

export default function RequestsError({ reset }: { reset: () => void }) {
  return <ErrorState title="ไม่สามารถโหลดรายการคำขอได้" reset={reset} />;
}
