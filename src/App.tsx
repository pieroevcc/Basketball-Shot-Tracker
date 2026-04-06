import { useState, useEffect, useRef } from 'react';
import BasketballCourt from './components/BasketballCourt';
import StatsDisplay from './components/StatsDisplay';
import ShotHistory from './components/ShotHistory';
import MentorDashboard from './components/MentorDashboard';
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
import { useShots } from './hooks/useShots';
import { useSession } from './hooks/useSession';
import { markTeacherDisconnected, updateTeacherHeartbeat } from './services/sessionService';
import { Shot, calculateStats } from './types';

import './components/ModeSelector.css';
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

  // ---- Practice mode state ----
  const [practiceSubMode, setPracticeSubMode] = useState<'student' | 'mentor' | null>(() => {
    // Only restore practice sub-mode when in practice mode
    const savedMode = localStorage.getItem('appMode');
    if (savedMode === 'practice') {
      return readLocalStorage('practiceSubMode') as 'student' | 'mentor' | null;
    }
    return null;
  });
  const [activeTab, setActiveTab] = useState<'court' | 'stats' | 'history'>('court');
  const { shots: practiceShots, addShot: addPracticeShot, deleteShot, clearShots } = useShots();

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

  useEffect(() => {
    if (practiceSubMode) localStorage.setItem('practiceSubMode', practiceSubMode);
    else localStorage.removeItem('practiceSubMode');
  }, [practiceSubMode]);

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
    }, 15_000);
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

  // If a student is kicked by the teacher, their participant document is deleted.
  // Detect that and redirect home.
  useEffect(() => {
    if (loading || role !== 'student' || !sessionCode || !studentId) return;
    if (session?.status === 'lobby' && myParticipant === null) handleReturnHome();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, role, sessionCode, studentId, session?.status, myParticipant]);

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
    clearSessionStorage();
    setAppMode('session');
    setRole('student');
    setSessionCode(null);
    setStudentId(null);
    setPracticeSubMode(null);
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

  // Practice shot recording
  const handlePracticeShot = (shot: Shot) => {
    addPracticeShot(shot);
  };

  const handleClearPractice = () => {
    if (window.confirm('Are you sure you want to clear all shots? This cannot be undone.')) {
      clearShots();
    }
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
  // PRACTICE MODE  (original student/mentor experience, preserved)
  // ---------------------------------------------------------------------------
  if (appMode === 'practice') {
    const practiceStats = calculateStats(practiceShots);

    // Sub-mode selector
    if (!practiceSubMode) {
      return (
        <div className="practice-mode-container">
          <div className="practice-mode-icon" style={{ fontSize: 64, marginBottom: 16 }}>🎯</div>
          <h1 className="practice-title">Practice Mode</h1>
          <p className="practice-subtitle" style={{ marginBottom: 40, fontSize: 18, color: 'rgba(255,255,255,0.8)' }}>
            Practice your skills here, nothing's easy!
          </p>
          
          <div className="practice-cards" style={{ display: 'flex', gap: 20, justifyContent: 'center' }}>
            <button 
              className="practice-card student-card"
              onClick={() => setPracticeSubMode('student')}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px 20px', borderRadius: 20, width: 220, border: 'none', cursor: 'pointer', transition: 'transform 0.2s', background: '#f8f9fa' }}
            >
              <div style={{ fontSize: 32, marginBottom: 12 }}>🏀</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#3b5998', letterSpacing: 1, marginBottom: 8 }}>STUDENT</div>
              <div style={{ fontSize: 14, color: '#888' }}>Record your shots</div>
            </button>
            
            <button 
              className="practice-card mentor-card"
              onClick={() => setPracticeSubMode('mentor')}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px 20px', borderRadius: 20, width: 220, border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', transition: 'transform 0.2s', background: 'rgba(255,255,255,0.1)' }}
            >
              <div style={{ fontSize: 32, marginBottom: 12 }}>🏆</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Mentor View</div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>Analyze performance</div>
            </button>
          </div>

          <button className="practice-back-btn" onClick={handleReturnHome}>
            ←&nbsp;&nbsp;&nbsp;Back
          </button>
        </div>
      );
    }

    // Mentor dashboard
    if (practiceSubMode === 'mentor') {
      return (
        <div className="app mentor-mode">
          <header className="app-header">
            <h1>👨‍🏫 Mentor Dashboard</h1>
            <p>Monitor and analyze student shooting performance</p>
            <button className="mode-switch-btn" onClick={() => setPracticeSubMode(null)}>
              Switch Mode
            </button>
          </header>
          <main className="app-content" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <MentorDashboard
              shots={practiceShots}
              stats={practiceStats}
              onDelete={deleteShot}
              onClear={handleClearPractice}
            />
          </main>
        </div>
      );
    }

    // Student practice mode
    return (
      <div className="app student-mode">
        <header className="app-header">
          <h1>🏀 Basketball Shot Tracker</h1>
          <p>Track your shooting performance with a visual heatmap</p>
          <button className="mode-switch-btn" onClick={() => setPracticeSubMode(null)}>
            Switch Mode
          </button>
        </header>

        <div className="nav-tabs">
          <button
            className={`tab ${activeTab === 'court' ? 'active' : ''}`}
            onClick={() => setActiveTab('court')}
          >
            🏀 Court
          </button>
          <button
            className={`tab ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            📊 Stats
          </button>
          <button
            className={`tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            📝 History
          </button>
        </div>

        <main className="app-content">
          {activeTab === 'court' && (
            <BasketballCourt onShotRecorded={handlePracticeShot} shots={practiceShots} />
          )}
          {activeTab === 'stats' && (
            <div className="stats-tab-layout">
              <CourtHeatmap shots={practiceShots} stats={practiceStats} />
              <StatsDisplay stats={practiceStats} />
            </div>
          )}
          {activeTab === 'history' && (
            <ShotHistory shots={practiceShots} onDelete={deleteShot} onClear={handleClearPractice} />
          )}
        </main>
      </div>
    );
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

  if (error) {
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
            onGoToPractice={() => { setAppMode('practice');}}
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
            <h2 className="activity-title">Solo Activity</h2>
            <p className="activity-subtitle">
              Tap a zone on the court, then record if you made or missed!
            </p>
          </div>
          <div className="session-court-wrapper">
            <BasketballCourt
              onShotRecorded={handleSessionShot}
              shots={mySoloShots}
              maxShots={MAX_SOLO_SHOTS}
              onUndo={handleUndoShot}
            />
          </div>
          {mySoloShots.length > 0 && (
            <div className="session-inline-stats">
              <span>{mySoloShots.length} shots</span>
              <span>{soloStats.totalMade} made</span>
              <span>{soloStats.shootingPercentage.toFixed(0)}%</span>
              <span>{soloStats.totalPoints} pts</span>
            </div>
          )}
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
            <h2 className="activity-title">Team Activity 🤝</h2>
            <p className="activity-subtitle">
              Shoot as a team! Use your strategy from the last round.
            </p>
            {blockedZones.length > 0 && (
              <p className="activity-warning">
                Blocked zones: {blockedZones.join(', ')}
              </p>
            )}
          </div>
          <div className="session-court-wrapper">
            <BasketballCourt
              onShotRecorded={handleSessionShot}
              shots={myTeamShots}
              maxShots={effectiveMaxShots}
              onUndo={handleUndoShot}
              blockedZones={blockedZones}
            />
          </div>
          {myTeamShots.length > 0 && (
            <div className="session-inline-stats">
              <span>{myTeamShots.length} shots</span>
              <span>{teamStats.totalMade} made</span>
              <span>{teamStats.shootingPercentage.toFixed(0)}%</span>
              <span>{teamStats.totalPoints} pts</span>
            </div>
          )}
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
