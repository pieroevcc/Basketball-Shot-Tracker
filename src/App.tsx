import { useState, useEffect, useRef } from 'react';
import BasketballCourt from './components/BasketballCourt';
import StatsDisplay from './components/StatsDisplay';
import CourtHeatmap from './components/CourtHeatmap';
import SessionJoin from './components/SessionJoin';
import SessionCreate from './components/SessionCreate';
import Lobby from './components/Lobby';
import TeacherLobby from './components/TeacherLobby';
import TeamStrategy from './components/TeamStrategy';
import TeamReview from './components/TeamReview';
import SessionEnded from './components/SessionEnded';
import ShotAllocationPanel from './components/ShotAllocationPanel';
import SabotagePanel from './components/SabotagePanel';
import TestMode from './components/TestMode';
import PracticeMode from './components/PracticeMode';
import { useSession } from './hooks/useSession';
import { markTeacherDisconnected, updateTeacherHeartbeat } from './services/sessionService';
import { Shot, calculateStats } from './types';

import './App.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type AppMode = 'session' | 'practice' | 'test' | null;
type AppRole = 'student' | 'teacher';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function readLocalStorage(key: string): string | null {
  return localStorage.getItem(key);
}

function clearSessionStorage() {
  localStorage.removeItem('sessionCode');
  localStorage.removeItem('studentId');
  localStorage.removeItem('studentName');
  localStorage.removeItem('appRole');
  localStorage.removeItem('appMode');
  localStorage.removeItem('hostDeviceId');
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
function App() {
  // ---- App-level state (persisted in localStorage) ----
  const [appMode, setAppMode] = useState<AppMode>(
    () => (readLocalStorage('appMode') as AppMode) ?? 'session'
  );
  const [role, setRole] = useState<AppRole>(
    () => (readLocalStorage('appRole') as AppRole) ?? 'student'
  );
  const [sessionCode, setSessionCode] = useState<string | null>(
    () => readLocalStorage('sessionCode')
  );
  const [studentId, setStudentId] = useState<string | null>(
    () => readLocalStorage('studentId')
  );

  // ---- Session mode state ----
  const {
    session,
    participants,
    myParticipant,
    shots,
    teammateShots,
    allocations,
    sabotageActions,
    loading,
    error,
    blockedZones,
    myAllocatedShots,
    round1Leaderboard: _round1Leaderboard,
    createSession,
    advanceSession,
    pairTeams,
    assignGroups,
    calculateRound1Winner,
    saveShotAllocations,
    saveSabotageActions,
    kickParticipant,
    joinSession,
    updateName,
    addShot,
    undoLastShot,
  } = useSession(appMode === 'session' ? sessionCode : null, studentId);

  // Ref so interval callbacks always see the latest session without resetting the timer.
  const sessionRef = useRef(session);
  useEffect(() => { sessionRef.current = session; }, [session]);

  // Sync state to localStorage
  useEffect(() => {
    if (appMode) localStorage.setItem('appMode', appMode);
    else localStorage.removeItem('appMode');
  }, [appMode]);

  useEffect(() => {
    localStorage.setItem('appRole', role);
  }, [role]);

  useEffect(() => {
    if (sessionCode) localStorage.setItem('sessionCode', sessionCode);
    else localStorage.removeItem('sessionCode');
  }, [sessionCode]);

  useEffect(() => {
    if (studentId) localStorage.setItem('studentId', studentId);
    else localStorage.removeItem('studentId');
  }, [studentId]);

  // When teacher closes or reloads the page, mark session as disconnected so
  // students are kicked out via the onSnapshot listener.
  useEffect(() => {
    if (role !== 'teacher' || !sessionCode) return;
    const handleBeforeUnload = () => markTeacherDisconnected(sessionCode);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [role, sessionCode]);

  // Teacher heartbeat — writes teacherLastSeen to Firestore every 30 s so
  // students can detect a dead session even if beforeunload didn't fire.
  useEffect(() => {
    if (role !== 'teacher' || !sessionCode) return;
    updateTeacherHeartbeat(sessionCode);
    const id = setInterval(() => updateTeacherHeartbeat(sessionCode), 30_000);
    return () => clearInterval(id);
  }, [role, sessionCode]);

  const TEACHER_TIMEOUT_MS = 60_000; // 2× heartbeat interval

  // Fires on every session snapshot — catches reload-into-dead-session immediately.
  useEffect(() => {
    if (role !== 'student' || !session) return;
    const gone =
      !!session.teacherDisconnected ||
      (session.teacherLastSeen !== undefined &&
        Date.now() - session.teacherLastSeen > TEACHER_TIMEOUT_MS);
    if (gone) handleReturnHome();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, session?.teacherDisconnected, session?.teacherLastSeen]);

  // Fires every 15 s — catches the case where session stops updating
  // (teacher gone, no more snapshots to drive the effect above).
  useEffect(() => {
    if (role !== 'student' || !sessionCode) return;
    const id = setInterval(() => {
      const s = sessionRef.current;
      if (!s) return;
      const gone =
        !!s.teacherDisconnected ||
        (s.teacherLastSeen !== undefined &&
          Date.now() - s.teacherLastSeen > TEACHER_TIMEOUT_MS);
      if (gone) handleReturnHome();
    }, 5_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, sessionCode]);

  // If a student reloads into a session that no longer exists in Firestore,
  // redirect home instead of showing a stale join form.
  useEffect(() => {
    if (loading || !sessionCode || role !== 'student') return;
    if (session === null) handleReturnHome();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session, sessionCode, role]);

  // If a student is kicked by the teacher, their participant is marked kicked: true.
  // Detect that and redirect home.
  useEffect(() => {
    if (loading || role !== 'student' || !sessionCode || !studentId) return;
    if (session?.status === 'lobby' && myParticipant?.kicked === true) handleReturnHome();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, role, sessionCode, studentId, session?.status, myParticipant?.kicked]);

  // When the teacher reloads, beforeunload has already written teacherDisconnected:true.
  // On reconnect, detect that flag and send the teacher home too.
  useEffect(() => {
    if (role !== 'teacher' || !session) return;
    if (session.teacherDisconnected) handleReturnHome();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, session?.teacherDisconnected]);

  // If teacher reloads into a session that no longer exists, go home instead
  // of landing on the "Create Session" screen with stale localStorage.
  useEffect(() => {
    if (loading || !sessionCode || role !== 'teacher') return;
    if (session === null) handleReturnHome();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session, sessionCode, role]);

  // ---------------------------------------------------------------------------
  // Action handlers
  // ---------------------------------------------------------------------------

  const handleReturnHome = () => {
    if (role === 'teacher' && sessionCode) {
      markTeacherDisconnected(sessionCode); // fire-and-forget; students detect instantly via onSnapshot
    }
    clearSessionStorage();
    setAppMode('session');
    setRole('student');
    setSessionCode(null);
    setStudentId(null);
  };

  const handleStudentJoined = (code: string, sid: string, _name: string) => {
    setSessionCode(code);
    setStudentId(sid);
    setRole('student');
    setAppMode('session');
  };

  const handleSessionCreated = (code: string) => {
    setSessionCode(code);
    setRole('teacher');
    setAppMode('session');
  };

  // Session shot recording
  const MAX_SOLO_SHOTS = 20;

  const handleSessionShot = async (shot: Shot, _zone: string) => {
    if (!sessionCode || !studentId || !session) return;
    const activity =
      session.status === 'team_active' ? 'team' : 'solo';
    const enrichedShot: Shot = { ...shot, studentId, activity };
    await addShot(sessionCode, enrichedShot);
  };

  const handleUndoShot = async () => {
    if (!sessionCode || !studentId || !session) return;
    const activity = session.status === 'team_active' ? 'team' : 'solo';
    await undoLastShot(sessionCode, studentId, activity);
  };

  // ---------------------------------------------------------------------------
  // Derived for session student view
  // ---------------------------------------------------------------------------
  const mySoloShots = shots.filter(
    (s) => s.studentId === studentId && s.activity === 'solo'
  );
  const myTeamShots = shots.filter(
    (s) => s.studentId === studentId && s.activity === 'team'
  );

  // ---------------------------------------------------------------------------
  // TEST MODE  (component browser — no Firebase needed)
  // ---------------------------------------------------------------------------
  if (appMode === 'test') {
    return <TestMode onBack={handleReturnHome} />;
  }

  // ---------------------------------------------------------------------------
  // PRACTICE MODE
  // ---------------------------------------------------------------------------
  if (appMode === 'practice') {
    return <PracticeMode onBack={handleReturnHome} />;
  }

  // ---------------------------------------------------------------------------
  // SESSION MODE
  // ---------------------------------------------------------------------------

  // Loading / error states
  if (loading && sessionCode) {
    return (
      <div className="app session-loading">
        <div className="session-loading-card">
          <div className="session-loading-spinner">🏀</div>
          <p>Loading session...</p>
        </div>
      </div>
    );
  }

  if (error && sessionCode) {
    return (
      <div className="app session-error">
        <div className="session-error-card">
          <div className="error-icon">⚠️</div>
          <h2>Something went wrong</h2>
          <p>{error}</p>
          <button className="btn-return-home-inline" onClick={handleReturnHome}>
            Return Home
          </button>
        </div>
      </div>
    );
  }

  // ---- TEACHER path ----
  if (role === 'teacher') {
    // No session yet → create one
    if (!session || !sessionCode) {
      return (
        <div className="app session-mode">
          <SessionCreate
            createSession={createSession}
            onCreated={handleSessionCreated}
            onBack={handleReturnHome}
          />
        </div>
      );
    }

    // Session ended → summary
    if (session.status === 'ended' || session.status === 'team_review') {
      return (
        <div className="app session-mode">
          <SessionEnded
            role="teacher"
            shots={shots}
            participants={participants}
            sessionCode={sessionCode}
            session={session}
            onReturnHome={handleReturnHome}
          />
        </div>
      );
    }

    // All other teacher states handled by TeacherLobby
    return (
      <div className="app session-mode">
        <TeacherLobby
          session={session}
          participants={participants}
          shots={shots}
          sessionCode={sessionCode}
          advanceSession={advanceSession}
          pairTeams={pairTeams}
          assignGroups={assignGroups}
          calculateRound1Winner={calculateRound1Winner}
          saveShotAllocations={saveShotAllocations}
          saveSabotageActions={saveSabotageActions}
          kickParticipant={kickParticipant}
          allocations={allocations}
          sabotageActions={sabotageActions}
          onReturnHome={handleReturnHome}
        />
      </div>
    );
  }

  // ---- STUDENT path ----
  if (role === 'student') {
    // Not yet in a session → join
    if (!session || !sessionCode || !studentId) {
      return (
        <div className="app session-mode">
          <SessionJoin
            joinSession={joinSession}
            onJoined={handleStudentJoined}
            onBack={handleReturnHome}
            onGoToTeacher={() => { setAppMode('session'); setRole('teacher'); }}
            onGoToPractice={() => { setAppMode('practice'); }}
            onGoToTest={() => { setAppMode('test'); }}
          />
        </div>
      );
    }

    const status = session.status;

    // Lobby
    if (status === 'lobby') {
      return (
        <div className="app session-mode">
          <Lobby
            sessionCode={sessionCode}
            myParticipant={myParticipant}
            updateName={updateName}
            studentId={studentId}
          />
        </div>
      );
    }

    // Solo Active
    if (status === 'solo_active') {
      const soloStats = calculateStats(mySoloShots);
      return (
        <div className="app session-mode">
          <div className="session-activity-header">
            <h2 className="activity-title">🏀 Live Session</h2>
            <p className="activity-subtitle">
              Solo Activity — Tap a zone on the court, then record if you made or missed!
            </p>
          </div>

          <main className="app-content">
            <div className="session-court-wrapper">
              <BasketballCourt
                onShotRecorded={handleSessionShot}
                shots={mySoloShots}
                maxShots={MAX_SOLO_SHOTS}
                onUndo={handleUndoShot}
                stats={soloStats}
              />
            </div>
          </main>
        </div>
      );
    }

    // Solo Review
    if (status === 'solo_review') {
      const soloStats = calculateStats(mySoloShots);
      return (
        <div className="app session-mode">
          <div className="session-activity-header">
            <h2 className="activity-title">Your Solo Results 🎯</h2>
            <p className="activity-subtitle">
              Here's your heat map from the solo round!
            </p>
          </div>
          <div className="stats-tab-layout">
            <CourtHeatmap shots={mySoloShots} stats={soloStats} />
            <StatsDisplay stats={soloStats} />
          </div>
        </div>
      );
    }

    // Team Strategy
    if (status === 'team_strategy') {
      return (
        <div className="app session-mode">
          <TeamStrategy
            shots={shots}
            teammateShots={teammateShots}
            myParticipant={myParticipant}
            participants={participants}
            studentId={studentId}
            teamNames={session.teamNames}
          />
        </div>
      );
    }

    // Shot Allocation
    if (status === 'shot_allocation') {
      return (
        <div className="app session-mode">
          <ShotAllocationPanel
            sessionCode={sessionCode}
            participants={participants}
            myParticipant={myParticipant}
            shots={shots}
            allocations={allocations}
            saveShotAllocations={saveShotAllocations}
          />
        </div>
      );
    }

    // Sabotage
    if (status === 'sabotage') {
      return (
        <div className="app session-mode">
          <SabotagePanel
            sessionCode={sessionCode}
            participants={participants}
            myParticipant={myParticipant}
            sabotageActions={sabotageActions}
            shots={shots}
            saveSabotageActions={saveSabotageActions}
          />
        </div>
      );
    }

    // Team Active
    if (status === 'team_active') {
      const teamStats = calculateStats(myTeamShots);
      const effectiveMaxShots = myAllocatedShots;
      return (
        <div className="app session-mode">
          <div className="session-activity-header">
            <h2 className="activity-title">🏀 Live Session</h2>
            <p className="activity-subtitle">
              Team Activity — Shoot as a team! Use your strategy from the last round.
            </p>
            {blockedZones.length > 0 && (
              <p className="activity-warning">
                Blocked zones: {blockedZones.join(', ')}
              </p>
            )}
          </div>

          <main className="app-content">
            <div className="session-court-wrapper">
              <BasketballCourt
                onShotRecorded={handleSessionShot}
                shots={myTeamShots}
                maxShots={effectiveMaxShots}
                onUndo={handleUndoShot}
                blockedZones={blockedZones}
                stats={teamStats}
              />
            </div>
          </main>
        </div>
      );
    }

    // Team Review
    if (status === 'team_review') {
      return (
        <div className="app session-mode">
          <TeamReview
            shots={shots}
            myParticipant={myParticipant}
            participants={participants}
            studentId={studentId}
            teamNames={session.teamNames}
          />
        </div>
      );
    }

    // Ended
    if (status === 'ended') {
      return (
        <div className="app session-mode">
          <SessionEnded
            role="student"
            shots={shots}
            participants={participants}
            sessionCode={sessionCode}
            session={session}
            onReturnHome={handleReturnHome}
          />
        </div>
      );
    }
  }
}

export default App;
