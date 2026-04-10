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

  // --- Shots +/- helpers (opponents only) ---
  // All adjustments are within the opponent team.
  // Negative delta = shots removed from this player; positive = shots given to this player.
  const totalRemoved = useMemo(
    () => Object.values(shotAdjustments).reduce((sum, d) => sum + Math.min(0, d), 0),
    [shotAdjustments]
  );

  const totalAdded = useMemo(
    () => Object.values(shotAdjustments).reduce((sum, d) => sum + Math.max(0, d), 0),
    [shotAdjustments]
  );

  const adjustShots = (opponentId: string, delta: number) => {
    setShotAdjustments((prev) => {
      const current = prev[opponentId] ?? 0;
      let next = current + delta;

      if (delta < 0) {
        // Removing shots from this player — clamp total removed at -2
        const otherRemovals = Object.entries(prev)
          .filter(([id]) => id !== opponentId)
          .reduce((sum, [, d]) => sum + Math.min(0, d), 0);
        if (next + otherRemovals < -2) next = -2 - otherRemovals;
      } else {
        // Adding shots to this player — can't exceed total removed
        const otherAdditions = Object.entries(prev)
          .filter(([id]) => id !== opponentId)
          .reduce((sum, [, d]) => sum + Math.max(0, d), 0);
        const totalRemovedInPrev = Math.abs(
          Object.values(prev).reduce((sum, d) => sum + Math.min(0, d), 0)
        );
        if (next + otherAdditions > totalRemovedInPrev) next = totalRemovedInPrev - otherAdditions;
      }

      return { ...prev, [opponentId]: next };
    });
  };

  // --- Validation ---
  const blockZoneValid = selectedZones.length > 0;
  // transferValid: true if nothing removed (optional step), or if removed shots are fully redistributed
  const transferValid = totalAdded === Math.abs(totalRemoved);

  // --- Submit ---
  const handleSubmit = async () => {
    if (!myTeamId || !opponentTeamId || !blockZoneValid) return;
    setSaving(true);
    setSubmitError(null);

    const now = Date.now();
    const actions: SabotageAction[] = [
      {
        id: `sabotage-block-${myTeamId}-${now}`,
        actingTeamId: myTeamId,
        targetTeamId: opponentTeamId,
        type: 'block_zone',
        blockedZones: selectedZones,
        timestamp: now,
      },
    ];

    if (Math.abs(totalRemoved) > 0 && transferValid) {
      const transfers: ShotTransfer[] = Object.entries(shotAdjustments)
        .filter(([, d]) => d !== 0)
        .map(([studentId, delta]) => ({ studentId, delta }));
      actions.push({
        id: `sabotage-transfer-${myTeamId}-${now}`,
        actingTeamId: myTeamId,
        targetTeamId: opponentTeamId,
        type: 'shots_transfer',
        shotTransfers: transfers,
        timestamp: now,
      });
    }

    try {
      await saveSabotageActions(sessionCode, actions);
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
        <div className="allocation-waiting">
          <span className="allocation-waiting-name">💣 Sabotage locked in!</span>
          <p className="allocation-waiting-msg">Your team's sabotage has been submitted.</p>
          <p className="allocation-waiting-cta">Hang tight — Round 2 shooting starts soon!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sabotage-panel">
      <div className="session-activity-header">
        <h2 className="activity-title">Sabotage Round 💣</h2>
        <p className="activity-subtitle">Block zones and steal shots from the opposing team!</p>
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
            <button
              className="btn btn-made sabotage-next-btn"
              onClick={() => setActiveTab('shots_transfer')}
              disabled={!blockZoneValid}
            >
              Next →
            </button>
          </div>
        )}

        {activeTab === 'shots_transfer' && (
          <div className="shots-transfer-section">
            <p className="sabotage-helper">
              Remove up to <strong>2 shots</strong> from opponent players and give them to other
              opponent players. Use <strong>−</strong> to take a shot away and <strong>+</strong> to
              give it to someone else.
            </p>
            <div className="shots-transfer-single-col">
              <h3 className="transfer-col-title">Opponent Players</h3>
              {opponents.map((p) => {
                const pStats = calculateStats(
                  shots.filter((s) => s.studentId === p.studentId && s.activity === 'solo')
                );
                const adj = shotAdjustments[p.studentId] ?? 0;
                const canRemove = adj > 0 ? true : Math.abs(totalRemoved) < 2;
                const canAdd = adj < 0 ? true : totalAdded < Math.abs(totalRemoved);
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
                        onClick={() => adjustShots(p.studentId, -1)}
                        disabled={!canRemove && adj <= 0}
                      >
                        −
                      </button>
                      <span className={`transfer-value ${adj < 0 ? 'neg' : adj > 0 ? 'pos' : ''}`}>
                        {adj > 0 ? `+${adj}` : adj}
                      </span>
                      <button
                        className="transfer-btn add"
                        onClick={() => adjustShots(p.studentId, 1)}
                        disabled={!canAdd && adj >= 0}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
              <div className="transfer-totals-row">
                <span className="transfer-total">
                  Removed: <strong>{Math.abs(totalRemoved)}</strong> / 2
                </span>
                <span className={`transfer-total ${totalAdded === Math.abs(totalRemoved) ? 'valid' : ''}`}>
                  Redistributed: <strong>{totalAdded}</strong> / {Math.abs(totalRemoved)}
                  {totalAdded !== Math.abs(totalRemoved) && totalRemoved < 0 && (
                    <span className="transfer-warning"> — must redistribute all removed shots</span>
                  )}
                </span>
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
        disabled={!blockZoneValid || saving || (totalRemoved < 0 && !transferValid)}
      >
        {saving ? 'Saving...' : 'Confirm Sabotage 💣'}
      </button>
    </div>
  );
};

export default SabotagePanel;
