import React, { useState, useMemo } from 'react';
import { Participant, SabotageAction, ShotTransfer, Shot, calculateStats } from '../types';
import CourtHeatmap from './CourtHeatmap';
import './SabotagePanel.css';

interface SabotagePanelProps {
  sessionCode: string;
  participants: Participant[];
  myParticipant: Participant | null;
  sabotageActions: SabotageAction[];
  shots: Shot[];
  saveSabotageActions: (code: string, actions: SabotageAction[]) => Promise<void>;
}

type SabotageTab = 'block_zone' | 'shots_transfer';

const EMPTY_STATS = {
  totalShots: 0,
  totalMade: 0,
  totalPoints: 0,
  pointsPerShot: 0,
  shootingPercentage: 0,
  byZone: {} as Record<string, { made: number; total: number; percentage: number; points: number; pointsPerShot: number }>,
};

const SabotagePanel: React.FC<SabotagePanelProps> = ({
  sessionCode,
  participants,
  myParticipant,
  sabotageActions,
  shots,
  saveSabotageActions,
}) => {
  const myTeamId = myParticipant?.teamId;

  const myTeamMembers = useMemo(
    () => participants.filter((p) => p.teamId === myTeamId),
    [participants, myTeamId]
  );

  // Deterministically pick one player per team as the designated saboteur.
  // All clients compute the same result without any extra network write.
  const designatedPlayer = useMemo(() => {
    if (myTeamMembers.length === 0) return null;
    const sorted = [...myTeamMembers].sort((a, b) => a.studentId.localeCompare(b.studentId));
    const hash = (sessionCode + (myTeamId ?? ''))
      .split('')
      .reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return sorted[hash % sorted.length];
  }, [myTeamMembers, sessionCode, myTeamId]);

  const isDesignated = myParticipant?.studentId === designatedPlayer?.studentId;

  const opponents = useMemo(
    () => participants.filter((p) => p.teamId !== null && p.teamId !== myTeamId),
    [participants, myTeamId]
  );

  const opponentTeamId = opponents.length > 0 ? opponents[0].teamId : null;

  const [activeTab, setActiveTab] = useState<SabotageTab>('block_zone');
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [shotAdjustments, setShotAdjustments] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const alreadySubmitted = sabotageActions.some((a) => a.actingTeamId === myTeamId);

  if (!isDesignated && designatedPlayer && !alreadySubmitted) {
    return (
      <div className="sabotage-panel">
        <div className="session-activity-header">
          <h2 className="activity-title">Sabotage Round 💣</h2>
          <p className="activity-subtitle">Your team's sabotage is being decided by one person.</p>
        </div>
        <div className="allocation-waiting">
          <span className="allocation-waiting-name">{designatedPlayer.name}</span>
          <p className="allocation-waiting-msg">is choosing your team's sabotage action.</p>
          <p className="allocation-waiting-cta">Look at their screen to help decide!</p>
        </div>
      </div>
    );
  }

  // --- Block zone helpers ---
  const handleZoneClick = (zone: string) => {
    setSelectedZones((prev) => {
      if (prev.includes(zone)) return prev.filter((z) => z !== zone);
      if (prev.length >= 2) return prev; // max 2
      return [...prev, zone];
    });
  };

  // --- Shots +/- helpers ---
  const totalRemoved = useMemo(
    () =>
      Object.entries(shotAdjustments)
        .filter(([id]) => opponents.some((p) => p.studentId === id))
        .reduce((sum, [, d]) => sum + Math.min(0, d), 0),
    [shotAdjustments, opponents]
  );

  const totalAdded = useMemo(
    () =>
      Object.entries(shotAdjustments)
        .filter(([id]) => myTeamMembers.some((p) => p.studentId === id))
        .reduce((sum, [, d]) => sum + Math.max(0, d), 0),
    [shotAdjustments, myTeamMembers]
  );

  const adjustShots = (studentId: string, delta: number, isOpponent: boolean) => {
    setShotAdjustments((prev) => {
      const current = prev[studentId] ?? 0;
      let next = current + delta;

      if (isOpponent) {
        next = Math.min(0, next);
        const otherRemovals = Object.entries(prev)
          .filter(([id]) => id !== studentId && opponents.some((p) => p.studentId === id))
          .reduce((sum, [, d]) => sum + Math.min(0, d), 0);
        if (next + otherRemovals < -2) next = -2 - otherRemovals;
      } else {
        next = Math.max(0, next);
        const otherAdditions = Object.entries(prev)
          .filter(([id]) => id !== studentId && myTeamMembers.some((p) => p.studentId === id))
          .reduce((sum, [, d]) => sum + Math.max(0, d), 0);
        const maxAdd = Math.abs(
          Object.entries(prev)
            .filter(([id]) => opponents.some((p) => p.studentId === id))
            .reduce((sum, [, d]) => sum + Math.min(0, d), 0)
        );
        if (next + otherAdditions > maxAdd) next = maxAdd - otherAdditions;
      }

      return { ...prev, [studentId]: next };
    });
  };

  // --- Validation ---
  const blockZoneValid = selectedZones.length > 0;
  const transferValid = Math.abs(totalRemoved) > 0 && totalAdded === Math.abs(totalRemoved);
  const isValid = activeTab === 'block_zone' ? blockZoneValid : transferValid;

  // --- Submit ---
  const handleSubmit = async () => {
    if (!myTeamId || !opponentTeamId || !isValid) return;
    setSaving(true);
    setSubmitError(null);

    let action: SabotageAction;

    if (activeTab === 'block_zone') {
      action = {
        id: `sabotage-${myTeamId}-${Date.now()}`,
        actingTeamId: myTeamId,
        targetTeamId: opponentTeamId,
        type: 'block_zone',
        blockedZones: selectedZones,
        timestamp: Date.now(),
      };
    } else {
      const transfers: ShotTransfer[] = Object.entries(shotAdjustments)
        .filter(([, d]) => d !== 0)
        .map(([studentId, delta]) => ({ studentId, delta }));

      action = {
        id: `sabotage-${myTeamId}-${Date.now()}`,
        actingTeamId: myTeamId,
        targetTeamId: opponentTeamId,
        type: 'shots_transfer',
        shotTransfers: transfers,
        timestamp: Date.now(),
      };
    }

    try {
      await saveSabotageActions(sessionCode, [action]);
      setSubmitted(true);
    } catch {
      setSubmitError('Failed to save sabotage. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (submitted || alreadySubmitted) {
    return (
      <div className="sabotage-panel">
        <div className="session-activity-header">
          <h2 className="activity-title">Sabotage Submitted 💣</h2>
          <p className="activity-subtitle">Waiting for the next phase...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sabotage-panel">
      <div className="session-activity-header">
        <h2 className="activity-title">Sabotage Round 💣</h2>
        <p className="activity-subtitle">Choose one sabotage action against the opposing team!</p>
      </div>

      <div className="sabotage-tabs">
        <button
          className={`sabotage-tab-btn ${activeTab === 'block_zone' ? 'active' : ''}`}
          onClick={() => setActiveTab('block_zone')}
        >
          🚫 Block Zone
        </button>
        <button
          className={`sabotage-tab-btn ${activeTab === 'shots_transfer' ? 'active' : ''}`}
          onClick={() => setActiveTab('shots_transfer')}
        >
          ➕➖ Shots +/−
        </button>
      </div>

      <div className="sabotage-config">
        {activeTab === 'block_zone' && (
          <div className="sabotage-block-zone">
            <p className="sabotage-helper">
              Tap up to <strong>2 zones</strong> on the court to block them for the opponent.
            </p>
            {selectedZones.length > 0 && (
              <div className="selected-zones-display">
                {selectedZones.map((z) => (
                  <span key={z} className="selected-zone-chip">
                    {z.split(': ')[1]}
                    <button className="deselect-zone" onClick={() => handleZoneClick(z)}>✕</button>
                  </span>
                ))}
              </div>
            )}
            <div className="sabotage-court-wrapper">
              <CourtHeatmap
                shots={[]}
                stats={EMPTY_STATS}
                onZoneClick={handleZoneClick}
                selectedZones={selectedZones}
              />
            </div>
          </div>
        )}

        {activeTab === 'shots_transfer' && (
          <div className="shots-transfer-section">
            <p className="sabotage-helper">
              Remove up to <strong>2 shots</strong> from opponents, then give the same number to your team.
            </p>
            <div className="shots-transfer-grid">
              <div className="transfer-column">
                <h3 className="transfer-col-title">
                  Opponents <span className="remove-label">(remove shots)</span>
                </h3>
                {opponents.map((p) => {
                  const pStats = calculateStats(
                    shots.filter((s) => s.studentId === p.studentId && s.activity === 'solo')
                  );
                  const adj = shotAdjustments[p.studentId] ?? 0;
                  return (
                    <div key={p.studentId} className="transfer-player-row">
                      <div className="transfer-player-info">
                        <span className="transfer-name">{p.name}</span>
                        <span className="transfer-stats">
                          {p.round1Score ?? 0} pts · {pStats.shootingPercentage.toFixed(0)}%
                        </span>
                      </div>
                      <div className="transfer-controls">
                        <button
                          className="transfer-btn remove"
                          onClick={() => adjustShots(p.studentId, -1, true)}
                          disabled={Math.abs(totalRemoved) >= 2 && adj >= 0}
                        >
                          −
                        </button>
                        <span className="transfer-value">{adj}</span>
                        <button
                          className="transfer-btn add"
                          onClick={() => adjustShots(p.studentId, 1, true)}
                          disabled={adj >= 0}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
                <div className="transfer-total">
                  Removed: <strong>{Math.abs(totalRemoved)}</strong> / 2
                </div>
              </div>

              <div className="transfer-column">
                <h3 className="transfer-col-title">
                  Your Team <span className="add-label">(add shots)</span>
                </h3>
                {myTeamMembers.map((p) => {
                  const pStats = calculateStats(
                    shots.filter((s) => s.studentId === p.studentId && s.activity === 'solo')
                  );
                  const adj = shotAdjustments[p.studentId] ?? 0;
                  const otherAdditions = Object.entries(shotAdjustments)
                    .filter(([id]) => id !== p.studentId && myTeamMembers.some((m) => m.studentId === id))
                    .reduce((sum, [, d]) => sum + Math.max(0, d), 0);
                  const maxAdd = Math.abs(totalRemoved);
                  return (
                    <div key={p.studentId} className="transfer-player-row">
                      <div className="transfer-player-info">
                        <span className="transfer-name">{p.name}</span>
                        <span className="transfer-stats">
                          {p.round1Score ?? 0} pts · {pStats.shootingPercentage.toFixed(0)}%
                        </span>
                      </div>
                      <div className="transfer-controls">
                        <button
                          className="transfer-btn remove"
                          onClick={() => adjustShots(p.studentId, -1, false)}
                          disabled={adj <= 0}
                        >
                          −
                        </button>
                        <span className="transfer-value">+{adj}</span>
                        <button
                          className="transfer-btn add"
                          onClick={() => adjustShots(p.studentId, 1, false)}
                          disabled={adj + otherAdditions >= maxAdd}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
                <div className={`transfer-total ${totalAdded === Math.abs(totalRemoved) && totalAdded > 0 ? 'valid' : ''}`}>
                  Added: <strong>{totalAdded}</strong> / {Math.abs(totalRemoved)}
                  {totalAdded !== Math.abs(totalRemoved) && totalRemoved < 0 && (
                    <span className="transfer-warning"> — distribute all removed shots</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {submitError && (
        <p className="sabotage-error-msg">{submitError}</p>
      )}

      <button
        className="btn btn-made sabotage-submit"
        onClick={handleSubmit}
        disabled={!isValid || saving}
      >
        {saving ? 'Saving...' : 'Confirm Sabotage 💣'}
      </button>
    </div>
  );
};

export default SabotagePanel;
