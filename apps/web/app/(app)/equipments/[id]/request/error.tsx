'use client';

import { ErrorState } from '@/components/ui/error-state';

export default function RequestFormError({ reset }: { reset: () => void }) {
  return <ErrorState title="ไม่สามารถโหลดแบบฟอร์มขอเบิกได้" reset={reset} />;
}
