import React from 'react';

export const ProntoLogo = ({ className = "w-8 h-8", ...props }: React.ComponentProps<'svg'>) => (
  <svg
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    {...props}
  >
    <defs>
      <linearGradient id="pronto-gradient" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
        <stop stopColor="#6366f1" /> {/* Indigo-500 */}
        <stop offset="1" stopColor="#8b5cf6" /> {/* Violet-500 */}
      </linearGradient>
    </defs>
    
    {/* Chat Bubble Container */}
    <path
      d="M20 20 H80 A12 12 0 0 1 92 32 V68 A12 12 0 0 1 80 80 H45 L28 92 L32 75 H20 A12 12 0 0 1 8 63 V32 A12 12 0 0 1 20 20 Z"
      stroke="url(#pronto-gradient)"
      strokeWidth="8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-indigo-500"
    />
    
    {/* Lightning Bolt */}
    <path
      d="M55 28 L42 52 H58 L45 76"
      stroke="url(#pronto-gradient)"
      strokeWidth="8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
