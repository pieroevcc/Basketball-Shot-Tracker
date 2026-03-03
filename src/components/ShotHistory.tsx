import React from 'react';
import { Shot } from '../types';
import './ShotHistory.css';

interface ShotHistoryProps {
  shots: Shot[];
  onClear: () => void;
  onDelete: (id: string) => void;
}

const ShotHistory: React.FC<ShotHistoryProps> = ({ shots, onClear, onDelete }) => {
  const recentShots = [...shots].reverse().slice(0, 10);

  return (
    <div className="shot-history">
      <div className="history-header">
        <h3>📝 Recent Shots</h3>
        {shots.length > 0 && (
          <button onClick={onClear} className="clear-btn">
            Clear All
          </button>
        )}
      </div>

      {shots.length === 0 ? (
        <p className="empty-message">No shots recorded yet. Click on the court to start!</p>
      ) : (
        <div className="shots-list">
          {recentShots.map((shot, index) => (
            <div key={shot.id} className={`shot-item ${shot.made ? 'made' : 'missed'}`}>
              <span className="shot-number">{shots.length - index}</span>
              <span className="shot-zone">{shot.zone}</span>
              <span className={`shot-result ${shot.made ? 'made' : 'missed'}`}>
                {shot.made ? '✅ Made' : '❌ Missed'}
              </span>
              <button
                className="delete-btn"
                onClick={() => onDelete(shot.id)}
                title="Delete this shot"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="history-footer">
        <small>Total Shots: {shots.length}</small>
      </div>
    </div>
  );
};

export default ShotHistory;