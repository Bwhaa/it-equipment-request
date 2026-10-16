'use client';

import { ErrorState } from '@/components/ui/error-state';

export default function EquipmentsError({ reset }: { reset: () => void }) {
  return <ErrorState title="ไม่สามารถโหลดรายการอุปกรณ์ได้" reset={reset} />;
}
