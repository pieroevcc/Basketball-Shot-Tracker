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

  // All team members
  const teamMembers = myTeamId
    ? participants.filter((p) => p.teamId === myTeamId)
    : [];

  // All team activity shots from this team
  const teamShots = shots.filter(
    (s) =>
      s.activity === 'team' &&
      teamMembers.some((m) => m.studentId === s.studentId)
  );

  // Opponent team shots for comparison
  const opponentMembers = participants.filter(
    (p) => p.teamId !== null && p.teamId !== myTeamId
  );
  const opponentShots = shots.filter(
    (s) =>
      s.activity === 'team' &&
      opponentMembers.some((m) => m.studentId === s.studentId)
  );

  const stats = calculateStats(teamShots);
  const opponentStats = calculateStats(opponentShots);

  const teamName = teamMembers.map((m) => m.name).join(' + ');

  return (
    <div className="team-review">
      <div className="team-review-header">
        <div className="team-review-trophy">🏆</div>
        <h1 className="team-review-title">Team Results</h1>
        <p className="team-review-subtitle">{teamName}</p>
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
        <div className="review-summary-card" style={{ background: '#f39c12' }}>
          <span className="summary-number">{stats.totalPoints}</span>
          <span className="summary-label">Team Points</span>
        </div>
      </div>

      {/* Score comparison */}
      <div className="team-review-comparison">
        <div className="comparison-team">
          <span className="comparison-label">Your Team</span>
          <span className="comparison-score">{stats.totalPoints} pts</span>
        </div>
        <div className="comparison-vs">vs</div>
        <div className="comparison-team">
          <span className="comparison-label">Opponent</span>
          <span className="comparison-score">{opponentStats.totalPoints} pts</span>
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
        {teamMembers.map((member, i) => {
          const memberShots = teamShots.filter((s) => s.studentId === member.studentId);
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
  );
};

export default TeamReview;
