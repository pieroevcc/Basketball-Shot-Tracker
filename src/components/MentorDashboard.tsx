import React, { useState } from 'react';
import StatsDisplay from './StatsDisplay';
import ShotHistory from './ShotHistory';
import CourtHeatmap from './CourtHeatmap';
import { Shot, Stats } from '../types';
import './MentorDashboard.css';

interface MentorDashboardProps {
  shots: Shot[];
  stats: Stats;
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
            <div className="summary-cards">
              <div className="summary-card">
                <span className="card-value">{stats.totalShots}</span>
                <span className="card-label">Total Shots</span>
              </div>
              <div className="summary-card">
                <span className="card-value">
                  {stats.totalShots > 0 ? `${stats.shootingPercentage.toFixed(1)}%` : '—'}
                </span>
                <span className="card-label">Make Rate</span>
              </div>
              <div className="summary-card made">
                <span className="card-value">{stats.totalMade}</span>
                <span className="card-label">Made</span>
              </div>
              <div className="summary-card missed">
                <span className="card-value">{stats.totalShots - stats.totalMade}</span>
                <span className="card-label">Missed</span>
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
          </div>
        )}

        {activeTab === 'court' && (
          <div className="centered-tab"><CourtHeatmap shots={shots} stats={stats} /></div>
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