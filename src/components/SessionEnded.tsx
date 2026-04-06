import React, { useState } from 'react';
import { Shot, Participant, calculateStats } from '../types';
import CourtHeatmap from './CourtHeatmap';
import StatsDisplay from './StatsDisplay';
import './SessionEnded.css';

interface SessionEndedProps {
  role: 'student' | 'teacher';
  shots: Shot[];
  participants: Participant[];
  sessionCode: string;
  onReturnHome: () => void;
}

const SessionEnded: React.FC<SessionEndedProps> = ({
  role,
  shots,
  participants,
  sessionCode,
  onReturnHome,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'teams'>('overview');
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  if (role === 'student') {
    return (
      <div className="session-ended student">
        <div className="ended-card">
          <div className="ended-trophy">🏆</div>
          <h1 className="ended-title">Great work today!</h1>
          <p className="ended-subtitle">The session is over. You crushed it! 🎉</p>
          <button className="btn-return-home" onClick={onReturnHome}>
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  // Teacher view
  const allShots = shots;
  
  // Pre-calculate participant stats to find best and worst
  const participantStats = participants.map((p) => {
    const pShots = allShots.filter((s) => s.studentId === p.studentId);
    const pStats = calculateStats(pShots);
    return { ...p, stats: pStats, shotsCount: pShots.length };
  });

  const sortedByPct = [...participantStats]
    .filter((p) => p.shotsCount > 0)
    .sort((a, b) => b.stats.shootingPercentage - a.stats.shootingPercentage);

  const bestId = sortedByPct.length > 0 ? sortedByPct[0].studentId : null;
  const worstId = sortedByPct.length > 0 ? sortedByPct[sortedByPct.length - 1].studentId : null;

  const filteredShots = selectedFilter === 'all' 
    ? allShots 
    : allShots.filter((s) => s.studentId === selectedFilter);

  const filteredStats = calculateStats(filteredShots);

  const renderDropdown = () => (
    <select 
      className="stats-dropdown" 
      value={selectedFilter} 
      onChange={(e) => setSelectedFilter(e.target.value)}
    >
      <option value="all">Whole Class</option>
      {participantStats.map((p) => {
        let label = p.name;
        if (p.shotsCount > 0) {
          if (p.studentId === bestId && p.studentId !== worstId) label += ' 🔥 (Best)';
          else if (p.studentId === worstId && p.studentId !== bestId) label += ' ❄️ (Worst)';
        }
        return <option key={p.studentId} value={p.studentId}>{label}</option>;
      })}
    </select>
  );

  // Build team groups
  const teamMap: Record<string, { members: Participant[]; shots: Shot[] }> = {};
  participants.forEach((p) => {
    const key = p.teamId ?? '__unmatched__';
    if (!teamMap[key]) teamMap[key] = { members: [], shots: [] };
    teamMap[key].members.push(p);
    teamMap[key].shots.push(
      ...allShots.filter((s) => s.studentId === p.studentId && s.activity === 'team')
    );
  });

  return (
    <div className="session-ended teacher">
      <div className="ended-teacher-header">
        <h1 className="ended-teacher-title">Session Complete!</h1>
        <p className="ended-teacher-code">Code: {sessionCode}</p>
        <button className="btn-return-home small" onClick={onReturnHome}>
          End & Return Home
        </button>
      </div>

      <div className="ended-tabs">
        <button
          className={`ended-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Student Stats
        </button>
        <button
          className={`ended-tab ${activeTab === 'teams' ? 'active' : ''}`}
          onClick={() => setActiveTab('teams')}
        >
          Team Results
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="ended-panel">
          <div className="ended-overview-layout">
            <div className="ended-heatmap-wrapper">
              <CourtHeatmap shots={filteredShots} stats={filteredStats} />
            </div>
            <div className="ended-stats-wrapper">
              <StatsDisplay stats={filteredStats} headerNode={renderDropdown()} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'teams' && (
        <div className="ended-panel">
          <h2 className="ended-panel-title">Team Results</h2>
          <div className="ended-teams-grid">
            {Object.entries(teamMap)
              .filter(([key]) => key !== '__unmatched__')
              .map(([teamId, { members, shots: tShots }]) => {
                const tStats = calculateStats(tShots);
                const names = members.map((m) => m.name).join(' + ');
                return (
                  <div key={teamId} className="ended-team-card">
                    <h3 className="ended-team-name">{names}</h3>
                    <div className="ended-team-summary">
                      <span>{tShots.length} shots</span>
                      <span>{tStats.totalMade} made</span>
                      <span>{tStats.shootingPercentage.toFixed(0)}%</span>
                    </div>
                    <CourtHeatmap shots={tShots} stats={tStats} />
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionEnded;
