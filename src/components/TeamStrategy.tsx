import React, { useState } from 'react';
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
}) => {
  const myTeamId = myParticipant?.teamId;

  const myTeamMembers = myTeamId
    ? participants.filter((p) => p.teamId === myTeamId)
    : [];

  const opponentMembers = participants.filter(
    (p) => p.teamId !== null && p.teamId !== myTeamId
  );
  const opponentTeamId = opponentMembers.length > 0 ? opponentMembers[0].teamId : null;

  const myTeamSoloShots = shots.filter(
    (s) => s.activity === 'solo' && myTeamMembers.some((m) => m.studentId === s.studentId)
  );
  const opponentSoloShots = shots.filter(
    (s) => s.activity === 'solo' && opponentMembers.some((m) => m.studentId === s.studentId)
  );

  const myTeamStats = calculateStats(myTeamSoloShots);
  const opponentStats = calculateStats(opponentSoloShots);

  // Individual player dropdown state
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');

  const allPlayers = [...myTeamMembers, ...opponentMembers];
  const selectedPlayer = allPlayers.find((p) => p.studentId === selectedPlayerId) ?? null;
  const selectedPlayerShots = selectedPlayer
    ? shots.filter((s) => s.studentId === selectedPlayer.studentId && s.activity === 'solo')
    : [];
  const selectedPlayerStats = calculateStats(selectedPlayerShots);
  const selectedIsOpponent = opponentMembers.some((p) => p.studentId === selectedPlayerId);

  const formatTeamId = (id: string | null | undefined) =>
    id?.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) ?? 'TBD';

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

      {/* Player dropdown */}
      <div className="strategy-player-select-wrapper">
        <label className="strategy-player-select-label">View individual player:</label>
        <select
          className="strategy-player-select"
          value={selectedPlayerId}
          onChange={(e) => setSelectedPlayerId(e.target.value)}
        >
          <option value="">— Team Overview —</option>
          <optgroup label={`Your Team (${formatTeamId(myTeamId)})`}>
            {myTeamMembers.map((p) => (
              <option key={p.studentId} value={p.studentId}>
                {p.name} · {p.round1Score ?? 0} pts
              </option>
            ))}
          </optgroup>
          <optgroup label={`Opponents (${formatTeamId(opponentTeamId)})`}>
            {opponentMembers.map((p) => (
              <option key={p.studentId} value={p.studentId}>
                {p.name} · {p.round1Score ?? 0} pts
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      {/* Individual view */}
      {selectedPlayer ? (
        <div className="strategy-individual-view">
          <div className="strategy-court-panel">
            <h2 className="strategy-court-title">
              {selectedPlayer.name}
              <span className={`strategy-team-tag ${selectedIsOpponent ? 'opponent' : 'my-team'}`}>
                {selectedIsOpponent ? 'Opponent' : 'Your Team'}
              </span>
            </h2>
            <CourtHeatmap shots={selectedPlayerShots} stats={selectedPlayerStats} />
            <div className="strategy-court-summary">
              <span>{selectedPlayerShots.length} shots</span>
              <span>{selectedPlayerStats.totalPoints} pts</span>
              <span>{selectedPlayerStats.shootingPercentage.toFixed(0)}%</span>
            </div>
          </div>
        </div>
      ) : (
        /* Team overview side-by-side */
        <div className="strategy-courts">
          <div className="strategy-court-panel">
            <h2 className="strategy-court-title">
              Your Team ({formatTeamId(myTeamId)})
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
                  {m.name}: {calculateStats(shots.filter(s => s.studentId === m.studentId && s.activity === 'solo')).totalPoints} pts
                </span>
              ))}
            </div>
          </div>

          <div className="strategy-vs">VS</div>

          <div className="strategy-court-panel">
            <h2 className="strategy-court-title">
              Opponent ({formatTeamId(opponentTeamId)})
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
                  {m.name}: {calculateStats(shots.filter(s => s.studentId === m.studentId && s.activity === 'solo')).totalPoints} pts
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

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
