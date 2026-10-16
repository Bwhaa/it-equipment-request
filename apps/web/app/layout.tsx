import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'ระบบเบิกอุปกรณ์ไอที', template: '%s | ระบบเบิกอุปกรณ์ไอที' },
  description: 'ระบบขอเบิกและอนุมัติอุปกรณ์ไอทีภายในองค์กร',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
