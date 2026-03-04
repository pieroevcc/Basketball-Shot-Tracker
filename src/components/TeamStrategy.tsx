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
  teammateShots,
  myParticipant,
  participants,
  studentId,
}) => {
  // My solo shots
  const mySoloShots = shots.filter(
    (s) => s.studentId === studentId && s.activity === 'solo'
  );

  // Teammate's solo shots
  const teammateSoloShots = teammateShots.filter((s) => s.activity === 'solo');

  // Find teammate participant record
  const myTeamId = myParticipant?.teamId;
  const teammate = myTeamId
    ? participants.find(
        (p) => p.teamId === myTeamId && p.studentId !== studentId
      )
    : null;

  const myStats = calculateStats(mySoloShots);
  const teammateStats = calculateStats(teammateSoloShots);

  return (
    <div className="team-strategy">
      <div className="strategy-header">
        <h1 className="strategy-title">Team Strategy 🤝</h1>
        <p className="strategy-prompt">
          Look at both heatmaps. 🔥 = hot zone, ❄️ = cold zone.{' '}
          <strong>Talk with your teammate!</strong>
        </p>
        {teammate && (
          <div className="strategy-teammate-badge">
            Your teammate: <strong>{teammate.name}</strong>
          </div>
        )}
      </div>

      <div className="strategy-courts">
        <div className="strategy-court-panel">
          <h2 className="strategy-court-title">
            {myParticipant?.name ?? 'You'} (Your shots)
          </h2>
          <CourtHeatmap shots={mySoloShots} stats={myStats} />
          <div className="strategy-court-summary">
            <span>{mySoloShots.length} shots</span>
            <span>{myStats.shootingPercentage.toFixed(0)}% overall</span>
          </div>
        </div>

        <div className="strategy-vs">VS</div>

        <div className="strategy-court-panel">
          <h2 className="strategy-court-title">
            {teammate?.name ?? 'Teammate'} (Their shots)
          </h2>
          <CourtHeatmap shots={teammateSoloShots} stats={teammateStats} />
          <div className="strategy-court-summary">
            <span>{teammateSoloShots.length} shots</span>
            <span>{teammateStats.shootingPercentage.toFixed(0)}% overall</span>
          </div>
        </div>
      </div>

      <div className="strategy-tip">
        <div className="strategy-tip-icon">💡</div>
        <div className="strategy-tip-text">
          Where are each of your strong zones? Where are you weak?{' '}
          Plan together so your team covers all parts of the court!
        </div>
      </div>
    </div>
  );
};

export default TeamStrategy;
