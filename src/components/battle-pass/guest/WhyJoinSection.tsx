import React from 'react';
import { Flame, CheckCircle, Clock, Zap } from 'lucide-react';

export default function WhyJoinSection({ season }: { season: any }) {
  if (!season) return null;

  return (
    <div style={{ background: '#0F2347', padding: '28px 24px', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
      <h2 className="text-base font-medium text-white mb-1">
        Why join the {season.shortName}?
      </h2>
      <p className="text-xs text-white/40 mb-5">
        Not a grind. Not a paywall. Just a gamer doing gamer things — and getting rewarded for it.
      </p>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Habit Card */}
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: 'rgba(83,74,183,0.2)' }}>
            <CheckCircle className="w-4 h-4 text-[#EEEDFE]" />
          </div>
          <h3 className="text-[13px] font-medium text-white mb-1.5">Your daily routine = XP</h3>
          <p className="text-[11px] text-white/45 leading-[1.6]">
            Already reading gaming news? Watching esports? That's XP.{' '}
            <span style={{ color: 'var(--season-accent)', fontWeight: 500 }}>You don't change your habits</span> 
            {' '}— the Battle Pass rewards the ones you already have.
          </p>
        </div>

        {/* FOMO Card */}
        <div className="rounded-xl p-4" style={{ 
          background: 'rgba(255,255,255,0.04)', 
          border: '0.5px solid color-mix(in srgb, var(--season-primary) 30%, transparent)' 
        }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: 'color-mix(in srgb, var(--season-primary) 15%, transparent)' }}>
            <Clock className="w-4 h-4" style={{ color: 'var(--season-primary)' }} />
          </div>
          <h3 className="text-[13px] font-medium text-white mb-1.5">Season {season.number} is a one-time event</h3>
          <p className="text-[11px] text-white/45 leading-[1.6]">
            These rewards{' '}
            <span style={{ color: 'var(--season-accent)', fontWeight: 500 }}>never come back</span>. 
            The Ember badges, the founder titles, the Season 1 frame — once this season ends, they're gone. Forever. Be here for the origin.
          </p>
        </div>

        {/* Free Card */}
        <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: 'rgba(16,185,129,0.12)' }}>
            <Zap className="w-4 h-4 text-[#6EE7B7]" />
          </div>
          <h3 className="text-[13px] font-medium text-white mb-1.5">100% free — no catch</h3>
          <p className="text-[11px] text-white/45 leading-[1.6]">
            No premium tier. No V-Bucks. No subscription. The{' '}
            <span style={{ color: 'var(--season-accent)', fontWeight: 500 }}>entire track is free</span>. 
            Sign up, earn XP, unlock rewards. That's it. No wallet required.
          </p>
        </div>
      </div>

      {/* Streak Multiplier Callout */}
      <div className="flex items-center gap-3 mt-3 rounded-[10px] p-3 px-4" style={{
        background: 'color-mix(in srgb, var(--season-primary) 8%, transparent)',
        border: '0.5px solid color-mix(in srgb, var(--season-primary) 20%, transparent)'
      }}>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{
          background: 'color-mix(in srgb, var(--season-primary) 15%, transparent)'
        }}>
          <Flame className="w-4 h-4" style={{ color: 'var(--season-primary)' }} />
        </div>
        <p className="text-[12px] text-white/70 leading-[1.5]">
          <strong style={{ color: 'var(--season-primary)' }}>Streak bonus:</strong> Log in {season.streakThresholdDays} days in a row and every article you read earns <strong style={{ color: 'var(--season-primary)' }}>{season.streakMultiplier}× XP</strong> for the rest of the week. Keep your streak alive — let the {season.shortName} burn.
        </p>
      </div>
    </div>
  );
}
