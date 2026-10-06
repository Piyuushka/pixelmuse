'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/login');
    }, 3000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div 
      className="fixed inset-0 z-50 w-screen h-screen flex flex-col items-center justify-center select-none overflow-hidden"
      style={{ backgroundColor: '#0b132b' }}
      role="main"
      aria-label="Path Finder Loading"
    >
      <div 
        className="flex flex-col items-center justify-center gap-5 transition-all"
        style={{
          animation: 'splashFade 3s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        }}
      >
        <div 
          className="relative w-[180px] h-[180px] md:w-[250px] md:h-[250px]"
          style={{
            filter: 'drop-shadow(0 14px 32px rgba(0, 0, 0, 0.5))'
          }}
        >
          <Image
            src="/app-icon.png"
            alt="Path Finder Logo"
            fill
            priority
            className="object-contain"
          />
        </div>

        <h1 
          className="text-white text-2xl md:text-3xl font-extrabold tracking-wider text-center"
          style={{
            letterSpacing: '0.08em',
            textShadow: '0 4px 16px rgba(0, 0, 0, 0.6)'
          }}
        >
          Path Finder
        </h1>
      </div>

      <style jsx global>{`
        @keyframes splashFade {
          0% {
            opacity: 0;
            transform: scale(0.92);
          }
          25% { /* At 0.75s: Fully visible */
            opacity: 1;
            transform: scale(1);
          }
          80% { /* At 2.4s: Hold visible */
            opacity: 1;
            transform: scale(1);
          }
          100% { /* At 3.0s: Gentle fade-out before redirect */
            opacity: 0;
            transform: scale(0.96);
          }
        }
      `}</style>
    </div>
  );
}


