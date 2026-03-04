import React from 'react';
import { Shot, Participant, calculateStats } from '../types';
import CourtHeatmap from './CourtHeatmap';
import StatsDisplay from './StatsDisplay';
import './TeamReview.css';

interface TeamReviewProps {
  shots: Shot[];
  myParticipant: Participant | null;
  participants: Participant[];
  studentId: string;
}

const TeamReview: React.FC<TeamReviewProps> = ({
  shots,
  myParticipant,
  participants,
  studentId,
}) => {
  const myTeamId = myParticipant?.teamId ?? null;
  const teammate = myTeamId
    ? participants.find(
        (p) => p.teamId === myTeamId && p.studentId !== studentId
      )
    : null;

  const teammateId = teammate?.studentId ?? null;

  // All team activity shots from this pair
  const teamShots = shots.filter(
    (s) =>
      s.activity === 'team' &&
      (s.studentId === studentId || s.studentId === teammateId)
  );

  const stats = calculateStats(teamShots);
  const myName = myParticipant?.name ?? 'You';
  const teammateName = teammate?.name ?? 'Teammate';

  const myTeamShots = teamShots.filter((s) => s.studentId === studentId);
  const teammateTeamShots = teamShots.filter((s) => s.studentId === teammateId);

  return (
    <div className="team-review">
      <div className="team-review-header">
        <div className="team-review-trophy">🏆</div>
        <h1 className="team-review-title">
          Team — {myName} + {teammateName}
        </h1>
        <p className="team-review-subtitle">Here's how your team did together!</p>
      </div>

      <div className="team-review-summary-cards">
        <div className="review-summary-card orange">
          <span className="summary-number">{teamShots.length}</span>
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
      </div>

      <div className="team-review-main">
        <div className="team-review-heatmap-panel">
          <h2 className="review-panel-title">Team Heatmap</h2>
          <CourtHeatmap shots={teamShots} stats={stats} />
        </div>

        <div className="team-review-stats-panel">
          <StatsDisplay stats={stats} />
        </div>
      </div>

      <div className="team-review-individual">
        <div className="individual-card">
          <h3 className="individual-name">{myName}</h3>
          <span className="individual-stat">{myTeamShots.length} shots</span>
          <span className="individual-stat">
            {myTeamShots.filter((s) => s.made).length} made
          </span>
        </div>
        <div className="individual-plus">+</div>
        <div className="individual-card">
          <h3 className="individual-name">{teammateName}</h3>
          <span className="individual-stat">{teammateTeamShots.length} shots</span>
          <span className="individual-stat">
            {teammateTeamShots.filter((s) => s.made).length} made
          </span>
        </div>
      </div>
    </div>
  );
};

export default TeamReview;
