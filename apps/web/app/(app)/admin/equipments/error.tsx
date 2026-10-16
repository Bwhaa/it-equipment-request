'use client';

import { ErrorState } from '@/components/ui/error-state';

export default function AdminEquipmentsError({ reset }: { reset: () => void }) {
  return <ErrorState title="ไม่สามารถโหลดรายการอุปกรณ์ได้" reset={reset} />;
}
