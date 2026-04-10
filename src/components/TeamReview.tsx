import React, { useState, useEffect, useMemo } from 'react';
import { Shot, Participant, calculateStats } from '../types';
import CourtHeatmap from './CourtHeatmap';
import StatsDisplay from './StatsDisplay';
import './TeamReview.css';
import './FeedbackPopup.css';

interface TeamReviewProps {
  shots: Shot[];
  myParticipant: Participant | null;
  participants: Participant[];
  studentId: string;
  teamNames?: Record<string, string>;
  onLeaderboard?: () => void;
}

const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSe86_wurZ-wqFbSnLn37tnQlIvttJcHv3gXQcsqV93Cce1flw/viewform';

const TeamReview: React.FC<TeamReviewProps> = ({
  shots,
  myParticipant,
  participants,
  studentId,
  teamNames,
  onLeaderboard,
}) => {
  const [showFeedbackPopup, setShowFeedbackPopup] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowFeedbackPopup(true), 3000);
    return () => clearTimeout(t);
  }, []);

  const myTeamId = myParticipant?.teamId ?? null;

  // All distinct teams
  const allTeams = useMemo(() => {
    const seen = new Set<string>();
    const teams: { teamId: string; members: Participant[] }[] = [];
    for (const p of participants) {
      if (p.teamId && !seen.has(p.teamId)) {
        seen.add(p.teamId);
        teams.push({
          teamId: p.teamId,
          members: participants.filter((m) => m.teamId === p.teamId),
        });
      }
    }
    // Put my team first
    return teams.sort((a) => (a.teamId === myTeamId ? -1 : 1));
  }, [participants, myTeamId]);

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(myTeamId);

  // When myTeamId becomes available (after join), sync selection
  useEffect(() => {
    if (myTeamId && selectedTeamId === null) setSelectedTeamId(myTeamId);
  }, [myTeamId, selectedTeamId]);

  const viewingTeamId = selectedTeamId ?? myTeamId;

  const viewingMembers = useMemo(
    () => participants.filter((p) => p.teamId === viewingTeamId),
    [participants, viewingTeamId]
  );

  const viewingShots = useMemo(
    () =>
      shots.filter(
        (s) =>
          s.activity === 'team' &&
          viewingMembers.some((m) => m.studentId === s.studentId)
      ),
    [shots, viewingMembers]
  );

  const stats = calculateStats(viewingShots);

  // My own team stats for the score comparison (always shown relative to my team)
  const myTeamMembers = useMemo(
    () => participants.filter((p) => p.teamId === myTeamId),
    [participants, myTeamId]
  );
  const myTeamShots = useMemo(
    () =>
      shots.filter(
        (s) => s.activity === 'team' && myTeamMembers.some((m) => m.studentId === s.studentId)
      ),
    [shots, myTeamMembers]
  );
  const myTeamStats = calculateStats(myTeamShots);

  const opponentMembers = useMemo(
    () => participants.filter((p) => p.teamId !== null && p.teamId !== myTeamId),
    [participants, myTeamId]
  );
  const opponentShots = useMemo(
    () =>
      shots.filter(
        (s) => s.activity === 'team' && opponentMembers.some((m) => m.studentId === s.studentId)
      ),
    [shots, opponentMembers]
  );
  const opponentStats = calculateStats(opponentShots);

  const teamLabel = (teamId: string) => {
    const customName = teamNames?.[teamId];
    return customName ?? teamId.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const feedbackPopup = showFeedbackPopup && (
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

  return (
    <>
    <div className="team-review">
      <div className="team-review-header">
        <div className="team-review-trophy">🏆</div>
        <h1 className="team-review-title">Team Results</h1>
        <p className="team-review-subtitle">{teamLabel(viewingTeamId ?? '')}</p>
      </div>
      
      {onLeaderboard && (
        <div className="team-review-leaderboard-btn-wrapper">
          <button className="team-review-leaderboard-btn" onClick={onLeaderboard}>
            🏅 Leaderboard
          </button>
        </div>
      )}

      {/* Team selector dropdown */}
      {allTeams.length > 1 && (
        <div className="strategy-player-select-wrapper">
          <label className="strategy-player-select-label">View team:</label>
          <select
            className="strategy-player-select"
            value={viewingTeamId ?? ''}
            onChange={(e) => setSelectedTeamId(e.target.value)}
          >
            {allTeams.map(({ teamId }) => (
              <option key={teamId} value={teamId}>
                {teamLabel(teamId)}
                {teamId === myTeamId ? ' (Your Team)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="team-review-summary-cards">
        <div className="review-summary-card orange">
          <span className="summary-number">{viewingShots.length}</span>
          <span className="summary-label">Total Shots</span>
        </div>
        <div className="review-summary-card green">
          <span className="summary-number">{stats.totalMade}</span>
          <span className="summary-label">Made</span>
        </div>
        <div className="review-summary-card purple">
          <span className="summary-number">{stats.shootingPercentage.toFixed(0)}%</span>
          <span className="summary-label">Team %</span>
        </div>
        <div className="review-summary-card" style={{ background: '#f39c12' }}>
          <span className="summary-number">{stats.totalPoints}</span>
          <span className="summary-label">Team Points</span>
        </div>
      </div>

      {/* Score comparison (always your team vs opponent) */}
      <div className="team-review-comparison">
        <div className="comparison-team">
          <span className="comparison-label">Your Team </span>
          <span className="comparison-score">{myTeamStats.totalPoints} pts</span>
        </div>
        <div className="comparison-vs">vs</div>
        <div className="comparison-team">
          <span className="comparison-label">Opponent </span>
          <span className="comparison-score">{opponentStats.totalPoints} pts</span>
        </div>
      </div>

      <div className="team-review-main">
        <div className="team-review-heatmap-panel">
          <h2 className="review-panel-title">Team Heatmap</h2>
          <CourtHeatmap shots={viewingShots} stats={stats} />
        </div>

        <div className="team-review-stats-panel">
          <StatsDisplay stats={stats} />
        </div>
      </div>

      <div className="team-review-individual">
        {viewingMembers.map((member, i) => {
          const memberShots = viewingShots.filter((s) => s.studentId === member.studentId);
          const memberStats = calculateStats(memberShots);
          return (
            <React.Fragment key={member.studentId}>
              {i > 0 && <div className="individual-plus">+</div>}
              <div className="individual-card">
                <h3 className="individual-name">
                  {member.name}
                  {member.studentId === studentId && ' (You)'}
                </h3>
                <span className="individual-stat">{memberShots.length} shots</span>
                <span className="individual-stat">{memberStats.totalMade} made</span>
                <span className="individual-stat">{memberStats.totalPoints} pts</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

    </div>
    {feedbackPopup}
    </>
  );
};

export default TeamReview;
