import React, { useState, useMemo } from 'react';
import { Participant, Shot, ShotAllocation, calculateStats } from '../types';

interface ShotAllocationPanelProps {
  sessionCode: string;
  participants: Participant[];
  myParticipant: Participant | null;
  shots: Shot[];
  allocations: ShotAllocation[];
  saveShotAllocations: (code: string, allocations: ShotAllocation[]) => Promise<void>;
}

const DEFAULT_SHOTS_PER_PLAYER = 20;

const ShotAllocationPanel: React.FC<ShotAllocationPanelProps> = ({
  sessionCode,
  participants,
  myParticipant,
  shots,
  allocations,
  saveShotAllocations,
}) => {
  const myTeamId = myParticipant?.teamId;
  const teamMembers = useMemo(
    () => participants.filter((p) => p.teamId === myTeamId),
    [participants, myTeamId]
  );

  const totalPool = teamMembers.length * DEFAULT_SHOTS_PER_PLAYER;

  // Initialize allocations from existing or default
  const [allocs, setAllocs] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const member of teamMembers) {
      const existing = allocations.find(
        (a) => a.studentId === member.studentId && a.teamId === myTeamId
      );
      initial[member.studentId] = existing?.allocatedShots ?? DEFAULT_SHOTS_PER_PLAYER;
    }
    return initial;
  });

  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const totalAllocated = Object.values(allocs).reduce((sum, v) => sum + v, 0);
  const isValid = totalAllocated === totalPool;

  const handleChange = (studentId: string, value: number) => {
    setAllocs((prev) => ({ ...prev, [studentId]: Math.max(0, value) }));
  };

  const handleSubmit = async () => {
    if (!myTeamId || !isValid) return;
    setSaving(true);
    const allocationList: ShotAllocation[] = teamMembers.map((m) => ({
      teamId: myTeamId,
      studentId: m.studentId,
      allocatedShots: allocs[m.studentId] ?? DEFAULT_SHOTS_PER_PLAYER,
    }));
    await saveShotAllocations(sessionCode, allocationList);
    setSubmitted(true);
    setSaving(false);
  };

  if (submitted) {
    return (
      <div className="allocation-panel">
        <div className="session-activity-header">
          <h2 className="activity-title">Shots Allocated ✅</h2>
          <p className="activity-subtitle">Waiting for the next phase...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="allocation-panel">
      <div className="session-activity-header">
        <h2 className="activity-title">Shot Allocation 🎯</h2>
        <p className="activity-subtitle">
          Distribute {totalPool} shots among your team members.
        </p>
      </div>

      <div className="allocation-list">
        {teamMembers.map((member) => {
          const memberSoloShots = shots.filter(
            (s) => s.studentId === member.studentId && s.activity === 'solo'
          );
          const stats = calculateStats(memberSoloShots);
          return (
            <div key={member.studentId} className="allocation-row">
              <div className="allocation-player-info">
                <span className="allocation-name">{member.name}</span>
                <span className="allocation-stats">
                  R1: {stats.totalPoints} pts | {stats.shootingPercentage.toFixed(0)}%
                </span>
              </div>
              <div className="allocation-input-group">
                <button
                  className="allocation-btn"
                  onClick={() => handleChange(member.studentId, (allocs[member.studentId] ?? 0) - 1)}
                >
                  −
                </button>
                <input
                  type="number"
                  className="allocation-input"
                  value={allocs[member.studentId] ?? 0}
                  onChange={(e) => handleChange(member.studentId, parseInt(e.target.value) || 0)}
                  min={0}
                  max={totalPool}
                />
                <button
                  className="allocation-btn"
                  onClick={() => handleChange(member.studentId, (allocs[member.studentId] ?? 0) + 1)}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className={`allocation-total ${isValid ? 'valid' : 'invalid'}`}>
        {totalAllocated} / {totalPool} shots allocated
        {!isValid && <span className="allocation-warning"> — Must equal {totalPool}</span>}
      </div>

      <button
        className="btn btn-made allocation-submit"
        onClick={handleSubmit}
        disabled={!isValid || saving}
      >
        {saving ? 'Saving...' : 'Confirm Allocation'}
      </button>
    </div>
  );
};

export default ShotAllocationPanel;
