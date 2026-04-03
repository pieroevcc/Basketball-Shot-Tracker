import { useState, useEffect } from 'react';
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
import { useShots } from './hooks/useShots';
import { useSession } from './hooks/useSession';
import { Shot, calculateStats } from './types';
import { isFirebaseConfigured } from './firebase';
import './App.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type AppMode = 'session' | 'practice' | null;
type AppRole = 'student' | 'teacher' | null;

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
  const [appMode, setAppMode] = useState<AppMode>('session');
  const [role, setRole] = useState<AppRole>('student');
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);

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
    loading,
    error,
    createSession,
    advanceSession,
    pairTeams,
    joinSession,
    updateName,
    addShot,
    undoLastShot,
  } = useSession(appMode === 'session' ? sessionCode : null, studentId);

  const firebaseOk = isFirebaseConfigured();

  // Sync appMode changes to localStorage
  useEffect(() => {
    if (appMode) localStorage.setItem('appMode', appMode);
    else localStorage.removeItem('appMode');
  }, [appMode]);

  // Sync practiceSubMode to localStorage
  useEffect(() => {
    if (practiceSubMode) localStorage.setItem('practiceSubMode', practiceSubMode);
    else localStorage.removeItem('practiceSubMode');
  }, [practiceSubMode]);

  // ---------------------------------------------------------------------------
  // Action handlers
  // ---------------------------------------------------------------------------

  const handleReturnHome = () => {
    clearSessionStorage();
    setAppMode(null);
    setRole(null);
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
  const MAX_SOLO_SHOTS = 15;
  const MAX_TEAM_SHOTS = 20;

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
  // LANDING PAGE
  // ---------------------------------------------------------------------------
  if (!appMode) {
    return (
      <div className="app landing">
        <div className="landing-content">
          <div className="landing-ball">🏀</div>
          <h1 className="landing-title">Basketball Shot Tracker</h1>
          <p className="landing-subtitle">
            Track your shots, see your heat map, and learn from your data!
          </p>

          <div className="landing-buttons">
            {firebaseOk ? (
              <>
                <button
                  className="landing-btn student"
                  onClick={() => {
                    setAppMode('session');
                    setRole('student');
                  }}
                >
                  <span className="landing-btn-icon">🎮</span>
                  <span className="landing-btn-label">Join Session</span>
                  <span className="landing-btn-sub">Enter your class code</span>
                </button>

                <button
                  className="landing-btn teacher"
                  onClick={() => {
                    setAppMode('session');
                    setRole('teacher');
                  }}
                >
                  <span className="landing-btn-icon">👨‍🏫</span>
                  <span className="landing-btn-label">Create Session</span>
                  <span className="landing-btn-sub">Start a class session</span>
                </button>
              </>
            ) : (
              <div className="firebase-notice">
                Configure Firebase to enable live sessions
              </div>
            )}

            <button
              className="landing-btn practice"
              onClick={() => {
                setAppMode('practice');
                setRole(null);
              }}
            >
              <span className="landing-btn-icon">🏋️</span>
              <span className="landing-btn-label">Practice Mode</span>
              <span className="landing-btn-sub">No Firebase needed</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // PRACTICE MODE  (original student/mentor experience, preserved)
  // ---------------------------------------------------------------------------
  if (appMode === 'practice') {
    const practiceStats = calculateStats(practiceShots);

    // Sub-mode selector
    if (!practiceSubMode) {
      return (
        <div className="app landing">
          <div className="landing-content">
            <div className="landing-ball">🏀</div>
            <h1 className="landing-title">Practice Mode</h1>
            <p className="landing-subtitle">
              Track shots locally — no internet connection required.
            </p>
            <div className="landing-buttons">
              <button
                className="landing-btn student"
                onClick={() => setPracticeSubMode('student')}
              >
                <span className="landing-btn-label">Student</span>
              </button>
              <button
                className="landing-btn teacher"
                onClick={() => setPracticeSubMode('mentor')}
              >
                <span className="landing-btn-label">Mentor View</span>
              </button>
            </div>
            <button className="landing-back-btn" onClick={handleReturnHome}>
              ← Back
            </button>
          </div>
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

        <footer className="app-footer">
          <p>💡 Tip: Click on different zones to record shots. Green = Hot, Red = Cold</p>
        </footer>
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
            onGoToPractice={() => { setAppMode('practice'); setRole(null); }}
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

    // Team Active
    if (status === 'team_active') {
      const teamStats = calculateStats(myTeamShots);
      return (
        <div className="app session-mode">
          <div className="session-activity-header">
            <h2 className="activity-title">Team Activity 🤝</h2>
            <p className="activity-subtitle">
              Shoot as a team! Use your strategy from the last round.
            </p>
          </div>
          <div className="session-court-wrapper">
            <BasketballCourt
              onShotRecorded={handleSessionShot}
              shots={myTeamShots}
              maxShots={MAX_TEAM_SHOTS}
              onUndo={handleUndoShot}
            />
          </div>
          {myTeamShots.length > 0 && (
            <div className="session-inline-stats">
              <span>{myTeamShots.length} shots</span>
              <span>{teamStats.totalMade} made</span>
              <span>{teamStats.shootingPercentage.toFixed(0)}%</span>
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
            onReturnHome={handleReturnHome}
          />
        </div>
      );
    }
  }

  // Fallback — no role selected yet but appMode is 'session'
  return (
    <div className="app landing">
      <div className="landing-content">
        <div className="landing-ball">🏀</div>
        <h1 className="landing-title">Basketball Shot Tracker</h1>
        <div className="landing-buttons">
          <button
            className="landing-btn student"
            onClick={() => setRole('student')}
          >
            <span className="landing-btn-icon">🎮</span>
            <span className="landing-btn-label">Join Session</span>
          </button>
          <button
            className="landing-btn teacher"
            onClick={() => setRole('teacher')}
          >
            <span className="landing-btn-icon">👨‍🏫</span>
            <span className="landing-btn-label">Create Session</span>
          </button>
        </div>
        <button className="landing-back-btn" onClick={handleReturnHome}>
          ← Back
        </button>
      </div>
    </div>
  );
}

export default App;
