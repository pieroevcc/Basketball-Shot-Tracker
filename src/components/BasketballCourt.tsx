import React, { useState } from 'react';
import { Shot, ZONES, COURT_WIDTH, COURT_HEIGHT } from '../types';
import './BasketballCourt.css';

interface BasketballCourtProps {
  onShotRecorded: (shot: Shot, zone: string) => void;
  shots: Shot[];
  maxShots?: number;
  onUndo?: () => void;
}

const BasketballCourt: React.FC<BasketballCourtProps> = ({
  onShotRecorded,
  shots,
  maxShots,
  onUndo,
}) => {
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  const isLocked = maxShots !== undefined && shots.length >= maxShots;

  const getZoneAtCoordinates = (x: number, y: number): string | null => {
    // Paint zone (Zone 1)
    if (x >= 175 && x <= 325 && y >= 0 && y <= 220) {
      return 'Zone 1: Paint';
    }

    const arcCenterX = 250;
    const arcCenterY = 170;
    const arcRX = 210;
    const arcRY = 167;
    const ellipseVal = 
      Math.pow((x - arcCenterX) / arcRX, 2) + 
      Math.pow((y - arcCenterY) / arcRY, 2);
    const insideMidRangeArc = ellipseVal <= 1 && y >= 170;

    //Zone 2: Left Mid-Range
    if (y < 190) {
      if (x >= 40 && x < 175) return 'Zone 2: Left Mid-Range';
      if (x > 325 && x <= 460) return 'Zone 3: Right Mid-Range';
      if (x < 40) return 'Zone 4: Left Outside';  // ← this is fine
      if (x > 460) return 'Zone 6: Right Outside'; // ← this is fine

    }  

    // Zone 5: Top of Key
    // Trapezoid: top edge x=145-360 at y=315, bottom edge x=100-400 at y=470
    if (y >= 315 && y <= 470) {
      const t = (y - 315) / (470 - 315);
      const leftBound = 145 - t * (145 - 100);   // 145 → 100
      const rightBound = 360 + t * (400 - 360);  // 360 → 400
      if (x >= leftBound && x <= rightBound && !insideMidRangeArc) {
        return 'Zone 5: Top of Key';
      }
    }

    if (insideMidRangeArc) {
      if (x >= 40 && x <= 250) return 'Zone 2: Left Mid-Range';
      if (x > 250 && x <= 460) return 'Zone 3: Right Mid-Range';
    }

    // Zone 4 Part 1: Far left rectangle
    if (x >= 0 && x < 40 && y >= 0 && y < 190) {
      return 'Zone 4: Left Outside';
    }

    // Zone 4 Part 2: Arc slice (from x=40 leftward, bounded by the arc down to y=315)
    // Arc goes from (40, 190) to (145, 315) with rx=220, ry=190
    if (!insideMidRangeArc && y >= 190 && y < 315 && x < 145) {
      return 'Zone 4: Left Outside';
    }

    // Zone 4 Part 3: Bottom left trapezoid
    // Left edge: x=0, right edge interpolates from x=145 (y=315) to x=100 (y=470)
    const leftTrapRight = 145 - ((y - 315) / (470 - 315)) * (145 - 100);
    if (y >= 315 && y <= 470 && x >= 0 && x < leftTrapRight) {
      return 'Zone 4: Left Outside';
    }

    // Zone 6 Part 1: Far right rectangle
    if (x > 460 && x <= 500 && y >= 0 && y < 190) {
      return 'Zone 6: Right Outside';
    }

    // Zone 6 Part 2: Arc slice
    if (!insideMidRangeArc && y >= 190 && y < 315 && x >= 250) {
      return 'Zone 6: Right Outside';
    }

    // Zone 6 Part 3: Bottom right trapezoid
    const rightTrapLeft = 360 + ((y - 315) / (470 - 315)) * (400 - 360);
    if (y >= 315 && y <= 470 && x > rightTrapLeft && x <= 500) {
      return 'Zone 6: Right Outside';
    }

    return null;
  };



  const handleCourtClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isLocked) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * COURT_WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * COURT_HEIGHT;

    const zone = getZoneAtCoordinates(x, y);
    if (zone) {
      setSelectedZone(zone);
    }
  };

  const recordShot = (made: boolean) => {
    if (selectedZone) {
      const shot: Shot = {
        id: `shot-${Date.now()}`,
        x: ZONES[selectedZone as keyof typeof ZONES].x,
        y: ZONES[selectedZone as keyof typeof ZONES].y,
        made,
        timestamp: Date.now(),
        zone: selectedZone,
      };
      onShotRecorded(shot, selectedZone);
      setSelectedZone(null);
    }
  };

  const getHeatmapColor = (zone: string): string => {
    const zoneShots = shots.filter((s) => s.zone === zone);
    if (zoneShots.length === 0) return 'rgba(255, 255, 255, 0.1)';

    const percentage = (zoneShots.filter((s) => s.made).length / zoneShots.length) * 100;

    if (percentage >= 70) return 'rgba(0, 255, 0, 0.3)'; // Green for hot zones
    if (percentage >= 50) return 'rgba(255, 255, 0, 0.3)'; // Yellow for warm zones
    if (percentage >= 30) return 'rgba(255, 165, 0, 0.3)'; // Orange for cooler zones
    return 'rgba(255, 0, 0, 0.3)'; // Red for cold zones
  };

  return (
    <div className="court-container">
      {maxShots !== undefined && (
        <div className="shot-counter">
          {shots.length} / {maxShots} shots
          {isLocked && <span className="shot-counter-done"> — Done!</span>}
        </div>
      )}

      <div className="court-svg-wrapper-interactive">
        <svg
          width="500"
          height="470"
          viewBox={`0 0 ${COURT_WIDTH} ${COURT_HEIGHT}`}
          onClick={handleCourtClick}
          className={`basketball-court${isLocked ? ' court-locked' : ''}`}
        >
          {/* Court background */}
          <rect width={COURT_WIDTH} height={COURT_HEIGHT} fill="#d2691e" stroke="#fff" strokeWidth="3" />

          {/* Zone 1: Paint (center top rectangle - blue in reference image) */}
          <rect
            x="175"
            y="0"
            width="150"
            height="220"
            fill={getHeatmapColor('Zone 1: Paint')}
            stroke="#fff"
            strokeWidth="3"
            className="zone"
          />

          {/* Zone 2: Left Mid-Range (left side of semi-circle - orange in reference) */}
          <path
            d="M 40 0 L 40 190 A 220 190 0 0 0 250 340 L 250 290 L 250 220 L 175 220 L 175 0 Z"
            fill={getHeatmapColor('Zone 2: Left Mid-Range')}
            stroke="#fff"
            strokeWidth="3"
            className="zone"
          />

          {/* Zone 3: Right Mid-Range (right side of semi-circle - orange in reference) */}
          <path
            d="M 325 0 L 325 220 L 250 220 L 250 290 L 250 340 A 220 190 0 0 0 460 190 L 460 0 Z"
            fill={getHeatmapColor('Zone 3: Right Mid-Range')}
            stroke="#fff"
            strokeWidth="3"
            className="zone"
          />

          {/* Zone 4: Left Outside (bottom left) */}
          <path
            d="M 0 0 L 0 470 L 150 470 L 100 470 L 145 315 A 220 190 0 0 1 40 190 L 40 0 L 0 0 Z"
            fill={getHeatmapColor('Zone 4: Left Outside')}
            stroke="#fff"
            strokeWidth="3"
            className="zone"
          />

          {/* Zone 5: Top of Key (bottom center - moved from top) */}
          <path
            d="M 100 470 L 145 315 A 220 190 0 0 0 360 315 L 400 470 L 100 470"
            fill={getHeatmapColor('Zone 5: Top of Key')}
            stroke="#fff"
            strokeWidth="3"
            className="zone"
          />

          {/* Zone 6: Right Outside (bottom right) */}
          <path
            d="M 460 0 L 500 0 L 500 470 L 350 470 L 400 470 L 360 315 A 220 190 0 0 0 460 190 L 460 0 Z"
            fill={getHeatmapColor('Zone 6: Right Outside')}
            stroke="#fff"
            strokeWidth="3"
            className="zone"
          />

          {/* Paint/Key rectangle outline */}
          <rect x="195" y="0" width="110" height="220" fill="none" stroke="#fff" strokeWidth="2" />

          {/* Basket, backboard at top , free throw circle*/}
          <line x1="220" y1="50" x2="280" y2="50" stroke="#fff" strokeWidth="2" />
          <circle cx="250" cy="60" r="7" fill="none" stroke="#fff" strokeWidth="2" />
          <path d="M 215 50 A 36 40 0 1 0 285 50 A 36 40 0 1 1 215 50 Z" fill="none" stroke="#fff" strokeWidth="3" />
          <path d="M 195 220 A 50 50 0 1 0 305 220 A 50 50 0 1 1 195 220 Z" fill="none" stroke="#fff" strokeWidth="3" />
          <path d="M 195 220 A 50 50 0 1 1 305 220" fill="none" stroke="#fff" strokeWidth="3" strokeDasharray="8 5" />

          {/* Backcourt outlines and Half Court */}
          <line x1="0" y1="300" x2="40" y2="300" stroke="#fff" strokeWidth="3" />
          <line x1="460" y1="300" x2="500" y2="300" stroke="#fff" strokeWidth="3" />
          <path d="M 200 470 A 30 30 0 0 1 300 470 Z" fill="none" stroke="#fff" strokeWidth="3" />
          <path d="M 227 470 A 20 20 0 0 1 273 470 Z" fill="none" stroke="#fff" strokeWidth="3" />

          {/* Shot markers */}
          {shots.map((shot) => (
            <circle
              key={shot.id}
              cx={shot.x}
              cy={shot.y}
              r="8"
              fill={shot.made ? '#00ff00' : '#ff0000'}
              stroke="#fff"
              strokeWidth="2"
              opacity="0.7"
            />
          ))}

          {/* Selected zone indicator */}
          {selectedZone && (
            <g>
              <text x="250" y="450" textAnchor="middle" fill="#fff" fontSize="20" fontWeight="bold">
                {selectedZone}
              </text>
            </g>
          )}
        </svg>

        {/* Locked overlay */}
        {isLocked && (
          <div className="court-locked-overlay">
            <div className="court-locked-message">
              <span className="locked-emoji">🏀</span>
              <span className="locked-text">Nice work!</span>
              <span className="locked-subtext">Waiting for your classmates to finish...</span>
            </div>
          </div>
        )}
      </div>

      {selectedZone && !isLocked && (
        <div className="shot-buttons">
          <button onClick={() => recordShot(true)} className="btn btn-made">
            Made 🎯
          </button>
          <button onClick={() => recordShot(false)} className="btn btn-missed">
            Missed ❌
          </button>
          <button onClick={() => setSelectedZone(null)} className="btn btn-cancel">
            Cancel
          </button>
        </div>
      )}

      {onUndo && shots.length > 0 && !isLocked && (
        <button className="btn btn-undo" onClick={onUndo}>
          ↩ Undo Last Shot
        </button>
      )}
    </div>
  );
};

export default BasketballCourt;