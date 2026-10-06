import type { Metadata } from 'next';
import { Inter, Atkinson_Hyperlegible } from 'next/font/google';
import './globals.css';
import { AccessibilityProvider } from '@/context/AccessibilityContext';
import { VoiceAssistantProvider } from '@/context/VoiceAssistantContext';
import TalkToAssistantButton from '@/components/TalkToAssistantButton';
import CapacitorInit from '@/components/CapacitorInit';
import ConversationalVoiceOnboarding from '@/components/ConversationalVoiceOnboarding';

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
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${atkinson.variable} h-full antialiased`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('pathfinder_theme')||localStorage.getItem('theme');var dark=t==='dark'||(!t&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(dark){document.documentElement.classList.add('dark','dark-mode');document.documentElement.setAttribute('data-theme','dark');document.documentElement.style.colorScheme='dark';}else{document.documentElement.classList.remove('dark','dark-mode');document.documentElement.setAttribute('data-theme','light');document.documentElement.style.colorScheme='light';}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full w-full flex flex-col bg-surface text-on-surface overflow-x-hidden transition-colors duration-200">
        <AccessibilityProvider>
          <VoiceAssistantProvider>
            {/* Bootstraps all Capacitor native plugins — no-op on web */}
            <CapacitorInit />
            <ConversationalVoiceOnboarding />
            <div className="w-full min-h-screen flex flex-col">
              {children}
            </div>
            <TalkToAssistantButton variant="fab" />
          </VoiceAssistantProvider>
        </AccessibilityProvider>
      </body>
    </html>
  );
}
