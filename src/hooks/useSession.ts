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
  pairTeams: (code: string) => Promise<void>;
  assignGroups: (code: string) => Promise<void>;
  calculateRound1Winner: (code: string) => Promise<void>;
  saveShotAllocations: (code: string, allocations: ShotAllocation[]) => Promise<void>;
  saveSabotageActions: (code: string, actions: SabotageAction[]) => Promise<void>;
  kickParticipant: (code: string, studentId: string) => Promise<void>;

  // Student actions
  joinSession: (code: string, name: string, studentId: string) => Promise<void>;
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
  // Teacher action callbacks
  // ---------------------------------------------------------------------------

  const createSession = useCallback(async (): Promise<string> => {
    try {
      const code = await createSessionService();
      return code;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create session.';
      setError(message);
      throw err;
    }
  }, []);

  const advanceSession = useCallback(
    async (code: string, newStatus: SessionStatus): Promise<void> => {
      try {
        await advanceSessionService(code, newStatus);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to advance session.';
        setError(message);
        throw err;
      }
    },
    []
  );

  const pairTeams = useCallback(async (code: string): Promise<void> => {
    try {
      await pairTeamsService(code);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to pair teams.';
      setError(message);
      throw err;
    }
  }, []);

  const assignGroups = useCallback(async (code: string): Promise<void> => {
    try {
      await assignRound1GroupsService(code);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to assign groups.';
      setError(message);
      throw err;
    }
  }, []);

  const calculateRound1WinnerCb = useCallback(async (code: string): Promise<void> => {
    try {
      await calculateRound1WinnerService(code);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to calculate Round 1 winner.';
      setError(message);
      throw err;
    }
  }, []);

  const saveShotAllocations = useCallback(
    async (code: string, allocs: ShotAllocation[]): Promise<void> => {
      try {
        await saveShotAllocationsService(code, allocs);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save shot allocations.';
        setError(message);
        throw err;
      }
    },
    []
  );

  const saveSabotageActionsCb = useCallback(
    async (code: string, actions: SabotageAction[]): Promise<void> => {
      try {
        await saveSabotageActionsService(code, actions);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save sabotage actions.';
        setError(message);
        throw err;
      }
    },
    []
  );

  const kickParticipant = useCallback(async (code: string, sid: string): Promise<void> => {
    try {
      await removeParticipantService(code, sid);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to kick participant.';
      setError(message);
      throw err;
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Student action callbacks
  // ---------------------------------------------------------------------------

  const joinSession = useCallback(
    async (code: string, name: string, sid: string): Promise<void> => {
      try {
        await joinSessionService(code, name, sid);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to join session.';
        setError(message);
        throw err;
      }
    },
    []
  );

  const updateName = useCallback(
    async (code: string, sid: string, name: string): Promise<void> => {
      try {
        await updateParticipantNameService(code, sid, name);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update name.';
        setError(message);
        throw err;
      }
    },
    []
  );

  const addShot = useCallback(async (code: string, shot: Shot): Promise<void> => {
    try {
      await addSessionShotService(code, shot);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add shot.';
      setError(message);
      throw err;
    }
  }, []);

  const undoLastShot = useCallback(
    async (code: string, sid: string, activity: 'solo' | 'team'): Promise<void> => {
      try {
        await undoLastShotService(code, sid, activity);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to undo last shot.';
        setError(message);
        throw err;
      }
    },
    []
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
