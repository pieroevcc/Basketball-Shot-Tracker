import React from 'react';
import { Session, Participant, Shot, SessionStatus } from '../types';
import { UseSessionReturn } from '../hooks/useSession';
import './TeacherLobby.css';

interface TeacherLobbyProps {
  session: Session;
  participants: Participant[];
  shots: Shot[];
  sessionCode: string;
  advanceSession: UseSessionReturn['advanceSession'];
  pairTeams: UseSessionReturn['pairTeams'];
}

const MAX_SOLO_SHOTS = 15;
const MAX_TEAM_SHOTS = 20;

const TeacherLobby: React.FC<TeacherLobbyProps> = ({
  session,
  participants,
  shots,
  sessionCode,
  advanceSession,
  pairTeams,
}) => {
  const status: SessionStatus = session.status;

  const getSoloCount = (p: Participant) =>
    shots.filter((s) => s.studentId === p.studentId && s.activity === 'solo').length;

  const getTeamCount = (p: Participant) =>
    shots.filter((s) => s.studentId === p.studentId && s.activity === 'team').length;

  const handleStartSolo = async () => {
    await advanceSession(sessionCode, 'solo_active');
  };

  const handleEndSolo = async () => {
    await advanceSession(sessionCode, 'solo_review');
  };

  const handleStartTeamStrategy = async () => {
    await pairTeams(sessionCode);
    await advanceSession(sessionCode, 'team_strategy');
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

  return (
    <div className="teacher-lobby">
      {/* Always-visible code banner */}
      <div className="teacher-code-banner">
        <span className="teacher-code-label">Session Code</span>
        <span className="teacher-code-value">{sessionCode}</span>
      </div>

      {/* ---- LOBBY ---- */}
      {status === 'lobby' && (
        <div className="teacher-section">
          <h2 className="teacher-section-title">
            Waiting Room
            <span className="participant-badge">{participants.length} joined</span>
          </h2>

          <div className="teacher-participant-list">
            {participants.length === 0 ? (
              <p className="teacher-empty">No students yet — share the code above!</p>
            ) : (
              participants.map((p) => (
                <div key={p.studentId} className="teacher-participant-row">
                  <span className="participant-name">{p.name}</span>
                  <span className="participant-joined">Joined</span>
                </div>
              ))
            )}
          </div>

          <button
            className="teacher-action-btn primary"
            onClick={handleStartSolo}
            disabled={participants.length < 2}
          >
            {participants.length < 2
              ? `Need at least 2 students (${participants.length}/2)`
              : '▶ Start Solo Activity'}
          </button>
        </div>
      )}

      {/* ---- SOLO ACTIVE ---- */}
      {status === 'solo_active' && (
        <div className="teacher-section">
          <h2 className="teacher-section-title">Solo Activity in Progress</h2>
          <p className="teacher-section-subtitle">
            Each student takes up to {MAX_SOLO_SHOTS} shots individually.
          </p>

          <table className="teacher-progress-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Shots</th>
                <th>Progress</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((p) => {
                const count = getSoloCount(p);
                const pct = Math.min(100, (count / MAX_SOLO_SHOTS) * 100);
                const done = count >= MAX_SOLO_SHOTS;
                return (
                  <tr key={p.studentId}>
                    <td className="td-name">{p.name}</td>
                    <td className="td-shots">{count}/{MAX_SOLO_SHOTS}</td>
                    <td className="td-bar">
                      <div className="progress-bar-bg">
                        <div
                          className="progress-bar-fill"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </td>
                    <td className="td-status">
                      {done ? (
                        <span className="status-done">Done ✅</span>
                      ) : (
                        <span className="status-going">Shooting...</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <button className="teacher-action-btn warning" onClick={handleEndSolo}>
            End Solo & Show Review
          </button>
        </div>
      )}

      {/* ---- SOLO REVIEW (teacher sees it too, but just a holding screen) ---- */}
      {status === 'solo_review' && (
        <div className="teacher-section">
          <h2 className="teacher-section-title">Solo Review</h2>
          <p className="teacher-section-subtitle">
            Students are reviewing their solo heatmaps. When ready, pair them into teams!
          </p>

          <div className="teacher-participant-list">
            {participants.map((p) => (
              <div key={p.studentId} className="teacher-participant-row">
                <span className="participant-name">{p.name}</span>
                <span className="td-shots">{getSoloCount(p)} shots</span>
              </div>
            ))}
          </div>

          <button className="teacher-action-btn primary" onClick={handleStartTeamStrategy}>
            Pair Teams & Start Strategy
          </button>
        </div>
      )}

      {/* ---- TEAM STRATEGY ---- */}
      {status === 'team_strategy' && (
        <div className="teacher-section">
          <h2 className="teacher-section-title">Team Strategy</h2>
          <p className="teacher-section-subtitle">
            Students are comparing heatmaps with their partners. Current pairings:
          </p>

          <div className="teacher-teams-list">
            {Object.entries(teamMap)
              .filter(([key]) => key !== '__unmatched__')
              .map(([teamId, members]) => (
                <div key={teamId} className="teacher-team-card">
                  <span className="team-badge">Team</span>
                  {members.map((m, i) => (
                    <React.Fragment key={m.studentId}>
                      <span className="team-member-name">{m.name}</span>
                      {i < members.length - 1 && <span className="vs-divider">+</span>}
                    </React.Fragment>
                  ))}
                </div>
              ))}
          </div>

          <button className="teacher-action-btn primary" onClick={handleStartTeamActive}>
            Start Team Shooting
          </button>
        </div>
      )}

      {/* ---- TEAM ACTIVE ---- */}
      {status === 'team_active' && (
        <div className="teacher-section">
          <h2 className="teacher-section-title">Team Activity in Progress</h2>
          <p className="teacher-section-subtitle">
            Each student takes up to {MAX_TEAM_SHOTS} shots as part of their team.
          </p>

          <div className="teacher-teams-list">
            {Object.entries(teamMap)
              .filter(([key]) => key !== '__unmatched__')
              .map(([teamId, members]) => (
                <div key={teamId} className="teacher-team-card large">
                  <span className="team-badge">Team</span>
                  {members.map((m) => {
                    const count = getTeamCount(m);
                    const pct = Math.min(100, (count / MAX_TEAM_SHOTS) * 100);
                    const done = count >= MAX_TEAM_SHOTS;
                    return (
                      <div key={m.studentId} className="team-member-row">
                        <span className="team-member-name">{m.name}</span>
                        <span className="td-shots">{count}/{MAX_TEAM_SHOTS}</span>
                        <div className="progress-bar-bg">
                          <div
                            className="progress-bar-fill"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {done && <span className="status-done">✅</span>}
                      </div>
                    );
                  })}
                </div>
              ))}
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
              .map(([teamId, members]) => (
                <div key={teamId} className="teacher-team-card">
                  <span className="team-badge">Team</span>
                  {members.map((m, i) => (
                    <React.Fragment key={m.studentId}>
                      <span className="team-member-name">{m.name}</span>
                      {i < members.length - 1 && <span className="vs-divider">+</span>}
                    </React.Fragment>
                  ))}
                </div>
              ))}
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
