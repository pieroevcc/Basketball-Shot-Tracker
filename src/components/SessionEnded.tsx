import React, { useState, useEffect } from 'react';
import { Shot, Participant, Session, calculateStats, calculateScore } from '../types';
import CourtHeatmap from './CourtHeatmap';
import StatsDisplay from './StatsDisplay';
import './SessionEnded.css';

interface SessionEndedProps {
  role: 'student' | 'teacher';
  shots: Shot[];
  participants: Participant[];
  sessionCode: string;
  session?: Session;
  onReturnHome: () => void;
}

const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSe86_wurZ-wqFbSnLn37tnQlIvttJcHv3gXQcsqV93Cce1flw/viewform';

const SessionEnded: React.FC<SessionEndedProps> = ({
  role,
  shots,
  participants,
  sessionCode,
  session,
  onReturnHome,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'teams' | 'leaderboard'>('overview');
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [showFeedbackPopup, setShowFeedbackPopup] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowFeedbackPopup(true), 3000);
    return () => clearTimeout(t);
  }, []);
  // Round 1 leaderboard
  const leaderboard = [...participants]
    .map((p) => {
      const soloShots = shots.filter(
        (s) => s.studentId === p.studentId && s.activity === 'solo'
      );
      return {
        ...p,
        score: p.round1Score ?? calculateScore(soloShots),
      };
    })
    .sort((a, b) => b.score - a.score);

  const feedbackPopup = showFeedbackPopup && role === 'student' && (
    <div className="feedback-popup-overlay">
      <div className="feedback-popup-card">
        <h2 className="feedback-popup-title">Rate the App! 🏀</h2>
        <p className="feedback-popup-body">
          Got 2 minutes? Your feedback helps improve this app for future classes.
        </p>
        <a
          href={GOOGLE_FORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="feedback-popup-link"
        >
          Open Feedback Form
        </a>
        <button
          className="feedback-popup-close"
          onClick={() => setShowFeedbackPopup(false)}
        >
          Maybe Later
        </button>
      </div>
    </div>
  );

  if (role === 'student') {
    return (
      <>
        <div className="session-ended student">
          <div className="ended-card">
            <div className="ended-trophy">🏆</div>
            <h1 className="ended-title">Great work today!</h1>
            <p className="ended-subtitle">The session is over. You crushed it! 🎉</p>

            {leaderboard.length > 0 && (
              <div className="ended-leaderboard-mini">
                <h3>Solo Round Leaderboard</h3>
                {leaderboard.map((p, i) => (
                  <div key={p.studentId} className="leaderboard-row">
                    <span className="leaderboard-rank">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                    </span>
                    <span className="leaderboard-name">{p.name}</span>
                    <span className="leaderboard-score">{p.score} pts</span>
                  </div>
                ))}
              </div>
            )}

            <button className="btn-return-home" onClick={onReturnHome}>
              Return to Home
            </button>
          </div>
        </div>
        {feedbackPopup}
      </>
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
    <div className="stats-dropdown-wrapper">
      <label className="stats-dropdown-label">View student:</label>
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
    </div>
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

  // Find team winner
  const teamScores = Object.entries(teamMap)
    .filter(([key]) => key !== '__unmatched__')
    .map(([teamId, { shots: tShots }]) => ({
      teamId,
      score: calculateScore(tShots),
    }))
    .sort((a, b) => b.score - a.score);

  const winningTeamId = teamScores.length > 0 ? teamScores[0].teamId : null;

  return (
    <>
    <div className="session-ended teacher">
      <div className="ended-teacher-header">
        <h1 className="ended-teacher-title">Session Complete!</h1>
        <p className="ended-teacher-code">Code: {sessionCode}</p>
        <div className="ended-teacher-actions">
          <button className="btn-return-home small" onClick={onReturnHome}>
            End & Return Home
          </button>
        </div>
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
        <button
          className={`ended-tab ${activeTab === 'leaderboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('leaderboard')}
        >
          Leaderboard
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="ended-panel">
          <div className="ended-overview-layout">
            <div className="ended-heatmap-wrapper">
              <CourtHeatmap shots={filteredShots} stats={filteredStats} />
            </div>
            <div className="ended-stats-wrapper">
              {renderDropdown()}
              <StatsDisplay stats={filteredStats} />
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
              .map(([teamId, { shots: tShots }]) => {
                const tStats = calculateStats(tShots);
                const teamName = session?.teamNames?.[teamId] ?? teamId.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                const isWinner = teamId === winningTeamId;
                return (
                  <div key={teamId} className={`ended-team-card ${isWinner ? 'winner' : ''}`}>
                    {isWinner && <div className="winner-badge">🏆 Winner!</div>}
                    <h3 className="ended-team-name">{teamName}</h3>
                    <div className="ended-team-summary">
                      <span>{tShots.length} shots</span>
                      <span>{tStats.totalMade} made</span>
                      <span>{tStats.shootingPercentage.toFixed(0)}%</span>
                      <span><strong>{tStats.totalPoints} pts</strong></span>
                      <span>{tStats.pointsPerShot.toFixed(1)} pts/shot</span>
                    </div>
                    <CourtHeatmap shots={tShots} stats={tStats} />
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {activeTab === 'leaderboard' && (
        <div className="ended-panel">
          <h2 className="ended-panel-title">Solo Round Leaderboard</h2>
          <div className="ended-leaderboard">
            {leaderboard.map((p, i) => (
              <div
                key={p.studentId}
                className={`leaderboard-row ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}`}
              >
                <span className="leaderboard-rank">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                </span>
                <span className="leaderboard-name">{p.name}</span>
                <span className="leaderboard-score">{p.score} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
    {feedbackPopup}
    </>
  );
};

export default SessionEnded;
