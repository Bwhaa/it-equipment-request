'use client';

// A layout error is caught by the PARENT segment's boundary, which is why this lives at app/ level.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-4 text-center">
      <p role="alert">ไม่สามารถเชื่อมต่อระบบได้ ลองใหม่อีกครั้ง</p>
      <button type="button" onClick={() => reset()} className="rounded border border-neutral-400 px-3 py-1">
        ลองใหม่
      </button>
    </main>
  );
}
