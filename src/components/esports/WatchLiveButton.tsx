import React from 'react';
import { type EsportsMatch } from '@/lib/pandascore';

interface WatchLiveBtnProps {
  streamUrl: string | null;
  matchId: string | number;
}

export function WatchLiveButton({ streamUrl, matchId }: WatchLiveBtnProps) {
  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation(); // prevent card click events

    // Open in new tab — noopener prevents the new tab accessing window.opener
    if (streamUrl) {
      window.open(streamUrl, '_blank', 'noopener,noreferrer');
    }
  }

  const disabled = !streamUrl;

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`watch-live-btn inline-flex items-center justify-center h-8 text-xs gap-1.5 font-bold rounded-lg px-3 transition-colors ${
        disabled 
          ? 'opacity-40 cursor-not-allowed bg-secondary text-muted-foreground' 
          : 'bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer'
      }`}
      aria-label="Watch live stream in new tab"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0">
        <rect x="1" y="1.5" width="8" height="7" rx="1" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M10 4.5L11.5 5.5L10 6.5V4.5Z" fill="currentColor"/>
      </svg>
      Watch Live
    </button>
  );
}
