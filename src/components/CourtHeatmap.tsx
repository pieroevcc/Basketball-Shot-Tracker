import React from 'react';
import { Shot, Stats, ZONES, COURT_WIDTH, COURT_HEIGHT } from '../types';
import './CourtHeatmap.css';

interface CourtHeatmapProps {
  shots: Shot[];
  stats: Stats;
  onZoneClick?: (zone: string) => void;
  selectedZones?: string[];
}

function getHeatmapColor(percentage: number, total: number): string {
  if (total === 0) return 'rgba(255, 255, 255, 0.08)';
  if (percentage >= 70) return 'rgba(0, 220, 0, 0.35)';
  if (percentage >= 50) return 'rgba(200, 220, 0, 0.35)';
  if (percentage >= 30) return 'rgba(255, 140, 0, 0.35)';
  return 'rgba(220, 30, 30, 0.35)';
}

const ZONE_PATHS: Record<string, React.ReactElement> = {
  'Zone 1: Paint': <rect x="175" y="0" width="150" height="220" />,
  'Zone 2: Left Mid-Range': (
    <path d="M 40 0 L 40 190 A 220 190 0 0 0 250 340 L 250 290 L 250 220 L 175 220 L 175 0 Z" />
  ),
  'Zone 3: Right Mid-Range': (
    <path d="M 325 0 L 325 220 L 250 220 L 250 290 L 250 340 A 220 190 0 0 0 460 190 L 460 0 Z" />
  ),
  'Zone 4: Left Outside': (
    <path d="M 0 0 L 0 470 L 150 470 L 100 470 L 145 315 A 220 190 0 0 1 40 190 L 40 0 L 0 0 Z" />
  ),
  'Zone 5: Top of Key': (
    <path d="M 100 470 L 145 315 A 220 190 0 0 0 360 315 L 400 470 L 100 470" />
  ),
  'Zone 6: Right Outside': (
    <path d="M 460 0 L 500 0 L 500 470 L 350 470 L 400 470 L 360 315 A 220 190 0 0 0 460 190 L 460 0 Z" />
  ),
};

const CourtHeatmap: React.FC<CourtHeatmapProps> = ({ shots, stats, onZoneClick, selectedZones }) => (
  <div className="court-heatmap">
    <div className="court-svg-wrapper">
      <svg
        viewBox={`0 0 ${COURT_WIDTH} ${COURT_HEIGHT}`}
        xmlns="http://www.w3.org/2000/svg"
        className="readonly-court"
      >
        <rect width={COURT_WIDTH} height={COURT_HEIGHT} fill="#d2691e" stroke="#fff" strokeWidth="3" />

        {Object.entries(ZONE_PATHS).map(([zone, shape]) => {
          const data = stats.byZone[zone] ?? { percentage: 0, total: 0 };
          const isSelected = selectedZones?.includes(zone);
          return (
            <g
              key={zone}
              onClick={onZoneClick ? () => onZoneClick(zone) : undefined}
              style={onZoneClick ? { cursor: 'pointer' } : undefined}
            >
              {React.cloneElement(shape, {
                fill: getHeatmapColor(data.percentage, data.total),
                stroke: isSelected ? '#f59e0b' : '#fff',
                strokeWidth: isSelected ? 6 : 3,
              })}
              {isSelected && React.cloneElement(shape, {
                fill: 'rgba(245, 158, 11, 0.25)',
                stroke: 'none',
                strokeWidth: 0,
              })}
            </g>
          );
        })}

        {/* Paint/Key rectangle outline */}
        <rect x="195" y="0" width="110" height="220" fill="none" stroke="#fff" strokeWidth="2" />
        {/* Basket & backboard */}
        <line x1="220" y1="50" x2="280" y2="50" stroke="#fff" strokeWidth="2" />
        <circle cx="250" cy="60" r="7" fill="none" stroke="#fff" strokeWidth="2" />
        <path d="M 215 50 A 36 40 0 1 0 285 50 A 36 40 0 1 1 215 50 Z" fill="none" stroke="#fff" strokeWidth="3" />
        <path d="M 195 220 A 50 50 0 1 0 305 220 A 50 50 0 1 1 195 220 Z" fill="none" stroke="#fff" strokeWidth="3" />
        <path d="M 195 220 A 50 50 0 1 1 305 220" fill="none" stroke="#fff" strokeWidth="3" strokeDasharray="8 5" />
        {/* Backcourt lines */}
        <line x1="0" y1="300" x2="40" y2="300" stroke="#fff" strokeWidth="3" />
        <line x1="460" y1="300" x2="500" y2="300" stroke="#fff" strokeWidth="3" />
        <path d="M 200 470 A 30 30 0 0 1 300 470 Z" fill="none" stroke="#fff" strokeWidth="3" />
        <path d="M 227 470 A 20 20 0 0 1 273 470 Z" fill="none" stroke="#fff" strokeWidth="3" />

        {/* Zone number watermarks */}
        {Object.entries(ZONES).map(([zone, pos]) => {
          const zoneNum = zone.split(':')[0].replace('Zone ', '');
          let x = pos.x as number;
          let y = (pos.y as number) - 8;
          if (zoneNum === '1') { x = 250; y = 140; }
          if (zoneNum === '2') { x = 110; y = 180; }
          if (zoneNum === '3') { x = 390; y = 180; }
          if (zoneNum === '4') { x = 50; y = 420; }
          if (zoneNum === '5') { x = 250; y = 440; }
          if (zoneNum === '6') { x = 450; y = 420; }

          return (
            <text
              key={`watermark-${zone}`}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="rgba(255, 255, 255, 0.45)"
              fontSize="72"
              fontWeight="900"
              pointerEvents="none"
            >
              {zoneNum}
            </text>
          );
        })}

        {/* Shot markers */}
        {shots.map((shot) => {
          const pos = ZONES[shot.zone as keyof typeof ZONES];
          const cx = pos?.x ?? shot.x;
          const cy = pos?.y ?? shot.y;
          return (
            <circle
              key={shot.id}
              cx={cx}
              cy={cy}
              r="8"
              fill={shot.made ? '#00ff00' : '#ff0000'}
              stroke="#fff"
              strokeWidth="2"
              opacity="0.7"
            />
          );
        })}

        {/* Zone percentage labels */}
        {Object.entries(stats.byZone).map(([zone, data]) => {
          const pos = ZONES[zone as keyof typeof ZONES];
          if (!pos || data.total === 0) return null;

          const zoneName = zone.split(': ')[1] || zone;

          return (
            <g key={zone}>
              <rect x={pos.x - 36} y={pos.y - 24} width="72" height="38" rx="5" fill="rgba(0,0,0,0.65)" />
              <text
                x={pos.x}
                y={pos.y - 10}
                textAnchor="middle"
                fill="white"
                fontSize="16"
                fontWeight="700"
                style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}
              >
                {data.percentage.toFixed(0)}%
              </text>
              <text
                x={pos.x}
                y={pos.y + 6}
                textAnchor="middle"
                fill="rgba(255,255,255,0.9)"
                fontSize="11"
                fontWeight="700"
                style={{ textShadow: '1px 1px 3px rgba(0,0,0,0.9)' }}
              >
                {zoneName}
              </text>
            </g>
          );
        })}
      </svg>
    </div>

    <div className="heatmap-legend-container">
      <h3>🔥 HEATMAP LEGEND</h3>
      <div className="heatmap-legend">
        <span className="legend-item hot">≥70% Hot</span>
        <span className="legend-item warm">50–69% Warm</span>
        <span className="legend-item cool">30–49% Cool</span>
        <span className="legend-item cold">&lt;30% Cold</span>
      </div>
    </div>
  </div>
);

export default CourtHeatmap;
