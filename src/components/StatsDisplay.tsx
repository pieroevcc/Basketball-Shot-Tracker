import React, { useState } from 'react';
import { Stats, ZONE_POINTS, Shot, Participant, calculateStats } from '../types';
import './StatsDisplay.css';

interface StatsDisplayProps {
  stats: Stats;
  shots?: Shot[];
  participants?: Participant[];
  hidePtsPerShot?: boolean;
}

const ZONE_ORDER = [
  'Zone 1: Paint',
  'Zone 2: Left Mid-Range',
  'Zone 3: Right Mid-Range',
  'Zone 4: Left Outside',
  'Zone 5: Top of Key',
  'Zone 6: Right Outside',
];

function getBarColor(pct: number): string {
  if (pct > 69) return '#4ade80'; // green
  if (pct >= 30) return '#facc15'; // yellow
  return '#f87171'; // red
}

function getStrategicTip(_stats: Stats): string {
  return "Compare your Points Per Shot across zones — a 3-pointer only needs 34% accuracy to equal a 2-pointer at 51%. Where should you shoot more?";
}

const StatsDisplay: React.FC<StatsDisplayProps> = ({ stats, shots, participants, hidePtsPerShot }) => {
  const [selectedUserId, setSelectedUserId] = useState<string>('all');

  let activeStats = stats;
  if (selectedUserId !== 'all' && shots && shots.some(s => s.studentId === selectedUserId)) {
    activeStats = calculateStats(shots.filter(s => s.studentId === selectedUserId));
  }

  const tip = getStrategicTip(activeStats);

  const uniqueIds = Array.from(new Set((shots || []).map(s => s.studentId).filter(Boolean))) as string[];
  const hasRealPlayers = uniqueIds.length > 0 && participants && participants.length > 0;

  const displayOptions = hasRealPlayers
    ? uniqueIds.map(id => {
        const p = participants!.find(x => x.studentId === id);
        return { value: id, label: p ? `${p.name.toUpperCase()} STATS` : `STUDENT ${id}` };
      })
    : [
        { value: 'dummy1', label: "MICHAEL JORDAN'S STATS" },
        { value: 'dummy2', label: "STEPH CURRY'S STATS" },
      ];

  return (
    <div className="stats-container">
      {hasRealPlayers && (
        <div className="overall-stats-header">
          <select
            className="stats-dropdown"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
          >
            <option value="all">WHOLE CLASS / OVERALL</option>
            {displayOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      )}
      <div className="overall-stats-row">
        <div className="overall-stat-cell card-orange">
          <div className="overall-stat-label">TOTAL SHOTS</div>
          <div className="overall-stat-value">{activeStats.totalShots}</div>
        </div>
        <div className="overall-stat-cell card-green">
          <div className="overall-stat-label">MADE</div>
          <div className="overall-stat-value">{activeStats.totalMade}</div>
        </div>
        <div className="overall-stat-cell card-blue">
          <div className="overall-stat-label">SHOT %</div>
          <div className="overall-stat-value">{activeStats.shootingPercentage.toFixed(1)}%</div>
        </div>
        {!hidePtsPerShot && (
          <div className="overall-stat-cell card-pink">
            <div className="overall-stat-label">PTS / SHOT</div>
            <div className="overall-stat-value">{activeStats.totalShots > 0 ? (activeStats.totalPoints / activeStats.totalShots).toFixed(1) : '0.0'}</div>
          </div>
        )}
      </div>

      <div className="zone-breakdown-label">ZONE BREAKDOWN</div>
      <div className="zone-list">
        {ZONE_ORDER.map((zone) => {
          const data = activeStats.byZone[zone];
          const pct = data?.percentage ?? 0;
          const total = data?.total ?? 0;
          const made = data?.made ?? 0;
          const pts = data?.points ?? 0;
          const barColor = getBarColor(pct);

          return (
            <div key={zone} className="zone-row">
              <div className="zone-row-top">
                <span className="zone-row-name">
                  {zone} <span className="zone-row-pts">({ZONE_POINTS[zone]}pt)</span>
                </span>
                <span className="zone-row-right">
                  {!hidePtsPerShot && (
                    <span className="zone-row-score" style={{ color: '#f472b6' }}>
                      {total > 0 ? (pts / total).toFixed(1) : '0.0'} pts/shot
                    </span>
                  )}
                  <span className="zone-row-made">{made}/{total}</span>
                  <span className="zone-row-pct">- {pct.toFixed(0)}%</span>
                </span>
              </div>
              <div className="zone-bar-track">
                <div
                  className="zone-bar-fill"
                  style={{
                    width: total > 0 ? `${pct}%` : '0%',
                    backgroundColor: barColor,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="strategy-box">
        <div className="strategy-label">🧠 Strategic Thinking</div>
        <div className="strategy-text">{tip}</div>
      </div>
    </div>
  );
};

export default StatsDisplay;
