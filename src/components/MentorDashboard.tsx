import React, { useState } from 'react';
import StatsDisplay from './StatsDisplay';
import ShotHistory from './ShotHistory';
import CourtHeatmap from './CourtHeatmap';
import { Shot, Stats } from '../types';
import './MentorDashboard.css';

interface MentorDashboardProps {
  shots: Shot[];
  stats: Stats;
  participants?: { studentId: string; name: string }[];
  onDelete: (id: string) => void;
  onClear: () => void;
}

function generateInsights(shots: Shot[], stats: Stats): string[] {
  if (shots.length === 0) {
    return ['No shots recorded yet. Have the student start a session to collect data.'];
  }

  const insights: string[] = [];

  if (shots.length < 10) {
    insights.push(
      `Only ${shots.length} shot${shots.length > 1 ? 's' : ''} recorded — encourage more reps for reliable analysis.`
    );
  }

  const pct = stats.shootingPercentage;
  if (pct >= 60) {
    insights.push(`Excellent overall shooting at ${pct.toFixed(1)}% — maintain and build on this.`);
  } else if (pct >= 45) {
    insights.push(`Solid shooting at ${pct.toFixed(1)}% — there is room to grow with focused practice.`);
  } else if (pct >= 30) {
    insights.push(`Shooting at ${pct.toFixed(1)}% — focus on form fundamentals before adding volume.`);
  } else if (shots.length >= 5) {
    insights.push(
      `Struggling at ${pct.toFixed(1)}% — consider drill-based practice in high-success zones first.`
    );
  }

  const zoneEntries = Object.entries(stats.byZone).filter(([, z]) => z.total >= 3);
  const strongZones = zoneEntries.filter(([, z]) => z.percentage >= 60);
  const weakZones = zoneEntries.filter(([, z]) => z.percentage < 35);

  strongZones.forEach(([zone, z]) => {
    insights.push(
      `${zone} is a confidence zone at ${z.percentage.toFixed(0)}% (${z.made}/${z.total}) — great spot for building rhythm.`
    );
  });

  weakZones.forEach(([zone, z]) => {
    insights.push(
      `${zone} needs work at ${z.percentage.toFixed(0)}% (${z.made}/${z.total}) — schedule targeted drills in this area.`
    );
  });

  if (shots.length >= 10) {
    const mid = Math.floor(shots.length / 2);
    const firstPct = (shots.slice(0, mid).filter((s) => s.made).length / mid) * 100;
    const secondPct =
      (shots.slice(mid).filter((s) => s.made).length / (shots.length - mid)) * 100;
    const diff = secondPct - firstPct;
    if (diff > 10) {
      insights.push(
        `Positive trend: shooting improved by ${diff.toFixed(0)}% over the second half of the session.`
      );
    } else if (diff < -10) {
      insights.push(
        `Fatigue may be a factor: accuracy dropped ${Math.abs(diff).toFixed(0)}% in the second half — consider rest intervals.`
      );
    }
  }

  const zoneScores = Object.entries(stats.byZone).map(([zone, z]) => {
    const ptsPerMake = (zone.includes('Outside') || zone.includes('Top of Key')) ? 3 : 2;
    return { zone, score: z.made * ptsPerMake };
  });
  if (zoneScores.length > 0) {
    const highestScoringZone = zoneScores.reduce((a, b) => a.score > b.score ? a : b);
    if (highestScoringZone.score > 0) {
      insights.push(`Different zones have different shot scores: ${highestScoringZone.zone} generated the most points (${highestScoringZone.score} pts).`);
    }
  }

  return insights;
}


const MentorDashboard: React.FC<MentorDashboardProps> = ({ shots, stats, onDelete, onClear }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'court' | 'stats' | 'history'>(
    'overview'
  );

  const insights = generateInsights(shots, stats);

  const zoneEntries = Object.entries(stats.byZone).filter(([, z]) => z.total > 0);
  const bestZone =
    zoneEntries.length > 0
      ? zoneEntries.reduce((a, b) => (a[1].percentage >= b[1].percentage ? a : b))
      : null;
  const worstZone =
    zoneEntries.length > 1
      ? zoneEntries.reduce((a, b) => (a[1].percentage <= b[1].percentage ? a : b))
      : null;

  const tabs = [
    { id: 'overview' as const, label: '📋 Overview' },
    { id: 'court' as const, label: '🏀 Court' },
    { id: 'stats' as const, label: '📊 Stats' },
    { id: 'history' as const, label: '📝 History' },
  ];

  const studentStats: Record<string, { made: number, total: number, score: number }> = {};
  shots.forEach(shot => {
    const sid = shot.studentId || 'Local Player';
    if (!studentStats[sid]) studentStats[sid] = { made: 0, total: 0, score: 0 };
    studentStats[sid].total += 1;
    if (shot.made) studentStats[sid].made += 1;
    studentStats[sid].score += (shot.made ? (shot.zone.includes('Outside') || shot.zone.includes('Top of Key') ? 3 : 2) : 0);
  });

  let topPlayerName = 'N/A';
  let topPlayerStats = { made: 0, total: 0, score: 0 };
  if (Object.keys(studentStats).length > 0) {
    const topSid = Object.keys(studentStats).reduce((a, b) => studentStats[a].score > studentStats[b].score ? a : b);
    topPlayerName = topSid === 'Local Player' ? 'Player 1' : `Player ${topSid.substring(0, 4)}`;
    topPlayerStats = studentStats[topSid];
  }

  let currentStreak = 0;
  for (let i = shots.length - 1; i >= 0; i--) {
    if (shots[i].made) currentStreak++;
    else break;
  }

  const renderSparkline = (shots: Shot[]) => {
    if (shots.length < 2) {
      return (
        <svg className="sparkline-svg" viewBox="-2 -2 104 44" preserveAspectRatio="none">
           <defs>
             <linearGradient id="gradient-blue" x1="0" x2="0" y1="0" y2="1">
               <stop offset="0%" stopColor="rgba(96, 165, 250, 0.4)" />
               <stop offset="100%" stopColor="rgba(96, 165, 250, 0)" />
             </linearGradient>
           </defs>
           <path d="M0,35 L20,25 L40,30 L60,15 L80,20 L100,5 L100,40 L0,40 Z" fill="url(#gradient-blue)"/>
           <path d="M0,35 L20,25 L40,30 L60,15 L80,20 L100,5" fill="none" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
           <circle cx="20" cy="25" r="2.5" fill="#fff" stroke="#60A5FA" strokeWidth="1.5" />
           <circle cx="40" cy="30" r="2.5" fill="#fff" stroke="#60A5FA" strokeWidth="1.5" />
           <circle cx="60" cy="15" r="2.5" fill="#fff" stroke="#60A5FA" strokeWidth="1.5" />
           <circle cx="80" cy="20" r="2.5" fill="#fff" stroke="#60A5FA" strokeWidth="1.5" />
           <circle cx="100" cy="5" r="2.5" fill="#fff" stroke="#60A5FA" strokeWidth="1.5" />
         </svg>
      );
    }

    const numPoints = Math.min(6, shots.length);
    const points: {x: number, y: number}[] = [];

    for (let i = 0; i < numPoints; i++) {
      const sliceEnd = Math.floor(((i + 1) / numPoints) * shots.length);
      const chunkOptions = shots.slice(0, sliceEnd);
      const makes = chunkOptions.filter(s => s.made).length;
      const rate = makes / chunkOptions.length;
      points.push({
        x: (i / (numPoints - 1)) * 100,
        y: 35 - (rate * 30),
      });
    }

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const fillD = `${pathD} L100,40 L0,40 Z`;

    return (
      <svg className="sparkline-svg" viewBox="-2 -2 104 44" preserveAspectRatio="none">
        <defs>
          <linearGradient id="gradient-blue" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(96, 165, 250, 0.4)" />
            <stop offset="100%" stopColor="rgba(96, 165, 250, 0)" />
          </linearGradient>
        </defs>
        <path d={fillD} fill="url(#gradient-blue)"/>
        <path d={pathD} fill="none" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#fff" stroke="#60A5FA" strokeWidth="1.5" />
        ))}
      </svg>
    );
  };

  return (
    <div className="mentor-dashboard">
      <div className="mentor-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`mentor-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mentor-content">
        {activeTab === 'overview' && (
          <div className="overview-panel">

            <div className="top-stats-row">
              <div className="top-stat-card">
                <div className="top-stat-header">
                   <span className="top-stat-title">Top player: {topPlayerName}</span>
                </div>
                <div className="top-player-data">
                  <div className="tp-stat">
                    <span className="tp-label">MADE</span>
                    <span className="tp-val">{topPlayerStats.made}</span>
                  </div>
                  <div className="tp-stat">
                    <span className="tp-label">ATTEMPTS</span>
                    <span className="tp-val">{topPlayerStats.total}</span>
                  </div>
                  <div className="tp-stat">
                    <span className="tp-label">SCORE:</span>
                    <span className="tp-val text-yellow score-val">{topPlayerStats.score}</span>
                  </div>
                </div>
              </div>

              <div className="top-stat-card streak-card">
                <span className="top-stat-title">Recent Streak</span>
                <span className="streak-val">{currentStreak} Makes</span>
                <div className="streak-cont">
                  <div className="streak-bar-bg">
                    <div className="streak-bar-fill" style={{ width: `${Math.min(100, (currentStreak / 5) * 100)}%` }} />
                  </div>
                  <span className="streak-target">/ 5</span>
                </div>
              </div>
            </div>

            <div className="summary-cards four-cols">
              <div className="summary-card stat-standard">
                <span className="custom-card-value text-white">{stats.totalShots}</span>
                <span className="custom-card-title">TOTAL SHOTS</span>
              </div>
              <div className="summary-card stat-standard make-rate-card">
                <span className="custom-card-value text-white z-index-1">
                  {stats.totalShots > 0 ? <>{stats.shootingPercentage.toFixed(1)}% <span className="text-green">↑</span></> : '—'}
                </span>
                <span className="custom-card-title z-index-1">MAKE RATE</span>
                <div className="make-rate-graphic">
                  {renderSparkline(shots)}
                </div>
              </div>
              <div className="summary-card stat-standard made">
                <span className="custom-card-value text-white">{stats.totalMade} <span className="text-green">↑</span></span>
                <span className="custom-card-title">MADE</span>
              </div>
              <div className="summary-card stat-standard missed">
                <span className="custom-card-value text-white">{stats.totalShots - stats.totalMade} <span className="text-red">↓</span></span>
                <span className="custom-card-title">MISSED</span>
              </div>
            </div>

            {(bestZone || worstZone) && (
              <div className="zone-highlights">
                {bestZone && (
                  <div className="zone-highlight hot">
                    <span className="highlight-icon">🔥</span>
                    <div className="highlight-info">
                      <span className="highlight-label">Best Zone</span>
                      <span className="highlight-zone">{bestZone[0]}</span>
                      <span className="highlight-pct">
                        {bestZone[1].percentage.toFixed(0)}% ({bestZone[1].made}/
                        {bestZone[1].total})
                      </span>
                    </div>
                  </div>
                )}
                {worstZone && bestZone && worstZone[0] !== bestZone[0] && (
                  <div className="zone-highlight cold">
                    <span className="highlight-icon">🎯</span>
                    <div className="highlight-info">
                      <span className="highlight-label">Needs Work</span>
                      <span className="highlight-zone">{worstZone[0]}</span>
                      <span className="highlight-pct">
                        {worstZone[1].percentage.toFixed(0)}% ({worstZone[1].made}/
                        {worstZone[1].total})
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="insights-panel">
              <h3 className="panel-title">Coaching Insights</h3>
              <ul className="insights-list">
                {insights.map((insight, i) => (
                  <li key={i} className="insight-item">
                    {insight}
                  </li>
                ))}
              </ul>
            </div>

            {shots.length > 0 && (
              <div className="recent-activity">
                <h3 className="panel-title">Recent Activity</h3>
                <div className="activity-list">
                  {[...shots]
                    .slice(-5)
                    .reverse()
                    .map((shot) => (
                      <div
                        key={shot.id}
                        className={`activity-item ${shot.made ? 'made' : 'missed'}`}
                      >
                        <span className="activity-result">{shot.made ? '✅' : '❌'}</span>
                        <span className="activity-zone">{shot.zone}</span>
                        <span className="activity-player">👤 {shot.studentId ? `Player ${shot.studentId.substring(0,4)}` : 'Local Player'}</span>
                        <span className="activity-time">
                          {new Date(shot.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="session-summary-panel">
              <h3 className="panel-title">Session Summary</h3>
              <div className="session-summary-pills">
                <span className="summary-pill">🏀 Practice: 5 shots don't record</span>
                <span className="summary-pill">📝 Goal: 20 recorded shots</span>
              </div>
            </div>

          </div>
        )}

        {activeTab === 'court' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', alignItems: 'center' }}>
            <div className="summary-cards" style={{ width: '100%' }}>
              <div className="summary-card custom-card-shots">
                <span className="custom-card-title">SHOTS TAKEN</span>
                <span className="custom-card-value text-yellow">{stats.totalShots}</span>
                <span className="custom-card-sub">total attempts</span>
              </div>
              <div className="summary-card custom-card-points">
                <span className="custom-card-title">POINTS Per shot</span>
                <span className="custom-card-value text-red">
                  {stats.totalShots > 0 ? (shots.reduce((total, shot) => total + (shot.made ? (shot.zone.includes('Outside') || shot.zone.includes('Top of Key') ? 3 : 2) : 0), 0) / stats.totalShots).toFixed(1) : '0.0'}
                </span>
                <span className="custom-card-sub">Points / attempts</span>
              </div>
              <div className="summary-card custom-card-fg">
                <span className="custom-card-title">FIELD GOAL %</span>
                <span className="custom-card-value text-blue">
                  {stats.totalShots > 0 ? `${Math.round(stats.shootingPercentage)}%` : '0%'}
                </span>
                <span className="custom-card-sub">makes / attempts</span>
              </div>
            </div>
            <div className="centered-tab"><CourtHeatmap shots={shots} stats={stats} /></div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="centered-tab"><StatsDisplay stats={stats} /></div>
        )}
        {activeTab === 'history' && (
          <div className="centered-tab">
            <ShotHistory shots={shots} onDelete={onDelete} onClear={onClear} />
          </div>
        )}
      </div>
    </div>
  );
};

export default MentorDashboard;
