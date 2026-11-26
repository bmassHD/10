import React from 'react';

interface LogoProps {
  className?: string;
}

export const FacebookLogo: React.FC<LogoProps> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={`${className} shrink-0`}
    fill="none"
  >
    <circle cx="12" cy="12" r="11" fill="#1877F2" />
    <path
      d="M15.12 15.27l.48-3.13h-3v-2.03c0-.86.42-1.69 1.77-1.69h1.37V5.76s-1.24-.21-2.43-.21c-2.48 0-4.1 1.5-4.1 4.22v2.37H6.46v3.13h2.75v7.57a11.1 11.1 0 003.39 0v-7.57h2.52z"
      fill="#FFFFFF"
    />
  </svg>
);

export const ZaloLogo: React.FC<LogoProps> = ({ className = 'w-4 h-4' }) => (
  <img
    src="/zalo.png"
    alt="Zalo"
    className={`${className} rounded object-contain shrink-0`}
  />
);

export const TikTokLogo: React.FC<LogoProps> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={`${className} shrink-0`}
    fill="none"
  >
    <rect x="1" y="1" width="22" height="22" rx="6" fill="#0F172A" stroke="#334155" strokeWidth="0.75" />
    <path
      d="M13.3 5.4h2.15c.18 1.57 1.07 2.66 2.55 2.86v2.1c-1.08.05-2.01-.28-2.76-.86v4.62c0 2.57-1.97 4.48-4.53 4.48-2.37 0-4.21-1.85-4.21-4.24 0-2.55 2.02-4.5 4.65-4.29v2.19c-1.2-.18-2.3.71-2.3 2.05 0 1.15.86 2.04 1.97 2.04 1.14 0 2.02-.83 2.02-2.2V5.4z"
      fill="#25F4EE"
      transform="translate(-0.55, -0.45)"
    />
    <path
      d="M13.3 5.4h2.15c.18 1.57 1.07 2.66 2.55 2.86v2.1c-1.08.05-2.01-.28-2.76-.86v4.62c0 2.57-1.97 4.48-4.53 4.48-2.37 0-4.21-1.85-4.21-4.24 0-2.55 2.02-4.5 4.65-4.29v2.19c-1.2-.18-2.3.71-2.3 2.05 0 1.15.86 2.04 1.97 2.04 1.14 0 2.02-.83 2.02-2.2V5.4z"
      fill="#FE2C55"
      transform="translate(0.55, 0.45)"
    />
    <path
      d="M13.3 5.4h2.15c.18 1.57 1.07 2.66 2.55 2.86v2.1c-1.08.05-2.01-.28-2.76-.86v4.62c0 2.57-1.97 4.48-4.53 4.48-2.37 0-4.21-1.85-4.21-4.24 0-2.55 2.02-4.5 4.65-4.29v2.19c-1.2-.18-2.3.71-2.3 2.05 0 1.15.86 2.04 1.97 2.04 1.14 0 2.02-.83 2.02-2.2V5.4z"
      fill="#FFFFFF"
    />
  </svg>
);

export const YouTubeLogo: React.FC<LogoProps> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={`${className} shrink-0`}
    fill="none"
  >
    <path
      d="M22.54 7.64a2.76 2.76 0 00-1.94-1.95C18.88 5.2 12 5.2 12 5.2s-6.88 0-8.6.49A2.76 2.76 0 001.46 7.64 28.9 28.9 0 001 12a28.9 28.9 0 00.46 4.36 2.76 2.76 0 001.94 1.95c1.72.49 8.6.49 8.6.49s6.88 0 8.6-.49a2.76 2.76 0 001.94-1.95A28.9 28.9 0 0023 12a28.9 28.9 0 00-.46-4.36z"
      fill="#FF0000"
    />
    <path d="M9.75 15.02l5.75-3.02-5.75-3.02v6.04z" fill="#FFFFFF" />
  </svg>
);
