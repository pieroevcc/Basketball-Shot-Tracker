export interface Shot {
  id: string;
  x: number;
  y: number;
  made: boolean;
  timestamp: number;
  zone: string;
  studentId?: string;
  activity?: 'solo' | 'team';
  points?: number; // 0 if missed, ZONE_POINTS[zone] if made
}

export type SessionStatus =
  | 'lobby'
  | 'solo_active'
  | 'solo_review'
  | 'team_strategy'
  | 'shot_allocation'
  | 'sabotage'
  | 'team_active'
  | 'team_review'
  | 'ended';

export interface Session {
  sessionCode: string;
  status: SessionStatus;
  createdAt: number;
  hostDeviceId: string;
  round1Winner?: string; // studentId of Round 1 individual winner
  teacherDisconnected?: boolean; // set when teacher closes/reloads page
  teacherLastSeen?: number;      // Unix ms, updated by teacher heartbeat every 30 s
}

export interface Participant {
  studentId: string;
  name: string;
  joinedAt: number;
  teamId: string | null;
  groupId: string | null; // Round 1 display group (groups of 4)
  soloShotsComplete: number;
  teamShotsComplete: number;
  allocatedShots?: number; // Round 2 shot allocation
  round1Score?: number; // Cached total points from Round 1
}

export interface Stats {
  totalShots: number;
  totalMade: number;
  totalPoints: number;
  pointsPerShot: number;
  shootingPercentage: number;
  byZone: Record<string, { made: number; total: number; percentage: number; points: number; pointsPerShot: number }>;
}

export interface ShotAllocation {
  teamId: string;
  studentId: string;
  allocatedShots: number;
}

export interface SabotageAction {
  id: string;
  actingTeamId: string;
  targetTeamId: string;
  type: 'block_zone' | 'remove_shots' | 'add_shots';
  blockedZone?: string;
  targetStudentId?: string;
  shotDelta?: number;
  timestamp: number;
}

export const COURT_WIDTH = 500;
export const COURT_HEIGHT = 470;

// Zone-based scoring: closer zones = fewer points, farther = more
export const ZONE_POINTS: Record<string, number> = {
  'Zone 1: Paint': 1,
  'Zone 2: Left Mid-Range': 2,
  'Zone 3: Right Mid-Range': 2,
  'Zone 4: Left Outside': 3,
  'Zone 5: Top of Key': 3,
  'Zone 6: Right Outside': 3,
};

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
  'Zone 5: Top of Key': { x: 250, y: 410 },     // Top of key arc (150-350 X, 290-350 Y)
  'Zone 4: Left Outside': { x: 55, y: 360 },    // Left outside baseline (0-250 X, 350-470 Y)
  'Zone 6: Right Outside': { x: 445, y: 360 },  // Right outside baseline (250-500 X, 350-470 Y)
};

export const calculateStats = (shots: Shot[]): Stats => {
  const stats: Stats = {
    totalShots: shots.length,
    totalMade: shots.filter((s) => s.made).length,
    totalPoints: 0,
    pointsPerShot: 0,
    shootingPercentage: 0,
    byZone: {},
  };

  stats.shootingPercentage =
    stats.totalShots > 0 ? (stats.totalMade / stats.totalShots) * 100 : 0;

  // Group by zone
  Object.keys(ZONES).forEach((zone) => {
    const zoneShots = shots.filter((s) => s.zone === zone);
    const madeShotsInZone = zoneShots.filter((s) => s.made).length;
    // Zones 4, 5, 6 are 3-pointers; others are 2-pointers
    const is3Pt = ['Zone 4: Left Outside', 'Zone 5: Top of Key', 'Zone 6: Right Outside'].includes(zone);
    const ptsValue = is3Pt ? 3 : 2;
    const zonePoints = madeShotsInZone * ptsValue;
    
    stats.totalPoints += zonePoints;

    stats.byZone[zone] = {
      made: madeShotsInZone,
      total: zoneShots.length,
      percentage: zoneShots.length > 0 ? (madeShotsInZone / zoneShots.length) * 100 : 0,
      points: zonePoints,
      pointsPerShot: zoneShots.length > 0 ? (zonePoints / zoneShots.length) : 0,
    };
  });
  
  stats.pointsPerShot = stats.totalShots > 0 ? (stats.totalPoints / stats.totalShots) : 0;

  stats.totalPoints = Object.values(stats.byZone).reduce((sum, z) => sum + z.points, 0);

  return stats;
};

export const calculateScore = (shots: Shot[]): number => {
  return shots.reduce(
    (sum, s) => sum + (s.points ?? (s.made ? (ZONE_POINTS[s.zone] ?? 0) : 0)),
    0
  );
};

export const getBlockedZones = (teamId: string, sabotageActions: SabotageAction[]): string[] => {
  return sabotageActions
    .filter((a) => a.targetTeamId === teamId && a.type === 'block_zone' && a.blockedZone)
    .map((a) => a.blockedZone!);
};

export const getEffectiveMaxShots = (
  participant: Participant,
  sabotageActions: SabotageAction[],
  defaultMax: number = 20
): number => {
  const allocated = participant.allocatedShots ?? defaultMax;
  const delta = sabotageActions
    .filter(
      (a) =>
        a.targetStudentId === participant.studentId &&
        (a.type === 'remove_shots' || a.type === 'add_shots')
    )
    .reduce((sum, a) => sum + (a.shotDelta ?? 0), 0);
  return Math.max(0, allocated + delta);
};
