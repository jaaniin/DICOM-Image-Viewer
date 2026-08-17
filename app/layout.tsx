import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'DICOM Image Viewer',
  description: 'Zero-Footprint DICOM Image Viewer',
  openGraph: {
    title: 'DICOM Image Viewer',
    description: 'Zero-Footprint DICOM Image Viewer',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DICOM Image Viewer',
    description: 'Zero-Footprint DICOM Image Viewer',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
