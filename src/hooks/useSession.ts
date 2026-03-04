import { useState, useEffect, useCallback } from 'react';
import { Session, Participant, Shot, SessionStatus } from '../types';
import {
  createSession as createSessionService,
  advanceSession as advanceSessionService,
  pairTeams as pairTeamsService,
  joinSession as joinSessionService,
  updateParticipantName as updateParticipantNameService,
  addSessionShot as addSessionShotService,
  undoLastShot as undoLastShotService,
  subscribeToSession,
  subscribeToParticipants,
  subscribeToShots,
} from '../services/sessionService';

export interface UseSessionReturn {
  session: Session | null;
  participants: Participant[];
  myParticipant: Participant | null;
  shots: Shot[];
  teammateShots: Shot[];
  loading: boolean;
  error: string | null;

  // Teacher actions
  createSession: () => Promise<string>;
  advanceSession: (code: string, newStatus: SessionStatus) => Promise<void>;
  pairTeams: (code: string) => Promise<void>;

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
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to Firestore real-time updates whenever sessionCode changes
  useEffect(() => {
    if (!sessionCode) {
      setSession(null);
      setParticipants([]);
      setShots([]);
      return;
    }

    setLoading(true);
    setError(null);

    let sessionLoaded = false;
    let participantsLoaded = false;
    let shotsLoaded = false;

    function checkAllLoaded() {
      if (sessionLoaded && participantsLoaded && shotsLoaded) {
        setLoading(false);
      }
    }

    let unsubSession: (() => void) | undefined;
    let unsubParticipants: (() => void) | undefined;
    let unsubShots: (() => void) | undefined;

    try {
      unsubSession = subscribeToSession(sessionCode, (s) => {
        setSession(s);
        sessionLoaded = true;
        checkAllLoaded();
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to subscribe to session.';
      setError(message);
      setLoading(false);
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
      setLoading(false);
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
      setLoading(false);
    }

    return () => {
      unsubSession?.();
      unsubParticipants?.();
      unsubShots?.();
    };
  }, [sessionCode]);

  // Derived: myParticipant
  const myParticipant: Participant | null =
    studentId !== null
      ? participants.find((p) => p.studentId === studentId) ?? null
      : null;

  // Derived: teammateShots — shots where activity is 'team' and studentId matches the teammate
  const teammateShots: Shot[] = (() => {
    if (!myParticipant || !myParticipant.teamId) return [];
    const teammate = participants.find(
      (p) => p.teamId === myParticipant.teamId && p.studentId !== myParticipant.studentId
    );
    if (!teammate) return [];
    return shots.filter(
      (s) => s.studentId === teammate.studentId && s.activity === 'team'
    );
  })();

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
    loading,
    error,
    createSession,
    advanceSession,
    pairTeams,
    joinSession,
    updateName,
    addShot,
    undoLastShot,
  };
}
