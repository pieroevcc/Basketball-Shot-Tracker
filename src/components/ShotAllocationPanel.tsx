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

const TOTAL_POOL = 30;
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

  // Spread 30 shots evenly, distribute remainder to first players
  const defaultAllocs = useMemo<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    const n = teamMembers.length;
    if (n === 0) return initial;
    const base = Math.max(MIN_SHOTS, Math.min(MAX_SHOTS, Math.floor(TOTAL_POOL / n)));
    let remainder = TOTAL_POOL - base * n;
    for (const member of teamMembers) {
      const extra = remainder > 0 ? 1 : 0;
      remainder -= extra;
      initial[member.studentId] = base + extra;
    }
    return initial;
  }, [teamMembers]);

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
  const allInRange = teamMembers.every(
    (m) => (allocs[m.studentId] ?? 0) >= MIN_SHOTS && (allocs[m.studentId] ?? 0) <= MAX_SHOTS
  );
  const isValid = totalAllocated === TOTAL_POOL && allInRange;

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
          Distribute <strong>{TOTAL_POOL} shots</strong> among your team.
          Each player must get between <strong>{MIN_SHOTS}–{MAX_SHOTS} shots</strong>.
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
                  R1: {stats.totalPoints} pts · {stats.shootingPercentage.toFixed(0)}%
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
        {totalAllocated} / {TOTAL_POOL} shots allocated
        {!isValid && totalAllocated !== TOTAL_POOL && (
          <span className="allocation-warning">
            {' '}— {totalAllocated < TOTAL_POOL ? `${TOTAL_POOL - totalAllocated} more to assign` : `${totalAllocated - TOTAL_POOL} too many`}
          </span>
        )}
        {!allInRange && totalAllocated === TOTAL_POOL && (
          <span className="allocation-warning"> — each player needs {MIN_SHOTS}–{MAX_SHOTS} shots</span>
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
