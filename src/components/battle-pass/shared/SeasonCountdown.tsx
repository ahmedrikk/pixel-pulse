'use client'
import React, { useState, useEffect } from 'react';

function calcRemaining(endDate: Date) {
  const ms = endDate.getTime() - Date.now();
  if (ms < 0) return { days: 0, hours: 0, minutes: 0 };
  return {
    days: Math.floor(ms / 86400000),
    hours: Math.floor((ms % 86400000) / 3600000),
    minutes: Math.floor((ms % 3600000) / 60000),
  };
}

export function SeasonCountdown({ endDate }: { endDate: Date }) {
  const [remaining, setRemaining] = useState(calcRemaining(endDate));

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(calcRemaining(endDate));
    }, 60000); // Only update every minute to avoid rendering jitter
    return () => clearInterval(interval);
  }, [endDate]);

  return (
    <span style={{ color: 'var(--season-accent)', fontWeight: 500 }}>
      {remaining.days}d {remaining.hours}h {remaining.minutes}m
    </span>
  );
}
