import { type ReactNode } from 'react';
import Website from '@/layouts/Website';

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <Website config={{ layout: { padding: 'none', maxWidth: 'full', background: 'default' } }}>
      {children}
    </Website>
  );
}
