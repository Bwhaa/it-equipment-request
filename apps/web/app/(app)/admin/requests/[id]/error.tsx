'use client';

import { ErrorState } from '@/components/ui/error-state';

export default function AdminRequestDetailError({ reset }: { reset: () => void }) {
  return <ErrorState title="ไม่สามารถโหลดรายละเอียดคำขอได้" reset={reset} />;
}
