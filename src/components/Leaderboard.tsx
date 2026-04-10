import React from 'react';
import { Shot, Participant, calculateStats, calculateScore } from '../types';
import './Leaderboard.css';

interface LeaderboardProps {
  participants: Participant[];
  shots: Shot[];
  currentStudentId: string;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ participants, shots, currentStudentId }) => {
  const ranked = [...participants]
    .filter((p) => !p.kicked)
    .map((p) => {
      const soloShots = shots.filter((s) => s.studentId === p.studentId && s.activity === 'solo');
      const stats = calculateStats(soloShots);
      return {
        ...p,
        score: p.round1Score ?? calculateScore(soloShots),
        shootingPct: stats.shootingPercentage,
        totalShots: soloShots.length,
      };
    })
    .sort((a, b) => b.score - a.score);

  const medal = (i: number) => {
    if (i === 0) return '🥇';
    if (i === 1) return '🥈';
    if (i === 2) return '🥉';
    return `${i + 1}.`;
  };

  const rowClass = (i: number, studentId: string) => {
    const classes = ['leaderboard-row'];
    if (i === 0) classes.push('gold');
    else if (i === 1) classes.push('silver');
    else if (i === 2) classes.push('bronze');
    if (studentId === currentStudentId) classes.push('me');
    return classes.join(' ');
  };

  return (
    <div className="leaderboard-wrapper">
      <div className="leaderboard-header">
        <h2 className="leaderboard-title">Leaderboard 🏆</h2>
      </div>
      <div className="leaderboard-list">
        {ranked.slice(0, 5).map((p, i) => (
          <div key={p.studentId} className={rowClass(i, p.studentId)}>
            <span className="leaderboard-rank">{medal(i)}</span>
            <span className="leaderboard-name">
              {p.name}
              {p.studentId === currentStudentId && (
                <span className="leaderboard-you-badge"> (You)</span>
              )}
            </span>
            <span className="leaderboard-score">{p.score} pts</span>
          </div>
        ))}
        {ranked.length === 0 && (
          <p className="leaderboard-empty">No scores yet...</p>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
