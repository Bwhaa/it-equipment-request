'use client';

import { ErrorState } from '@/components/ui/error-state';

export default function EquipmentFormError({ reset }: { reset: () => void }) {
  return <ErrorState title="ไม่สามารถโหลดแบบฟอร์มอุปกรณ์ได้" reset={reset} />;
}
