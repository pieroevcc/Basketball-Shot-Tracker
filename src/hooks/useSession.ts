import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Session,
  Participant,
  Shot,
  SessionStatus,
  ShotAllocation,
  SabotageAction,
  getBlockedZones,
  getEffectiveMaxShots,
} from '../types';
import {
  createSession as createSessionService,
  advanceSession as advanceSessionService,
  pairTeams as pairTeamsService,
  assignRound1Groups as assignRound1GroupsService,
  joinSession as joinSessionService,
  updateParticipantName as updateParticipantNameService,
  removeParticipant as removeParticipantService,
  addSessionShot as addSessionShotService,
  undoLastShot as undoLastShotService,
  saveShotAllocations as saveShotAllocationsService,
  saveSabotageActions as saveSabotageActionsService,
  calculateRound1Winner as calculateRound1WinnerService,
  subscribeToSession,
  subscribeToParticipants,
  subscribeToShots,
  subscribeToAllocations,
  subscribeToSabotages,
} from '../services/sessionService';

export interface UseSessionReturn {
  session: Session | null;
  participants: Participant[];
  myParticipant: Participant | null;
  shots: Shot[];
  teammateShots: Shot[];
  allocations: ShotAllocation[];
  sabotageActions: SabotageAction[];
  loading: boolean;
  error: string | null;

  // Derived values
  myGroupMembers: Participant[];
  myTeamMembers: Participant[];
  opponentTeam: Participant[];
  blockedZones: string[];
  myAllocatedShots: number;
  round1Leaderboard: Participant[];

  // Teacher actions
  createSession: () => Promise<string>;
  advanceSession: (code: string, newStatus: SessionStatus) => Promise<void>;
  pairTeams: (code: string, assignments?: Record<string, string>) => Promise<void>;
  assignGroups: (code: string) => Promise<void>;
  calculateRound1Winner: (code: string) => Promise<void>;
  saveShotAllocations: (code: string, allocations: ShotAllocation[]) => Promise<void>;
  saveSabotageActions: (code: string, actions: SabotageAction[]) => Promise<void>;
  kickParticipant: (code: string, studentId: string) => Promise<void>;

  // Student actions
  joinSession: (code: string, name: string, studentId: string) => Promise<{ studentId: string; rejoined: boolean }>;
  updateName: (code: string, studentId: string, name: string) => Promise<void>;
  addShot: (code: string, shot: Shot) => Promise<void>;
  undoLastShot: (code: string, studentId: string, activity: 'solo' | 'team') => Promise<void>;
}

export function useSession(
  sessionCode: string | null,
  studentId: string | null
): UseSessionReturn {
  const [session, setSession] = useState<Session | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [shots, setShots] = useState<Shot[]>([]);
  const [allocations, setAllocations] = useState<ShotAllocation[]>([]);
  const [sabotageActions, setSabotageActions] = useState<SabotageAction[]>([]);
  // loadedCode tracks the last sessionCode for which all three subscriptions
  // have fired. `loading` is derived: true whenever sessionCode doesn't match
  // loadedCode. This makes `loading` immediately true when sessionCode changes,
  // with no effect-timing gap that could cause premature handleReturnHome() calls.
  const [loadedCode, setLoadedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loading = sessionCode !== null && loadedCode !== sessionCode;

  // Subscribe to Firestore real-time updates whenever sessionCode changes
  useEffect(() => {
    if (!sessionCode) {
      setSession(null);
      setParticipants([]);
      setShots([]);
      setAllocations([]);
      setSabotageActions([]);
      setLoadedCode(null);
      setError(null);
      return;
    }

    setError(null);

    let sessionLoaded = false;
    let participantsLoaded = false;
    let shotsLoaded = false;

    function checkAllLoaded() {
      if (sessionLoaded && participantsLoaded && shotsLoaded) {
        setLoadedCode(sessionCode);
      }
    }

    let unsubSession: (() => void) | undefined;
    let unsubParticipants: (() => void) | undefined;
    let unsubShots: (() => void) | undefined;
    let unsubAllocations: (() => void) | undefined;
    let unsubSabotages: (() => void) | undefined;

    try {
      unsubSession = subscribeToSession(sessionCode, (s) => {
        setSession(s); // s may be null if session document does not exist
        sessionLoaded = true;
        checkAllLoaded();
      }, (err) => {
        setError(err.message);
        setLoadedCode(sessionCode);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to subscribe to session.';
      setError(message);
      setLoadedCode(sessionCode);
      return;
    }

    try {
      unsubParticipants = subscribeToParticipants(sessionCode, (p) => {
        setParticipants(p);
        participantsLoaded = true;
        checkAllLoaded();
      }, (err) => {
        setError(err.message);
        setLoadedCode(sessionCode);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to subscribe to participants.';
      setError(message);
      setLoadedCode(sessionCode);
    }

    try {
      unsubShots = subscribeToShots(sessionCode, (s) => {
        setShots(s);
        shotsLoaded = true;
        checkAllLoaded();
      }, (err) => {
        setError(err.message);
        setLoadedCode(sessionCode);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to subscribe to shots.';
      setError(message);
      setLoadedCode(sessionCode);
    }

    try {
      unsubAllocations = subscribeToAllocations(sessionCode, (a) => {
        setAllocations(a);
      });
    } catch (err) {
      console.warn('Failed to subscribe to allocations:', err);
    }

    try {
      unsubSabotages = subscribeToSabotages(sessionCode, (s) => {
        setSabotageActions(s);
      });
    } catch (err) {
      console.warn('Failed to subscribe to sabotages:', err);
    }

    return () => {
      unsubSession?.();
      unsubParticipants?.();
      unsubShots?.();
      unsubAllocations?.();
      unsubSabotages?.();
    };
  }, [sessionCode]);

  // Derived: myParticipant
  const myParticipant: Participant | null =
    studentId !== null
      ? participants.find((p) => p.studentId === studentId) ?? null
      : null;

  // Derived: teammateShots — shots from all teammates in the team activity
  const teammateShots: Shot[] = useMemo(() => {
    if (!myParticipant || !myParticipant.teamId) return [];
    const teammateIds = participants
      .filter((p) => p.teamId === myParticipant.teamId && p.studentId !== myParticipant.studentId)
      .map((p) => p.studentId);
    return shots.filter(
      (s) => teammateIds.includes(s.studentId ?? '') && s.activity === 'team'
    );
  }, [myParticipant, participants, shots]);

  // Derived: myGroupMembers — participants in the same Round 1 group
  const myGroupMembers: Participant[] = useMemo(() => {
    if (!myParticipant || !myParticipant.groupId) return [];
    return participants.filter((p) => p.groupId === myParticipant.groupId);
  }, [myParticipant, participants]);

  // Derived: myTeamMembers — participants in the same team (including self)
  const myTeamMembers: Participant[] = useMemo(() => {
    if (!myParticipant || !myParticipant.teamId) return [];
    return participants.filter((p) => p.teamId === myParticipant.teamId);
  }, [myParticipant, participants]);

  // Derived: opponentTeam — participants on a different team
  const opponentTeam: Participant[] = useMemo(() => {
    if (!myParticipant || !myParticipant.teamId) return [];
    return participants.filter(
      (p) => p.teamId !== null && p.teamId !== myParticipant.teamId
    );
  }, [myParticipant, participants]);

  // Derived: blockedZones — zones blocked for my team by opponent sabotage
  const blockedZones: string[] = useMemo(() => {
    if (!myParticipant || !myParticipant.teamId) return [];
    return getBlockedZones(myParticipant.teamId, sabotageActions);
  }, [myParticipant, sabotageActions]);

  // Derived: myAllocatedShots — effective max shots for Round 2
  const myAllocatedShots: number = useMemo(() => {
    if (!myParticipant) return 20;
    return getEffectiveMaxShots(myParticipant, sabotageActions, 20);
  }, [myParticipant, sabotageActions]);

  // Derived: round1Leaderboard — participants sorted by round1Score descending
  const round1Leaderboard: Participant[] = useMemo(() => {
    return [...participants]
      .filter((p) => p.round1Score !== undefined)
      .sort((a, b) => (b.round1Score ?? 0) - (a.round1Score ?? 0));
  }, [participants]);

  // ---------------------------------------------------------------------------
  // Action callbacks — all share the same handling: surface the error message
  // via setError, then rethrow so callers can still react.
  // ---------------------------------------------------------------------------

  const run = useCallback(
    async <T,>(fallback: string, fn: () => Promise<T>): Promise<T> => {
      try {
        return await fn();
      } catch (err) {
        setError(err instanceof Error ? err.message : fallback);
        throw err;
      }
    },
    []
  );

  // Teacher actions
  const createSession = useCallback(
    () => run('Failed to create session.', () => createSessionService()),
    [run]
  );
  const advanceSession = useCallback(
    (code: string, newStatus: SessionStatus) =>
      run('Failed to advance session.', () => advanceSessionService(code, newStatus)),
    [run]
  );
  const pairTeams = useCallback(
    (code: string, assignments?: Record<string, string>) =>
      run('Failed to pair teams.', () => pairTeamsService(code, assignments)),
    [run]
  );
  const assignGroups = useCallback(
    (code: string) => run('Failed to assign groups.', () => assignRound1GroupsService(code)),
    [run]
  );
  const calculateRound1WinnerCb = useCallback(
    (code: string) =>
      run('Failed to calculate Round 1 winner.', () => calculateRound1WinnerService(code)),
    [run]
  );
  const saveShotAllocations = useCallback(
    (code: string, allocs: ShotAllocation[]) =>
      run('Failed to save shot allocations.', () => saveShotAllocationsService(code, allocs)),
    [run]
  );
  const saveSabotageActionsCb = useCallback(
    (code: string, actions: SabotageAction[]) =>
      run('Failed to save sabotage actions.', () => saveSabotageActionsService(code, actions)),
    [run]
  );
  const kickParticipant = useCallback(
    (code: string, sid: string) =>
      run('Failed to kick participant.', () => removeParticipantService(code, sid)),
    [run]
  );

  // Student actions
  const joinSession = useCallback(
    (code: string, name: string, sid: string) =>
      run('Failed to join session.', () => joinSessionService(code, name, sid)),
    [run]
  );
  const updateName = useCallback(
    (code: string, sid: string, name: string) =>
      run('Failed to update name.', () => updateParticipantNameService(code, sid, name)),
    [run]
  );
  const addShot = useCallback(
    (code: string, shot: Shot) =>
      run('Failed to add shot.', () => addSessionShotService(code, shot)),
    [run]
  );
  const undoLastShot = useCallback(
    (code: string, sid: string, activity: 'solo' | 'team') =>
      run('Failed to undo last shot.', () => undoLastShotService(code, sid, activity)),
    [run]
  );

  return {
    session,
    participants,
    myParticipant,
    shots,
    teammateShots,
    allocations,
    sabotageActions,
    loading,
    error,

    // Derived
    myGroupMembers,
    myTeamMembers,
    opponentTeam,
    blockedZones,
    myAllocatedShots,
    round1Leaderboard,

    // Teacher actions
    createSession,
    advanceSession,
    pairTeams,
    assignGroups,
    calculateRound1Winner: calculateRound1WinnerCb,
    saveShotAllocations,
    saveSabotageActions: saveSabotageActionsCb,
    kickParticipant,
    joinSession,
    updateName,
    addShot,
    undoLastShot,
  };
}
