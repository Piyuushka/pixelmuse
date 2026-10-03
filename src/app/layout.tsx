import type { Metadata } from 'next';
import { Inter, Atkinson_Hyperlegible } from 'next/font/google';
import './globals.css';
import { AccessibilityProvider } from '@/context/AccessibilityContext';
import Sidebar from '@/components/Sidebar';
import TalkToAssistantButton from '@/components/TalkToAssistantButton';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const atkinson = Atkinson_Hyperlegible({
  weight: ['400', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-atkinson',
});

export const metadata: Metadata = {
  title: 'PathFinder Access - GPS High Precision Navigation Dashboard',
  description: 'WCAG AAA barrier-free navigation dashboard for accessible urban exploration, wheelchair navigation, micro-navigation, live rerouting, and crowdsourced hazard reporting.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${atkinson.variable} h-full antialiased`}>
      <body className="min-h-full flex bg-surface text-on-surface overflow-x-hidden">
        <AccessibilityProvider>
          <div className="flex w-full min-h-screen">
            <Sidebar />
            <main className="flex-1 min-w-0 overflow-y-auto min-h-screen">
              {children}
            </main>
          </div>
          <TalkToAssistantButton variant="fab" />
        </AccessibilityProvider>
      </body>
    </html>
  );
}
