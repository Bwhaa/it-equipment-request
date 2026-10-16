'use client';

import { useRouter } from 'next/navigation';
import { startTransition } from 'react';
import { Button } from './button';

/** Used by the error.tsx boundaries; `reset` is the boundary's reset callback. */
export function ErrorState({
  title = 'เกิดข้อผิดพลาด',
  message = 'ไม่สามารถเชื่อมต่อระบบได้ ลองใหม่อีกครั้ง',
  reset,
}: {
  title?: string;
  message?: string;
  reset: () => void;
}) {
  const router = useRouter();

  return (
    <div role="alert" className="rounded border border-red-400 bg-red-50 p-4 text-red-900">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm">{message}</p>
      <Button
        variant="secondary"
        className="mt-3"
        onClick={() =>
          startTransition(() => {
            router.refresh();
            reset();
          })
        }
      >
        ลองใหม่
      </Button>
    </div>
  );
}
