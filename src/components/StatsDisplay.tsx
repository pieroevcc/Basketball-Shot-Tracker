import React from 'react';
import { Stats } from '../types';
import './StatsDisplay.css';

interface StatsDisplayProps {
  stats: Stats;
}

const StatsDisplay: React.FC<StatsDisplayProps> = ({ stats }) => {
  return (
    <div className="stats-container">
      <div className="overall-stats">
        <h2>📊 Overall Stats</h2>
        <div className="stat-item">
          <span>Total Shots:</span>
          <strong>{stats.totalShots}</strong>
        </div>
        <div className="stat-item">
          <span>Made Shots:</span>
          <strong>{stats.totalMade}</strong>
        </div>
        <div className="stat-item">
          <span>Shooting %:</span>
          <strong>{stats.shootingPercentage.toFixed(1)}%</strong>
        </div>
        <div className="stat-item">
          <span>Total Points:</span>
          <strong>{stats.totalPoints}</strong>
        </div>
      </div>

      <div className="zone-stats">
        <h2>📍 Stats by Zone</h2>
        <div className="zone-grid">
          {Object.entries(stats.byZone).map(([zone, data]) => (
            <div key={zone} className="zone-card">
              <h3>{zone}</h3>
              <div className="zone-stat">
                <span>Made:</span> <strong>{data.made}/{data.total}</strong>
              </div>
              <div className="zone-stat">
                <span>%:</span> <strong>{data.percentage.toFixed(1)}%</strong>
              </div>
              <div className="zone-stat">
                <span>Pts:</span> <strong>{data.points}</strong>
              </div>
              <div className={`zone-indicator ${getHotColdClass(data.percentage)}`}></div>
            </div>
          ))}
        </div>
      </div>

      <div className="legend">
        <h3>🔥 Heat Map Legend</h3>
        <div className="legend-item">
          <div className="legend-color hot"></div>
          <span>Hot (70%+)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color warm"></div>
          <span>Warm (50-69%)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color cool"></div>
          <span>Cool (30-49%)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color cold"></div>
          <span>Cold (&lt;30%)</span>
        </div>
      </div>
    </div>
  );
};

const getHotColdClass = (percentage: number): string => {
  if (percentage >= 70) return 'hot';
  if (percentage >= 50) return 'warm';
  if (percentage >= 30) return 'cool';
  return 'cold';
};

export default StatsDisplay;
