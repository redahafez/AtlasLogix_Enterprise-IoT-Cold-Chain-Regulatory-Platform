'use client';

import React from 'react';

interface BrandLogoProps {
  variant?: 'light' | 'regular'; // 'light' = Light logo on dark surface, 'regular' = Regular logo on light surface
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
  align?: 'left' | 'center';
  className?: string;
}

export function BrandLogo({
  variant = 'light',
  size = 'md',
  showTagline = true,
  align = 'left',
  className = '',
}: BrandLogoProps) {
  const isLightOnDark = variant === 'light';
  const isCentered = align === 'center';

  const emblemSizes = {
    sm: 'w-8 h-8',
    md: 'w-11 h-11',
    lg: 'w-[64px] h-[64px]',
    xl: 'w-[72px] h-[72px]',
  };

  const titleSizes = {
    sm: 'text-xl',
    md: 'text-[28px]', // Dashboard / Control panel pages company name: 28px
    lg: 'text-[36px]', // Login page company name: 36px
    xl: 'text-[42px]',
  };

  const taglineFontSize = size === 'lg' || size === 'xl' ? '10px' : '8px'; // Login page: 10px, Dashboard pages: 8px

  return (
    <div
      className={`flex ${
        isCentered ? 'flex-col items-center text-center' : 'items-center'
      } gap-3.5 ${className}`}
    >
      {/* Official Emblem Artwork SVG */}
      <div className={`${emblemSizes[size]} shrink-0 relative flex items-center justify-center`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/atlaslogix-emblem.svg"
          alt="AtlasLogix Emblem"
          className={`${emblemSizes[size]} object-contain drop-shadow-xs`}
        />
      </div>

      {/* Wordmark & Tagline */}
      <div className={`flex flex-col ${isCentered ? 'items-center' : 'items-start'} justify-center`}>
        <h1 className={`${titleSizes[size]} font-bold tracking-tight leading-none flex items-center`}>
          <span className={isLightOnDark ? 'text-white' : 'text-[#0F172A] dark:text-white'}>
            Atlas
          </span>
          <span className={isLightOnDark ? 'text-[#14B8A6]' : 'text-[#2563EB]'}>
            Logix
          </span>
        </h1>
        {showTagline && (
          <p
            style={{ fontSize: taglineFontSize }}
            className={`font-normal tracking-wide mt-1 leading-none whitespace-nowrap ${
              isLightOnDark ? 'text-[#94A3B8]' : 'text-[#64748B] dark:text-slate-400'
            }`}
          >
            Tracking &amp; Compliance Platform
          </p>
        )}
      </div>
    </div>
  );
}
