import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'div.DICOM | Zero-Footprint Viewer',
  description: 'A modern, zero-footprint web-based DICOM viewer.',
  openGraph: {
    title: 'div.DICOM | Zero-Footprint Viewer',
    description: 'A modern, zero-footprint web-based DICOM viewer.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'div.DICOM | Zero-Footprint Viewer',
    description: 'A modern, zero-footprint web-based DICOM viewer.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
