import React, { useState, useMemo } from 'react';
import { Participant, Shot, ShotAllocation, calculateStats } from '../types';
import './ShotAllocationPanel.css';

interface ShotAllocationPanelProps {
  sessionCode: string;
  participants: Participant[];
  myParticipant: Participant | null;
  shots: Shot[];
  allocations: ShotAllocation[];
  saveShotAllocations: (code: string, allocations: ShotAllocation[]) => Promise<void>;
}

const MIN_SHOTS = 5;
const MAX_SHOTS = 15;

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

  // Deterministically pick one player per team as the designated allocator.
  // All clients compute the same result without any extra network write.
  const designatedPlayer = useMemo(() => {
    if (teamMembers.length === 0) return null;
    const sorted = [...teamMembers].sort((a, b) => a.studentId.localeCompare(b.studentId));
    const hash = (sessionCode + (myTeamId ?? ''))
      .split('')
      .reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return sorted[hash % sorted.length];
  }, [teamMembers, sessionCode, myTeamId]);

  const isDesignated = myParticipant?.studentId === designatedPlayer?.studentId;

  const totalPool = 30;

  // Distribute totalPool evenly; first (remainder) players get base+1
  const defaultAllocs = useMemo<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    if (teamMembers.length === 0) return initial;
    const base = Math.floor(totalPool / teamMembers.length);
    const remainder = totalPool % teamMembers.length;
    teamMembers.forEach((member, index) => {
      const shots = Math.max(MIN_SHOTS, Math.min(MAX_SHOTS, base + (index < remainder ? 1 : 0)));
      initial[member.studentId] = shots;
    });
    return initial;
  }, [teamMembers, totalPool]);

  const [allocs, setAllocs] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const member of teamMembers) {
      const existing = allocations.find(
        (a) => a.studentId === member.studentId && a.teamId === myTeamId
      );
      initial[member.studentId] = existing?.allocatedShots ?? defaultAllocs[member.studentId] ?? MIN_SHOTS;
    }
    return initial;
  });

  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const totalAllocated = Object.values(allocs).reduce((sum, v) => sum + v, 0);
  const isValid = totalAllocated === totalPool;

  const handleChange = (studentId: string, value: number) => {
    setAllocs((prev) => ({
      ...prev,
      [studentId]: Math.max(MIN_SHOTS, Math.min(MAX_SHOTS, value)),
    }));
  };

  const handleSubmit = async () => {
    if (!myTeamId || !isValid) return;
    setSaving(true);
    const allocationList: ShotAllocation[] = teamMembers.map((m) => ({
      teamId: myTeamId,
      studentId: m.studentId,
      allocatedShots: allocs[m.studentId] ?? MIN_SHOTS,
    }));
    await saveShotAllocations(sessionCode, allocationList);
    setSubmitted(true);
    setSaving(false);
  };

  if (!isDesignated && designatedPlayer) {
    return (
      <div className="allocation-panel">
        <div className="session-activity-header">
          <h2 className="activity-title">Shot Allocation 🎯</h2>
          <p className="activity-subtitle">
            Your team's shot allocation is being decided by one person.
          </p>
        </div>
        <div className="allocation-waiting">
          <span className="allocation-waiting-name">{designatedPlayer.name}</span>
          <p className="allocation-waiting-msg">is choosing how to allocate your team's shots.</p>
          <p className="allocation-waiting-cta">Look at their screen to help decide!</p>
        </div>
      </div>
    );
  }

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
          Distribute <strong>{totalPool} shots</strong> among your team.
        </p>
      </div>

      <div className="allocation-list">
        {teamMembers.map((member) => {
          const memberSoloShots = shots.filter(
            (s) => s.studentId === member.studentId && s.activity === 'solo'
          );
          const stats = calculateStats(memberSoloShots);
          const val = allocs[member.studentId] ?? MIN_SHOTS;
          const atMin = val <= MIN_SHOTS;
          const atMax = val >= MAX_SHOTS;
          return (
            <div key={member.studentId} className="allocation-row">
              <div className="allocation-player-info">
                <span className="allocation-name">{member.name}</span>
                <span className="allocation-stats">
                  {stats.totalPoints} pts ● {stats.shootingPercentage.toFixed(0)}%
                </span>
              </div>
              <div className="allocation-input-group">
                <button
                  className="allocation-btn"
                  onClick={() => handleChange(member.studentId, val - 1)}
                  disabled={atMin}
                >
                  −
                </button>
                <span className="allocation-value">{val}</span>
                <button
                  className="allocation-btn"
                  onClick={() => handleChange(member.studentId, val + 1)}
                  disabled={atMax}
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
        {!isValid && (
          <span className="allocation-warning">
            {' '}— {totalAllocated < totalPool ? `${totalPool - totalAllocated} more to assign` : `${totalAllocated - totalPool} too many`}
          </span>
        )}
      </div>

      <button
        className="btn btn-made allocation-submit"
        onClick={handleSubmit}
        disabled={!isValid || saving}
      >
        {saving ? 'Saving...' : 'Confirm Allocation 🎯'}
      </button>
    </div>
  );
};

export default ShotAllocationPanel;
