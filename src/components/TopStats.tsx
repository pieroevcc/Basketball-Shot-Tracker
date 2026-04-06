import React from 'react';
import { Stats } from '../types';
import './TopStats.css';

interface TopStatsProps {
  stats: Stats;
}

const TopStats: React.FC<TopStatsProps> = ({ stats }) => {
  return (
    <div className="top-stats-container">
      <div className="top-stat-card card-yellow">
        <div className="stat-label">SHOTS TAKEN</div>
        <div className="stat-value">{stats.totalShots}</div>
        <div className="stat-sub">total attempts</div>
      </div>
      <div className="top-stat-card card-green">
        <div className="stat-label">POINTS</div>
        <div className="stat-value">{stats.totalPoints}</div>
        <div className="stat-sub">total scored</div>
      </div>
      <div className="top-stat-card card-blue">
        <div className="stat-label">FIELD GOAL %</div>
        <div className="stat-value">{stats.shootingPercentage.toFixed(0)}%</div>
        <div className="stat-sub">makes / attempts</div>
      </div>
    </div>
  );
};

export default TopStats;
