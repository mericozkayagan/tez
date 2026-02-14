import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'AI Assistant – Your Intelligent Productivity Hub',
    description: 'Multi-tenant AI personal assistant with Google Calendar, Drive, and Notion integration.',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="dark">
            <body className="min-h-screen">
                {children}
            </body>
        </html>
    );
}
