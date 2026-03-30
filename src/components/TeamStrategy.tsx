import React from 'react';
import { Shot, Participant, calculateStats } from '../types';
import CourtHeatmap from './CourtHeatmap';
import './TeamStrategy.css';

interface TeamStrategyProps {
  shots: Shot[];
  teammateShots: Shot[];
  myParticipant: Participant | null;
  participants: Participant[];
  studentId: string;
}

const TeamStrategy: React.FC<TeamStrategyProps> = ({
  shots,
  myParticipant,
  participants,
  studentId,
}) => {
  const myTeamId = myParticipant?.teamId;

  // My team members
  const myTeamMembers = myTeamId
    ? participants.filter((p) => p.teamId === myTeamId)
    : [];

  // Opponent team members
  const opponentMembers = participants.filter(
    (p) => p.teamId !== null && p.teamId !== myTeamId
  );
  const opponentTeamId = opponentMembers.length > 0 ? opponentMembers[0].teamId : null;

  // Aggregate solo shots for my team
  const myTeamSoloShots = shots.filter(
    (s) =>
      s.activity === 'solo' &&
      myTeamMembers.some((m) => m.studentId === s.studentId)
  );

  // Aggregate solo shots for opponent team
  const opponentSoloShots = shots.filter(
    (s) =>
      s.activity === 'solo' &&
      opponentMembers.some((m) => m.studentId === s.studentId)
  );

  const myTeamStats = calculateStats(myTeamSoloShots);
  const opponentStats = calculateStats(opponentSoloShots);

  // My personal solo shots
  const mySoloShots = shots.filter(
    (s) => s.studentId === studentId && s.activity === 'solo'
  );
  const myStats = calculateStats(mySoloShots);

  return (
    <div className="team-strategy">
      <div className="strategy-header">
        <h1 className="strategy-title">Team Strategy 🤝</h1>
        <p className="strategy-prompt">
          Compare your team's stats with the opponent. Plan your strategy!
        </p>
        <div className="strategy-teammate-badge">
          Your team: <strong>{myTeamMembers.map((m) => m.name).join(', ')}</strong>
        </div>
      </div>

      <div className="strategy-courts">
        <div className="strategy-court-panel">
          <h2 className="strategy-court-title">
            Your Team ({myTeamId?.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase())})
          </h2>
          <CourtHeatmap shots={myTeamSoloShots} stats={myTeamStats} />
          <div className="strategy-court-summary">
            <span>{myTeamSoloShots.length} shots</span>
            <span>{myTeamStats.totalPoints} pts</span>
            <span>{myTeamStats.shootingPercentage.toFixed(0)}%</span>
          </div>
          <div className="strategy-members">
            {myTeamMembers.map((m) => (
              <span key={m.studentId} className="strategy-member-chip">
                {m.name}: {m.round1Score ?? 0} pts
              </span>
            ))}
          </div>
        </div>

        <div className="strategy-vs">VS</div>

        <div className="strategy-court-panel">
          <h2 className="strategy-court-title">
            Opponent ({opponentTeamId?.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) ?? 'TBD'})
          </h2>
          <CourtHeatmap shots={opponentSoloShots} stats={opponentStats} />
          <div className="strategy-court-summary">
            <span>{opponentSoloShots.length} shots</span>
            <span>{opponentStats.totalPoints} pts</span>
            <span>{opponentStats.shootingPercentage.toFixed(0)}%</span>
          </div>
          <div className="strategy-members">
            {opponentMembers.map((m) => (
              <span key={m.studentId} className="strategy-member-chip">
                {m.name}: {m.round1Score ?? 0} pts
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Personal heatmap */}
      <div className="strategy-personal">
        <h2 className="strategy-court-title">Your Personal Round 1</h2>
        <div className="strategy-court-summary">
          <span>{mySoloShots.length} shots</span>
          <span>{myStats.totalPoints} pts</span>
          <span>{myStats.shootingPercentage.toFixed(0)}%</span>
        </div>
      </div>

      <div className="strategy-tip">
        <div className="strategy-tip-icon">💡</div>
        <div className="strategy-tip-text">
          Where are each team's strong zones? Where are they weak?
          Plan your shot allocation and sabotage strategy!
        </div>
      </div>
    </div>
  );
};

export default TeamStrategy;
