import React, { useState } from 'react';
import { Shot } from '../types';
import './ShotHistory.css';

interface ShotHistoryProps {
  shots: Shot[];
  onClear: () => void;
  onDelete: (id: string) => void;
}

const ShotHistory: React.FC<ShotHistoryProps> = ({ shots, onClear, onDelete }) => {
  const [filterStudent, setFilterStudent] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Get unique student IDs for the filter dropdown
  const studentIds = Array.from(new Set(shots.map(s => s.studentId || 'local')));

  // Filter shots
  const filteredShots = filterStudent === 'all'
    ? shots
    : shots.filter(s => (s.studentId || 'local') === filterStudent);

  const recentShots = [...filteredShots].reverse();

  // Determine shot type based on zone
  const getShotType = (zone: string): string => {
    if (zone.includes('Paint')) return 'Layup';
    if (zone.includes('Mid-Range')) return 'Jumper';
    if (zone.includes('Outside') || zone.includes('Top of Key')) return 'Three';
    return 'Jumper';
  };

  return (
    <div className="shot-history">
      {/* Filter Dropdown — Centered */}
      <div className="filter-row">
        <select
          className="filter-dropdown"
          value={filterStudent}
          onChange={(e) => setFilterStudent(e.target.value)}
        >
          <option value="all">Filter by Student</option>
          {studentIds.map(sid => (
            <option key={sid} value={sid}>
              {sid === 'local' ? 'Local Player' : `Player ${sid.substring(0, 4)}`}
            </option>
          ))}
        </select>
      </div>

      {/* Header */}
      <div className="history-header">
        <h3>📝 Recent Shots</h3>
        <div className="header-right">
          <span className="auto-update-note">*Data edits auto-update<br/>the Court Page.*</span>
          {shots.length > 0 && (
            <button onClick={onClear} className="clear-btn">
              Clear All
            </button>
          )}
        </div>
      </div>

      {filteredShots.length === 0 ? (
        <p className="empty-message">No shots recorded yet. Click on the court to start!</p>
      ) : (
        <div className="shots-list">
          {recentShots.map((shot, index) => (
            <div key={shot.id} className={`shot-item ${shot.made ? 'made' : 'missed'}`}>
              <span className="shot-number">{filteredShots.length - index}</span>
              <span className="shot-zone">{shot.zone}</span>
              <span className={`shot-result-badge ${shot.made ? 'made' : 'missed'}`}>
                {shot.made ? '✅ Made' : 'Missed'}
              </span>
              <span className="shot-type">{getShotType(shot.zone)}</span>
              <button
                className="edit-btn"
                onClick={() => setEditingId(editingId === shot.id ? null : shot.id)}
                title="Edit this shot"
              >
                ✏️
              </button>
              <button
                className="delete-btn"
                onClick={() => onDelete(shot.id)}
                title="Delete this shot"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="history-footer">
        <strong>Total Shots: {filteredShots.length}</strong>
      </div>
    </div>
  );
};

export default ShotHistory;