export interface Shot {
  id: string;
  x: number;
  y: number;
  made: boolean;
  timestamp: number;
  zone: string;
  studentId?: string;
  activity?: 'solo' | 'team';
}

export type SessionStatus =
  | 'lobby'
  | 'solo_active'
  | 'solo_review'
  | 'team_strategy'
  | 'team_active'
  | 'team_review'
  | 'ended';

export interface Session {
  sessionCode: string;
  status: SessionStatus;
  createdAt: number;
  hostDeviceId: string;
}

export interface Participant {
  studentId: string;
  name: string;
  joinedAt: number;
  teamId: string | null;
  soloShotsComplete: number;
  teamShotsComplete: number;
}

export interface Stats {
  totalShots: number;
  totalMade: number;
  shootingPercentage: number;
  byZone: Record<string, { made: number; total: number; percentage: number }>;
}

export const COURT_WIDTH = 500;
export const COURT_HEIGHT = 470;

// Define zones on the half-court (PAINT at TOP, BASELINE at BOTTOM)
// 6 zones covering the entire court:
// Zone 1: Paint (inside the restricted area at top)
// Zone 2: Left mid-range 
// Zone 3: Right mid-range
// Zone 5: Top of the key (rectangle at the arc)
// Zone 4: Left side outside mid-range (baseline corner area)
// Zone 6: Right side outside mid-range (baseline corner area)
export const ZONES = {
  'Zone 1: Paint': { x: 250, y: 95 },           // Paint area at top (0-190)
  'Zone 2: Left Mid-Range': { x: 125, y: 240 }, // Left mid-range (0-250 X, 190-290 Y)
  'Zone 3: Right Mid-Range': { x: 375, y: 240 }, // Right mid-range (250-500 X, 190-290 Y)
  'Zone 5: Top of Key': { x: 250, y: 320 },     // Top of key arc (150-350 X, 290-350 Y)
  'Zone 4: Left Outside': { x: 125, y: 410 },   // Left outside baseline (0-250 X, 350-470 Y)
  'Zone 6: Right Outside': { x: 375, y: 410 },  // Right outside baseline (250-500 X, 350-470 Y)
};

export const calculateStats = (shots: Shot[]): Stats => {
  const stats: Stats = {
    totalShots: shots.length,
    totalMade: shots.filter((s) => s.made).length,
    shootingPercentage: 0,
    byZone: {},
  };

  stats.shootingPercentage =
    stats.totalShots > 0 ? (stats.totalMade / stats.totalShots) * 100 : 0;

  // Group by zone
  Object.keys(ZONES).forEach((zone) => {
    const zoneShots = shots.filter((s) => s.zone === zone);
    const madeShotsInZone = zoneShots.filter((s) => s.made).length;
    stats.byZone[zone] = {
      made: madeShotsInZone,
      total: zoneShots.length,
      percentage: zoneShots.length > 0 ? (madeShotsInZone / zoneShots.length) * 100 : 0,
    };
  });

  return stats;
};
