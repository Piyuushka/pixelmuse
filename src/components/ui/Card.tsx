import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'elevated' | 'outlined' | 'flat';
}

const CARD_VARIANTS = {
  default: 'bg-surface-container-lowest border border-outline-variant/30 shadow-xs',
  elevated: 'bg-surface-container-lowest border border-outline-variant/20 shadow-md',
  outlined: 'bg-transparent border border-outline-variant',
  flat: 'bg-surface-container-low border border-transparent',
};

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  variant = 'default',
  ...props
}) => {
  return (
    <div
      className={`rounded-2xl p-4 transition-all ${CARD_VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => <div className={`flex items-center justify-between pb-3 ${className}`}>{children}</div>;

export const CardTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => <h3 className={`font-headline text-sm font-bold text-on-surface ${className}`}>{children}</h3>;

export const CardContent: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => <div className={`text-xs text-on-surface-variant ${className}`}>{children}</div>;

export default Card;
