import React from 'react';
import { Mic } from 'lucide-react';
import { useVoiceFeedback } from '@/hooks/useVoiceFeedback';

export interface VoiceButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  announcement: string;
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
  label?: string;
  className?: string;
}

const SIZES = {
  sm: 'w-7 h-7 p-1',
  md: 'w-9 h-9 p-1.5',
  lg: 'w-11 h-11 p-2.5',
};

const ICON_SIZES = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

export const VoiceButton: React.FC<VoiceButtonProps> = ({
  announcement,
  size = 'md',
  active = false,
  label = 'Activate voice prompt',
  className = '',
  onClick,
  ...props
}) => {
  const { speakText } = useVoiceFeedback();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    speakText(announcement);
    if (onClick) onClick(e);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center rounded-xl transition-all ${SIZES[size]} ${
        active
          ? 'bg-primary text-white shadow-xs animate-pulse'
          : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-high'
      } ${className}`}
      {...props}
    >
      <Mic className={ICON_SIZES[size]} />
    </button>
  );
};

export default VoiceButton;
