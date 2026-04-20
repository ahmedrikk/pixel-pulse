import React from 'react';

// Mock data — in prod from /api/esports/leaderboard/predictions?period=week&limit=5
const MOCK_LEADERBOARD = [
  { userId: '1', username: 'ProPredictor', avatarInitials: 'PP', avatarColor: '#7C3AED', accuracy: 78, totalPredictions: 24, currentTier: 14 },
  { userId: '2', username: 'EsportsOracle', avatarInitials: 'EO', avatarColor: '#EA580C', accuracy: 71, totalPredictions: 31, currentTier: 11 },
  { userId: '3', username: 'xBettorGod', avatarInitials: 'XB', avatarColor: '#0891B2', accuracy: 68, totalPredictions: 19, currentTier: 9 },
  { userId: '4', username: 'NadeSaint', avatarInitials: 'NS', avatarColor: '#16A34A', accuracy: 65, totalPredictions: 27, currentTier: 12 },
  { userId: '5', username: 'ShiftAlert', avatarInitials: 'SA', avatarColor: '#DC2626', accuracy: 62, totalPredictions: 15, currentTier: 7 },
];

export function PredictorLeaderboard() {
  return (
    <div style={{
      background: 'hsl(var(--background))',
      borderTop: '0.5px solid hsl(var(--border))',
      padding: '12px 16px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 500 }}>Top predictors this week</span>
        <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))' }}>
          Ranked by accuracy · Predict more to climb
        </span>
      </div>

      {/* Horizontal scroll row */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' } as React.CSSProperties}>
        {MOCK_LEADERBOARD.map((entry, i) => {
          const isTop2 = i < 2;
          return (
            <div
              key={entry.userId}
              style={{
                minWidth: 118,
                background: 'hsl(var(--secondary))',
                borderRadius: 8,
                padding: '8px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                flexShrink: 0,
              }}
            >
              {/* Rank */}
              <span style={{ fontSize: 11, fontWeight: 500, color: isTop2 ? '#D97706' : 'hsl(var(--muted-foreground))', minWidth: 12 }}>
                {i + 1}
              </span>

              {/* Avatar */}
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: entry.avatarColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 500, color: '#fff', flexShrink: 0,
              }}>
                {entry.avatarInitials}
              </div>

              {/* Info */}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.username}
                </div>
                <div style={{ fontSize: 9, color: '#16A34A', fontWeight: 500 }}>{entry.accuracy}% acc</div>
                <div style={{ fontSize: 9, color: 'hsl(var(--muted-foreground))' }}>
                  T{entry.currentTier} · {entry.totalPredictions} picks
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
