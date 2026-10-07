import type { Metadata } from 'next';
import { Inter, Atkinson_Hyperlegible } from 'next/font/google';
import './globals.css';
import { AccessibilityProvider } from '@/context/AccessibilityContext';
import { VoiceAssistantProvider } from '@/context/VoiceAssistantContext';
import TalkToAssistantButton from '@/components/TalkToAssistantButton';
import CapacitorInit from '@/components/CapacitorInit';
import ConversationalVoiceOnboarding from '@/components/ConversationalVoiceOnboarding';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

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
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.png',
    apple: '/apple-touch-icon.png',
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read preferred language from session cookie for WCAG 3.1.1 compliance
  let htmlLang = 'en';
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('pf_session')?.value;
    if (token) {
      const session = await verifyToken(token);
      // preferredLanguage is stored in the user DB; use session email as key
      // Fall back gracefully — lang is a best-effort from localStorage on client
      void session; // session used for future server-side lang lookup
    }
    // Also check localStorage-synced cookie set by client script
    const langCookie = cookieStore.get('pathfinder_lang')?.value;
    if (langCookie && /^[a-z]{2,5}(-[A-Z]{2})?$/.test(langCookie)) {
      htmlLang = langCookie;
    }
  } catch {
    // silently fall back to 'en'
  }

  return (
    <html lang={htmlLang} suppressHydrationWarning className={`${inter.variable} ${atkinson.variable} h-full antialiased`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('pathfinder_theme')||localStorage.getItem('theme');var dark=t==='dark'||(!t&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(dark){document.documentElement.classList.add('dark','dark-mode');document.documentElement.setAttribute('data-theme','dark');document.documentElement.style.colorScheme='dark';}else{document.documentElement.classList.remove('dark','dark-mode');document.documentElement.setAttribute('data-theme','light');document.documentElement.style.colorScheme='light';}var s=localStorage.getItem('pathfinder_font_scale')||'md';document.documentElement.classList.remove('font-scale-sm','font-scale-md','font-scale-lg');document.documentElement.classList.add('font-scale-'+s);document.documentElement.setAttribute('data-font-scale',s);if(s==='sm'){document.documentElement.style.fontSize='87.5%';}else if(s==='lg'){document.documentElement.style.fontSize='120%';}else{document.documentElement.style.fontSize='100%';}var u=localStorage.getItem('pathfinder_user');if(u){try{var p=JSON.parse(u);if(p&&p.preferredLanguage){document.cookie='pathfinder_lang='+p.preferredLanguage+';path=/;max-age=604800;samesite=lax';document.documentElement.setAttribute('lang',p.preferredLanguage);}}catch(e2){}}else{var lc=document.cookie.split(';').find(function(c){return c.trim().startsWith('pathfinder_lang=');});if(!lc){document.cookie='pathfinder_lang=en;path=/;max-age=604800;samesite=lax';}}}catch(e){}})();`,
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
