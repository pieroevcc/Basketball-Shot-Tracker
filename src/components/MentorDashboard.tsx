import React, { useState } from 'react';
import StatsDisplay from './StatsDisplay';
import ShotHistory from './ShotHistory';
import CourtHeatmap from './CourtHeatmap';
import { Shot, Stats, calculateStats } from '../types';
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
    return ['No shots recorded yet. Collect data to generate insights.'];
  }

  const insights: string[] = [];

  const mostEfficientZone = Object.entries(stats.byZone)
    .filter(([, z]) => z.total > 0)
    .sort((a, b) => b[1].pointsPerShot - a[1].pointsPerShot)[0];
  if (mostEfficientZone) {
    insights.push(`Different zones yield different shot scores — ${mostEfficientZone[0]} is highly efficient, generating ${mostEfficientZone[1].pointsPerShot.toFixed(1)} points per shot.`);
  }

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

  return insights;
}

function calculateRecentStreak(shots: Shot[]): string {
  if (shots.length === 0) return '0 Makes';
  const reversed = [...shots].reverse();
  const firstMade = reversed[0].made;
  let count = 0;
  for (const shot of reversed) {
    if (shot.made === firstMade) count++;
    else break;
  }
  return `${count} ${firstMade ? 'Makes' : 'Misses'}`;
}

const MentorDashboard: React.FC<MentorDashboardProps> = ({ shots, stats, participants, onDelete, onClear }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'court' | 'stats' | 'history'>('overview');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('all');

  let topPlayer = null;
  let topPlayerStats = null;
  if (participants && participants.length > 0 && shots.length > 0) {
    const bestDetails = participants.map(p => {
       const pShots = shots.filter(s => s.studentId === p.studentId);
       const pStats = calculateStats(pShots);
       return { p, stats: pStats };
    }).reduce((best, curr) => (curr.stats.totalPoints > best.stats.totalPoints ? curr : best), { p: participants[0], stats: calculateStats(shots.filter(s => s.studentId === participants[0].studentId)) });
    if (bestDetails.stats.totalShots > 0) {
      topPlayer = bestDetails.p;
      topPlayerStats = bestDetails.stats;
    }
  }

  const filteredShots = selectedStudentId === 'all' 
    ? shots 
    : shots.filter(s => s.studentId === selectedStudentId);
    
  const localStats = selectedStudentId === 'all' 
    ? stats 
    : calculateStats(filteredShots);

  const insights = generateInsights(filteredShots, localStats);

  const tabs = [
    { id: 'overview' as const, label: '📋 Overview' },
    { id: 'court' as const, label: '🏀 Court' },
    { id: 'stats' as const, label: '📊 Stats' },
    { id: 'history' as const, label: '📝 History' },
  ];

  return (
    <div className="mentor-dashboard">
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 24, flexWrap: 'wrap', maxWidth: 800, margin: '0 auto 24px' }}>
        <div style={{ background: 'rgba(255,255,255,0.1)', padding: 16, borderRadius: 12, textAlign: 'center', flex: '1 1 120px', border: '1px solid rgba(255,255,255,0.2)' }}>
          <div style={{ fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, color: '#aaa', marginBottom: 8 }}>Shots Taken</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#FFB84C' }}>{localStats.totalShots}</div>
          <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>total attempts</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.1)', padding: 16, borderRadius: 12, textAlign: 'center', flex: '1 1 120px', border: '1px solid rgba(255,255,255,0.2)' }}>
          <div style={{ fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, color: '#aaa', marginBottom: 8 }}>Points Per Shot</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#FF7F50' }}>{localStats.pointsPerShot.toFixed(1)}</div>
          <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>points/attempts</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.1)', padding: 16, borderRadius: 12, textAlign: 'center', flex: '1 1 120px', border: '1px solid rgba(255,255,255,0.2)' }}>
          <div style={{ fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, color: '#aaa', marginBottom: 8 }}>Field Goal %</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#00D1FF' }}>{localStats.shootingPercentage.toFixed(0)}%</div>
          <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>makes / attempts</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
        {topPlayer && topPlayerStats ? (
          <div style={{ border: '2px dashed rgba(255,255,255,0.4)', padding: '12px 20px', borderRadius: 12, background: 'rgba(0,0,0,0.2)', flex: '1 1 200px', maxWidth: 280 }}>
             <div style={{ fontSize: 12, color: '#aaa', textTransform: 'uppercase', marginBottom: 6 }}>
               Top Player: <strong style={{ color: '#fff' }}>{topPlayer.name}</strong>
             </div>
             <div style={{ fontSize: 16, color: '#FFB84C', fontWeight: 800 }}>
               Score: {topPlayerStats.totalPoints}
             </div>
             <div style={{ fontSize: 11, color: '#888', marginTop: 4, fontWeight: 'bold' }}>
               MADE {topPlayerStats.totalMade} / ATTEMPTS {topPlayerStats.totalShots}
             </div>
          </div>
        ) : <div style={{ flex: '1 1 200px', maxWidth: 280 }} />}

        <div className="mentor-tabs" style={{ marginBottom: 0, flex: '1 1 auto', justifyContent: 'center' }}>
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
        
        {/* Empty spacer spacer to balance out the top player box on large screens */}
        <div style={{ flex: '1 1 200px', maxWidth: 280 }} className="desktop-spacer" />
      </div>

      {participants && participants.length > 0 && (
        <div className="mentor-filter" style={{ textAlign: 'center', marginBottom: 20 }}>
          <select 
            value={selectedStudentId} 
            onChange={e => setSelectedStudentId(e.target.value)} 
            className="stats-dropdown"
          >
            <option value="all">All Students</option>
            {participants.map(p => (
              <option key={p.studentId} value={p.studentId}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="mentor-content">
        {activeTab === 'overview' && (
          <div className="overview-panel">
          
            {/* Recent Streak Card */}
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, border: '1px solid rgba(255,255,255,0.1)' }}>
               <div>
                  <div style={{ fontSize: 13, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 'bold' }}>Recent Streak</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#00D1FF', marginTop: 4 }}>{calculateRecentStreak(filteredShots)}</div>
               </div>
               <div style={{ background: 'rgba(0,255,0,0.15)', color: '#00ff00', padding: '6px 16px', borderRadius: 20, fontWeight: 'bold', border: '1px solid rgba(0,255,0,0.3)' }}>
                 🔥 Monitoring
               </div>
            </div>

            {/* Restored Summary Cards */}
            <div className="summary-cards">
              <div className="summary-card">
                <span className="card-value">{localStats.totalShots}</span>
                <span className="card-label">Total Shots</span>
              </div>
              <div className="summary-card">
                <span className="card-value">
                  {localStats.totalShots > 0 ? `${localStats.shootingPercentage.toFixed(1)}%` : '—'}
                </span>
                <span className="card-label">Make Rate</span>
              </div>
              <div className="summary-card made">
                <span className="card-value">{localStats.totalMade}</span>
                <span className="card-label">Made</span>
              </div>
              <div className="summary-card missed">
                <span className="card-value">{localStats.totalShots - localStats.totalMade}</span>
                <span className="card-label">Missed</span>
              </div>
            </div>

            {/* Restored Zone Highlights */}
            {(() => {
              const zoneEntries = Object.entries(localStats.byZone).filter(([, z]) => z.total > 0);
              const bestZone = zoneEntries.length > 0
                ? zoneEntries.reduce((a, b) => (a[1].percentage >= b[1].percentage ? a : b))
                : null;
              const worstZone = zoneEntries.length > 1
                ? zoneEntries.reduce((a, b) => (a[1].percentage <= b[1].percentage ? a : b))
                : null;

              if (!bestZone && !worstZone) return null;

              return (
                <div className="zone-highlights">
                  {bestZone && (
                    <div className="zone-highlight hot">
                      <span className="highlight-icon">🔥</span>
                      <div className="highlight-info">
                        <span className="highlight-label">Best Zone</span>
                        <span className="highlight-zone">{bestZone[0]}</span>
                        <span className="highlight-pct">
                          {bestZone[1].percentage.toFixed(0)}% ({bestZone[1].made}/{bestZone[1].total})
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
                          {worstZone[1].percentage.toFixed(0)}% ({worstZone[1].made}/{worstZone[1].total})
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

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

            {filteredShots.length > 0 && (
              <div className="recent-activity">
                <h3 className="panel-title">Recent Activity</h3>
                <div className="activity-list">
                  {[...filteredShots]
                    .slice(-10)
                    .reverse()
                    .map((shot) => {
                      const p = participants?.find(p => p.studentId === shot.studentId);
                      const zoneLabel = p ? `${p.name} - ${shot.zone}` : shot.zone;
                      return (
                        <div
                          key={shot.id}
                          className={`activity-item ${shot.made ? 'made' : 'missed'}`}
                        >
                          <span className="activity-result">{shot.made ? '✅' : '❌'}</span>
                          <span className="activity-zone">{zoneLabel}</span>
                          <span className="activity-time">
                            {new Date(shot.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <button className="delete-btn" onClick={() => onDelete(shot.id)} title="Delete Data Point">✕</button>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            <div className="historical-comparison" style={{ marginTop: '30px' }}>
              <h3 className="panel-title">Historical Comparison</h3>
              <p className="panel-subtitle" style={{ color: '#666', fontSize: 14, marginBottom: 15 }}>Individual vs Team Rounds</p>
              
              {(() => {
                 const soloShots = filteredShots.filter(s => s.activity === 'solo');
                 const teamShots = filteredShots.filter(s => s.activity === 'team');
                 const soloStats = calculateStats(soloShots);
                 const teamStats = calculateStats(teamShots);
                 
                 return (
                   <div style={{ display: 'flex', gap: 16 }}>
                     <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid #ddd', padding: 16, borderRadius: 12, textAlign: 'center' }}>
                       <h4 style={{ margin: '0 0 10px 0', color: '#1a1a2e' }}>Solo Play</h4>
                       <p style={{ margin: '5px 0' }}><strong>{soloStats.totalShots}</strong> Shots</p>
                       <p style={{ margin: '5px 0' }}><strong>{soloStats.shootingPercentage.toFixed(1)}%</strong> Accuracy</p>
                       <p style={{ margin: '5px 0' }}><strong>{soloStats.pointsPerShot.toFixed(1)}</strong> PTS/Shot</p>
                     </div>
                     <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid #ddd', padding: 16, borderRadius: 12, textAlign: 'center' }}>
                       <h4 style={{ margin: '0 0 10px 0', color: '#1a1a2e' }}>Team Play</h4>
                       <p style={{ margin: '5px 0' }}><strong>{teamStats.totalShots}</strong> Shots</p>
                       <p style={{ margin: '5px 0' }}><strong>{teamStats.shootingPercentage.toFixed(1)}%</strong> Accuracy</p>
                       <p style={{ margin: '5px 0' }}><strong>{teamStats.pointsPerShot.toFixed(1)}</strong> PTS/Shot</p>
                     </div>
                   </div>
                 );
              })()}
            </div>

            {/* Session Summary at the bottom */}
            <div style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.02) 100%)', borderRadius: 24, padding: 24, marginTop: 40, border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 10px 30px rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)', position: 'relative' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: 18, color: '#fff', textAlign: 'center' }}>Session Summary</h3>
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                <div style={{ background: 'rgba(255,107,53,0.15)', color: '#FF6B35', padding: '12px 24px', borderRadius: 12, fontWeight: 800, border: '1px solid rgba(255,107,53,0.3)', flex: '1 1 200px', textAlign: 'center' }}>
                   🎯 Practice 5 shots don't record
                </div>
                <div style={{ background: 'rgba(0,209,255,0.15)', color: '#00D1FF', padding: '12px 24px', borderRadius: 12, fontWeight: 800, border: '1px solid rgba(0,209,255,0.3)', flex: '1 1 200px', textAlign: 'center' }}>
                   🏆 Goal: 20 made shots
                </div>
              </div>
            </div>

          </div>
        )}

        {activeTab === 'court' && (
          <div className="centered-tab"><CourtHeatmap shots={filteredShots} stats={localStats} /></div>
        )}

        {activeTab === 'stats' && (
          <div className="centered-tab"><StatsDisplay stats={localStats} /></div>
        )}

        {activeTab === 'history' && (
          <div className="centered-tab">
            <ShotHistory shots={filteredShots} participants={participants} onDelete={onDelete} onClear={onClear} />
          </div>
        )}
      </div>
    </div>
  );
};

export default MentorDashboard;