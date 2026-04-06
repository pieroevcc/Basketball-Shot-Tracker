import React from 'react';
import { Stats } from '../types';
import './StatsDisplay.css';

interface StatsDisplayProps {
  stats: Stats;
  headerNode?: React.ReactNode;
}

const StatsDisplay: React.FC<StatsDisplayProps> = ({ stats, headerNode }) => {
  return (
    <div className="stats-container">
      <div className="overall-stats-group">
        <div className="overall-stats-header">
          <h2>📊 OVERALL STATS</h2>
          {headerNode && <div className="stats-actions">{headerNode}</div>}
        </div>
        <div className="overall-stats">
          <div className="stat-item">
            <span>Total Shots</span>
            <strong>{stats.totalShots}</strong>
          </div>
          <div className="stat-item">
            <span>Made</span>
            <strong>{stats.totalMade}</strong>
          </div>
          <div className="stat-item">
            <span>Shoot %</span>
            <strong>{stats.shootingPercentage.toFixed(1)}%</strong>
          </div>
          <div className="stat-item">
            <span>PTS/Shot</span>
            <strong>{stats.pointsPerShot.toFixed(1)}</strong>
          </div>
        </div>
        <div className="stat-item">
          <span>Total Points:</span>
          <strong>{stats.totalPoints}</strong>
        </div>
      </div>

      <div className="zone-stats">
        <h2>📍 ZONE BREAKDOWN</h2>
        <div className="zone-list">
          {Object.entries(stats.byZone).map(([zone, data]) => (
            <div key={zone} className="zone-row">
              <div className="zone-row-header">
                <div className="zone-name">{zone} <span className="zone-pct">({data.percentage.toFixed(0)}%)</span></div>
                <div className="zone-metrics">{data.pointsPerShot.toFixed(1)} pts/shot | {data.made}/{data.total}</div>
              </div>
              <div className="zone-bar-bg">
                 <div className={`zone-bar-fill ${getHotColdClass(data.percentage)}`} style={{ width: `${data.percentage}%` }}></div>
              </div>

            </div>
          ))}
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
