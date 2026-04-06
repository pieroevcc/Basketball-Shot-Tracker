import React, { useState, useMemo } from 'react';
import { Participant, SabotageAction, ZONES } from '../types';

interface SabotagePanelProps {
  sessionCode: string;
  participants: Participant[];
  myParticipant: Participant | null;
  sabotageActions: SabotageAction[];
  saveSabotageActions: (code: string, actions: SabotageAction[]) => Promise<void>;
}

type SabotageType = 'block_zone' | 'remove_shots' | 'add_shots';

const SabotagePanel: React.FC<SabotagePanelProps> = ({
  sessionCode,
  participants,
  myParticipant,
  sabotageActions,
  saveSabotageActions,
}) => {
  const myTeamId = myParticipant?.teamId;

  const opponents = useMemo(
    () => participants.filter((p) => p.teamId !== null && p.teamId !== myTeamId),
    [participants, myTeamId]
  );

  const opponentTeamId = opponents.length > 0 ? opponents[0].teamId : null;

  const [sabotageType, setSabotageType] = useState<SabotageType>('block_zone');
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [targetStudentId, setTargetStudentId] = useState<string>('');
  const [shotDelta, setShotDelta] = useState<number>(5);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  // Check if this team already submitted a sabotage
  const alreadySubmitted = sabotageActions.some((a) => a.actingTeamId === myTeamId);

  const handleSubmit = async () => {
    if (!myTeamId || !opponentTeamId) return;
    setSaving(true);

    const action: SabotageAction = {
      id: `sabotage-${myTeamId}-${Date.now()}`,
      actingTeamId: myTeamId,
      targetTeamId: opponentTeamId,
      type: sabotageType,
      timestamp: Date.now(),
    };

    if (sabotageType === 'block_zone' && selectedZone) {
      action.blockedZone = selectedZone;
    } else if (sabotageType === 'remove_shots' && targetStudentId) {
      action.targetStudentId = targetStudentId;
      action.shotDelta = -Math.abs(shotDelta);
    } else if (sabotageType === 'add_shots' && targetStudentId) {
      action.targetStudentId = targetStudentId;
      action.shotDelta = Math.abs(shotDelta);
    }

    await saveSabotageActions(sessionCode, [action]);
    setSubmitted(true);
    setSaving(false);
  };

  const isValid = (() => {
    if (sabotageType === 'block_zone') return selectedZone !== '';
    if (sabotageType === 'remove_shots' || sabotageType === 'add_shots')
      return targetStudentId !== '' && shotDelta > 0;
    return false;
  })();

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
        <p className="activity-subtitle">
          Choose one sabotage action against the opposing team!
        </p>
      </div>

      <div className="sabotage-type-selector">
        <button
          className={`sabotage-type-btn ${sabotageType === 'block_zone' ? 'active' : ''}`}
          onClick={() => setSabotageType('block_zone')}
        >
          🚫 Block Zone
        </button>
        <button
          className={`sabotage-type-btn ${sabotageType === 'remove_shots' ? 'active' : ''}`}
          onClick={() => setSabotageType('remove_shots')}
        >
          ➖ Remove Shots
        </button>
        <button
          className={`sabotage-type-btn ${sabotageType === 'add_shots' ? 'active' : ''}`}
          onClick={() => setSabotageType('add_shots')}
        >
          ➕ Force Extra Shots
        </button>
      </div>

      <div className="sabotage-config">
        {sabotageType === 'block_zone' && (
          <div className="sabotage-zone-select">
            <label>Select a zone to block for the opponent:</label>
            <div className="zone-buttons">
              {Object.keys(ZONES).map((zone) => (
                <button
                  key={zone}
                  className={`zone-btn ${selectedZone === zone ? 'selected' : ''}`}
                  onClick={() => setSelectedZone(zone)}
                >
                  {zone}
                </button>
              ))}
            </div>
          </div>
        )}

        {(sabotageType === 'remove_shots' || sabotageType === 'add_shots') && (
          <div className="sabotage-player-select">
            <label>
              {sabotageType === 'remove_shots'
                ? 'Remove shots from an opponent:'
                : 'Force extra shots on an opponent (weaker shooter):'}
            </label>
            <div className="opponent-buttons">
              {opponents.map((p) => (
                <button
                  key={p.studentId}
                  className={`opponent-btn ${targetStudentId === p.studentId ? 'selected' : ''}`}
                  onClick={() => setTargetStudentId(p.studentId)}
                >
                  {p.name}
                  {p.round1Score !== undefined && (
                    <span className="opponent-score"> ({p.round1Score} pts)</span>
                  )}
                </button>
              ))}
            </div>
            <div className="shot-delta-input">
              <label>Number of shots:</label>
              <input
                type="number"
                value={shotDelta}
                onChange={(e) => setShotDelta(Math.max(1, parseInt(e.target.value) || 1))}
                min={1}
                max={10}
              />
            </div>
          </div>
        )}
      </div>

      <button
        className="btn btn-made sabotage-submit"
        onClick={handleSubmit}
        disabled={!isValid || saving}
      >
        {saving ? 'Saving...' : 'Confirm Sabotage'}
      </button>
    </div>
  );
};

export default SabotagePanel;
