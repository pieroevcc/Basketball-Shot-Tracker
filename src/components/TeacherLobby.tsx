import React from 'react';
import {
  Session,
  Participant,
  Shot,
  SessionStatus,
  ShotAllocation,
  SabotageAction,
  calculateStats,
  calculateScore,
} from '../types';
import { UseSessionReturn } from '../hooks/useSession';
import './TeacherLobby.css';

interface TeacherLobbyProps {
  session: Session;
  participants: Participant[];
  shots: Shot[];
  sessionCode: string;
  advanceSession: UseSessionReturn['advanceSession'];
  pairTeams: UseSessionReturn['pairTeams'];
  assignGroups: UseSessionReturn['assignGroups'];
  calculateRound1Winner: UseSessionReturn['calculateRound1Winner'];
  saveShotAllocations: UseSessionReturn['saveShotAllocations'];
  saveSabotageActions: UseSessionReturn['saveSabotageActions'];
  kickParticipant: UseSessionReturn['kickParticipant'];
  allocations: ShotAllocation[];
  sabotageActions: SabotageAction[];
  onReturnHome: () => void;
}

const MAX_SOLO_SHOTS = 20;
const MAX_TEAM_SHOTS = 20;
const MAX_PLAYERS = 16;

const TeacherLobby: React.FC<TeacherLobbyProps> = ({
  session,
  participants,
  shots,
  sessionCode,
  advanceSession,
  pairTeams,
  assignGroups,
  calculateRound1Winner,
  kickParticipant,
  allocations: _allocations,
  sabotageActions: _sabotageActions,
  onReturnHome,
}) => {
  const status: SessionStatus = session.status;

  const getSoloCount = (p: Participant) =>
    shots.filter((s) => s.studentId === p.studentId && s.activity === 'solo').length;

  const getSoloScore = (p: Participant) => {
    const soloShots = shots.filter((s) => s.studentId === p.studentId && s.activity === 'solo');
    return calculateScore(soloShots);
  };

  const getTeamCount = (p: Participant) =>
    shots.filter((s) => s.studentId === p.studentId && s.activity === 'team').length;

  const handleStartSolo = async () => {
    await assignGroups(sessionCode);
    await advanceSession(sessionCode, 'solo_active');
  };

  const handleEndSolo = async () => {
    await calculateRound1Winner(sessionCode);
    await advanceSession(sessionCode, 'solo_review');
  };

  const handleStartTeamStrategy = async () => {
    await pairTeams(sessionCode);
  };

  const handleStartShotAllocation = async () => {
    await advanceSession(sessionCode, 'shot_allocation');
  };

  const handleStartSabotage = async () => {
    await advanceSession(sessionCode, 'sabotage');
  };

  const handleStartTeamActive = async () => {
    await advanceSession(sessionCode, 'team_active');
  };

  const handleShowTeamResults = async () => {
    await advanceSession(sessionCode, 'team_review');
  };

  const handleEndSession = async () => {
    await advanceSession(sessionCode, 'ended');
  };

  // Group by team for team phases
  const teamMap: Record<string, Participant[]> = {};
  participants.forEach((p) => {
    const key = p.teamId ?? '__unmatched__';
    if (!teamMap[key]) teamMap[key] = [];
    teamMap[key].push(p);
  });

  // Group by Round 1 groups
  const groupMap: Record<string, Participant[]> = {};
  participants.forEach((p) => {
    const key = p.groupId ?? '__ungrouped__';
    if (!groupMap[key]) groupMap[key] = [];
    groupMap[key].push(p);
  });

  // Round 1 winner
  const round1Winner = session.round1Winner
    ? participants.find((p) => p.studentId === session.round1Winner)
    : null;

  return (
    <div className="teacher-lobby">
      {/* Always-visible code banner */}
      <div className="teacher-code-banner">
        <button className="teacher-back-btn" onClick={onReturnHome}>← Back</button>
        <span className="teacher-code-label">Session Code</span>
        <span className="teacher-code-value">{sessionCode}</span>
      </div>

      {/* ---- LOBBY ---- */}
      {status === 'lobby' && (
        <div className="teacher-section">
          <h2 className="teacher-section-title">
            Waiting Room
            <span className="participant-badge">{participants.length} joined</span>
            {participants.length > MAX_PLAYERS && (
              <span className="participant-badge" style={{ background: '#e74c3c' }}>
                Max {MAX_PLAYERS}!
              </span>
            )}
          </h2>

          <div className="teacher-participant-list">
            {participants.length === 0 ? (
              <p className="teacher-empty">No students yet — share the code above!</p>
            ) : (
              participants.map((p) => (
                <div key={p.studentId} className="teacher-participant-row">
                  <span className="participant-name">{p.name}</span>
                  <div className="participant-actions">
                    <span className="participant-joined">Joined</span>
                    <button 
                      className="kick-btn" 
                      onClick={() => kickParticipant(sessionCode, p.studentId)}
                      title="Kick student"
                    >
                      ❌
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <button
            className="teacher-action-btn primary"
            onClick={handleStartSolo}
            disabled={participants.length < 1 || participants.length > MAX_PLAYERS}
          >
            {participants.length < 1
              ? `Need at least 1 student (${participants.length}/1)`
              : participants.length > MAX_PLAYERS
                ? `Too many players (${participants.length}/${MAX_PLAYERS})`
                : '▶ Start Round 1 (Solo)'}
          </button>
        </div>
      )}

      {/* ---- SOLO ACTIVE ---- */}
      {status === 'solo_active' && (
        <div className="teacher-section">
          <h2 className="teacher-section-title">Round 1: Solo Activity</h2>
          <p className="teacher-section-subtitle">
            Each student takes up to {MAX_SOLO_SHOTS} shots individually.
          </p>

          {/* Show groups of 4 */}
          {Object.entries(groupMap)
            .filter(([key]) => key !== '__ungrouped__')
            .map(([groupId, members]) => (
              <div key={groupId} className="teacher-team-card large" style={{ marginBottom: '1rem' }}>
                <span className="team-badge">{groupId.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                <table className="teacher-progress-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Shots</th>
                      <th>Score</th>
                      <th>Progress</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((p) => {
                      const count = getSoloCount(p);
                      const score = getSoloScore(p);
                      const pct = Math.min(100, (count / MAX_SOLO_SHOTS) * 100);
                      const done = count >= MAX_SOLO_SHOTS;
                      return (
                        <tr key={p.studentId}>
                          <td className="td-name">{p.name}</td>
                          <td className="td-shots">{count}/{MAX_SOLO_SHOTS}</td>
                          <td className="td-shots">{score} pts</td>
                          <td className="td-bar">
                            <div className="progress-bar-bg">
                              <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                            </div>
                          </td>
                          <td className="td-status">
                            {done ? <span className="status-done">Done ✅</span> : <span className="status-going">Shooting...</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}

          {/* Fallback if no groups assigned */}
          {!Object.keys(groupMap).some((k) => k !== '__ungrouped__') && (
            <table className="teacher-progress-table">
              <thead>
                <tr><th>Name</th><th>Shots</th><th>Score</th><th>Progress</th><th>Status</th></tr>
              </thead>
              <tbody>
                {participants.map((p) => {
                  const count = getSoloCount(p);
                  const score = getSoloScore(p);
                  const pct = Math.min(100, (count / MAX_SOLO_SHOTS) * 100);
                  const done = count >= MAX_SOLO_SHOTS;
                  return (
                    <tr key={p.studentId}>
                      <td className="td-name">{p.name}</td>
                      <td className="td-shots">{count}/{MAX_SOLO_SHOTS}</td>
                      <td className="td-shots">{score} pts</td>
                      <td className="td-bar">
                        <div className="progress-bar-bg">
                          <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                      <td className="td-status">
                        {done ? <span className="status-done">Done ✅</span> : <span className="status-going">Shooting...</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <button className="teacher-action-btn warning" onClick={handleEndSolo}>
            End Round 1 & Show Review
          </button>
        </div>
      )}

      {/* ---- SOLO REVIEW ---- */}
      {status === 'solo_review' && (
        <div className="teacher-section">
          <h2 className="teacher-section-title">Round 1 Review</h2>
          {round1Winner && (
            <div className="teacher-winner-banner">
              🏆 Round 1 Winner: <strong>{round1Winner.name}</strong> ({round1Winner.round1Score ?? 0} pts)
            </div>
          )}
          <p className="teacher-section-subtitle">
            Students are reviewing their solo heatmaps. When ready, form teams of 4!
          </p>

          <div className="teacher-participant-list">
            {[...participants]
              .sort((a, b) => (b.round1Score ?? 0) - (a.round1Score ?? 0))
              .map((p, i) => (
                <div key={p.studentId} className="teacher-participant-row">
                  <span className="participant-name">
                    {i + 1}. {p.name}
                  </span>
                  <span className="td-shots">
                    {p.round1Score ?? getSoloScore(p)} pts | {getSoloCount(p)} shots
                  </span>
                </div>
              ))}
          </div>

          <button className="teacher-action-btn primary" onClick={handleStartTeamStrategy}>
            Form Teams &amp; Start Strategy
          </button>
        </div>
      )}

      {/* ---- TEAM STRATEGY ---- */}
      {status === 'team_strategy' && (
        <div className="teacher-section">
          <h2 className="teacher-section-title">Team Strategy</h2>
          <p className="teacher-section-subtitle">
            Teams are reviewing aggregate stats. Current teams:
          </p>

          <div className="teacher-teams-list">
            {Object.entries(teamMap)
              .filter(([key]) => key !== '__unmatched__')
              .map(([teamId, members]) => {
                const teamShots = shots.filter(
                  (s) => members.some((m) => m.studentId === s.studentId) && s.activity === 'solo'
                );
                const teamStats = calculateStats(teamShots);
                return (
                  <div key={teamId} className="teacher-team-card">
                    <span className="team-badge">{teamId.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                    <span className="team-score">{teamStats.totalPoints} pts | {teamStats.shootingPercentage.toFixed(0)}%</span>
                    {members.map((m, i) => (
                      <React.Fragment key={m.studentId}>
                        <span className="team-member-name">{m.name}</span>
                        {i < members.length - 1 && <span className="vs-divider">+</span>}
                      </React.Fragment>
                    ))}
                  </div>
                );
              })}
          </div>

          <button className="teacher-action-btn primary" onClick={handleStartShotAllocation}>
            Start Shot Allocation
          </button>
        </div>
      )}

      {/* ---- SHOT ALLOCATION ---- */}
      {status === 'shot_allocation' && (
        <div className="teacher-section">
          <h2 className="teacher-section-title">Shot Allocation</h2>
          <p className="teacher-section-subtitle">
            Teams are distributing shots among their members.
          </p>

          <div className="teacher-teams-list">
            {Object.entries(teamMap)
              .filter(([key]) => key !== '__unmatched__')
              .map(([teamId, members]) => (
                <div key={teamId} className="teacher-team-card">
                  <span className="team-badge">{teamId.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                  {members.map((m) => (
                    <div key={m.studentId} className="team-member-row">
                      <span className="team-member-name">{m.name}</span>
                      <span className="td-shots">
                        {m.allocatedShots !== undefined ? `${m.allocatedShots} shots` : 'Pending...'}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
          </div>

          <button className="teacher-action-btn primary" onClick={handleStartSabotage}>
            Start Sabotage Round
          </button>
        </div>
      )}

      {/* ---- SABOTAGE ---- */}
      {status === 'sabotage' && (
        <div className="teacher-section">
          <h2 className="teacher-section-title">Sabotage Round 💣</h2>
          <p className="teacher-section-subtitle">
            Teams are choosing their sabotage actions.
          </p>

          <button className="teacher-action-btn primary" onClick={handleStartTeamActive}>
            Start Team Shooting
          </button>
        </div>
      )}

      {/* ---- TEAM ACTIVE ---- */}
      {status === 'team_active' && (
        <div className="teacher-section">
          <h2 className="teacher-section-title">Round 2: Team Activity</h2>
          <p className="teacher-section-subtitle">
            Teams are shooting with their allocated shots.
          </p>

          <div className="teacher-teams-list">
            {Object.entries(teamMap)
              .filter(([key]) => key !== '__unmatched__')
              .map(([teamId, members]) => {
                const teamShots = shots.filter(
                  (s) => members.some((m) => m.studentId === s.studentId) && s.activity === 'team'
                );
                const teamStats = calculateStats(teamShots);
                return (
                  <div key={teamId} className="teacher-team-card large">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span className="team-badge">{teamId.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                      <span className="team-score">{teamStats.totalPoints} pts</span>
                    </div>
                    {members.map((m) => {
                      const count = getTeamCount(m);
                      const maxShots = m.allocatedShots ?? MAX_TEAM_SHOTS;
                      const pct = Math.min(100, (count / maxShots) * 100);
                      const done = count >= maxShots;
                      return (
                        <div key={m.studentId} className="team-member-row">
                          <span className="team-member-name">{m.name}</span>
                          <span className="td-shots">{count}/{maxShots}</span>
                          <div className="progress-bar-bg">
                            <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                          </div>
                          {done && <span className="status-done">✅</span>}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
          </div>

          <button className="teacher-action-btn warning" onClick={handleShowTeamResults}>
            Show Team Results
          </button>
        </div>
      )}

      {/* ---- TEAM REVIEW ---- */}
      {(status === 'team_review' || status === 'ended') && (
        <div className="teacher-section">
          <h2 className="teacher-section-title">Team Results</h2>
          <p className="teacher-section-subtitle">
            Students are reviewing their team heatmaps.
          </p>

          <div className="teacher-teams-list">
            {Object.entries(teamMap)
              .filter(([key]) => key !== '__unmatched__')
              .map(([teamId, members]) => {
                const teamShots = shots.filter(
                  (s) => members.some((m) => m.studentId === s.studentId) && s.activity === 'team'
                );
                const teamStats = calculateStats(teamShots);
                return (
                  <div key={teamId} className="teacher-team-card">
                    <span className="team-badge">{teamId.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                    <span className="team-score">{teamStats.totalPoints} pts | {teamStats.shootingPercentage.toFixed(0)}%</span>
                    {members.map((m, i) => (
                      <React.Fragment key={m.studentId}>
                        <span className="team-member-name">{m.name}</span>
                        {i < members.length - 1 && <span className="vs-divider">+</span>}
                      </React.Fragment>
                    ))}
                  </div>
                );
              })}
          </div>

          {status === 'team_review' && (
            <button className="teacher-action-btn danger" onClick={handleEndSession}>
              End Session
            </button>
          )}

          {status === 'ended' && (
            <div className="teacher-ended-badge">Session Ended</div>
          )}
        </div>
      )}
    </div>
  );
};

export default TeacherLobby;
