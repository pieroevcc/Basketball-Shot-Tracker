import React, { useState } from 'react';
import BasketballCourt from './BasketballCourt';
import CourtHeatmap from './CourtHeatmap';
import Lobby from './Lobby';
import MentorDashboard from './MentorDashboard';
import SabotagePanel from './SabotagePanel';
import SessionCreate from './SessionCreate';
import SessionEnded from './SessionEnded';
import SessionJoin from './SessionJoin';
import ShotAllocationPanel from './ShotAllocationPanel';
import ShotHistory from './ShotHistory';
import StatsDisplay from './StatsDisplay';
import TeacherLobby from './TeacherLobby';
import TeamReview from './TeamReview';
import TeamStrategy from './TeamStrategy';
import { Shot, Participant, Session, ShotAllocation, SabotageAction, calculateStats } from '../types';
import './TestMode.css';

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const MOCK_SHOTS: Shot[] = [
  { id: 's1', studentId: 'p1', x: 250, y: 95,  made: true,  zone: 'Zone 1: Paint',            timestamp: Date.now() - 9000, activity: 'solo', points: 1 },
  { id: 's2', studentId: 'p1', x: 125, y: 240, made: false, zone: 'Zone 2: Left Mid-Range',    timestamp: Date.now() - 8000, activity: 'solo', points: 0 },
  { id: 's3', studentId: 'p1', x: 375, y: 240, made: true,  zone: 'Zone 3: Right Mid-Range',   timestamp: Date.now() - 7000, activity: 'solo', points: 2 },
  { id: 's4', studentId: 'p1', x: 55,  y: 360, made: true,  zone: 'Zone 4: Left Outside',      timestamp: Date.now() - 6000, activity: 'solo', points: 3 },
  { id: 's5', studentId: 'p1', x: 250, y: 410, made: false, zone: 'Zone 5: Top of Key',        timestamp: Date.now() - 5000, activity: 'solo', points: 0 },
  { id: 's6', studentId: 'p1', x: 445, y: 360, made: true,  zone: 'Zone 6: Right Outside',     timestamp: Date.now() - 4000, activity: 'solo', points: 3 },
  { id: 's7', studentId: 'p1', x: 260, y: 100, made: false, zone: 'Zone 1: Paint',             timestamp: Date.now() - 3000, activity: 'solo', points: 0 },
  { id: 's8', studentId: 'p1', x: 130, y: 245, made: true,  zone: 'Zone 2: Left Mid-Range',    timestamp: Date.now() - 2000, activity: 'solo', points: 2 },
  { id: 's9', studentId: 'p2', x: 380, y: 250, made: true,  zone: 'Zone 3: Right Mid-Range',   timestamp: Date.now() - 1500, activity: 'solo', points: 2 },
  { id: 's10', studentId: 'p2', x: 250, y: 415, made: false, zone: 'Zone 5: Top of Key',       timestamp: Date.now() - 1000, activity: 'solo', points: 0 },
  { id: 's11', studentId: 'p3', x: 60,  y: 365, made: true,  zone: 'Zone 4: Left Outside',     timestamp: Date.now() - 800,  activity: 'solo', points: 3 },
  { id: 's12', studentId: 'p4', x: 448, y: 362, made: true,  zone: 'Zone 6: Right Outside',    timestamp: Date.now() - 600,  activity: 'solo', points: 3 },
];

const MOCK_TEAM_SHOTS: Shot[] = MOCK_SHOTS.map((s) => ({ ...s, activity: 'team' as const }));

const MOCK_PARTICIPANTS: Participant[] = [
  { studentId: 'p1', name: 'BlueShark',  joinedAt: Date.now() - 60000, teamId: 'team-a', groupId: 'g1', soloShotsComplete: 8,  teamShotsComplete: 4, round1Score: 11, allocatedShots: 20 },
  { studentId: 'p2', name: 'RedFox',     joinedAt: Date.now() - 55000, teamId: 'team-a', groupId: 'g1', soloShotsComplete: 6,  teamShotsComplete: 3, round1Score: 7,  allocatedShots: 20 },
  { studentId: 'p3', name: 'GoldEagle',  joinedAt: Date.now() - 50000, teamId: 'team-b', groupId: 'g2', soloShotsComplete: 7,  teamShotsComplete: 5, round1Score: 9,  allocatedShots: 20 },
  { studentId: 'p4', name: 'GreenWolf',  joinedAt: Date.now() - 45000, teamId: 'team-b', groupId: 'g2', soloShotsComplete: 5,  teamShotsComplete: 2, round1Score: 6,  allocatedShots: 20 },
];

const MOCK_SESSION: Session = {
  sessionCode: 'TEST01',
  status: 'lobby',
  createdAt: Date.now() - 120000,
  hostDeviceId: 'test-host-device',
  teacherLastSeen: Date.now(),
};

const MOCK_STATS = calculateStats(MOCK_SHOTS.filter((s) => s.studentId === 'p1'));

const MOCK_ALLOCATIONS: ShotAllocation[] = MOCK_PARTICIPANTS.map((p) => ({
  teamId: p.teamId!,
  studentId: p.studentId,
  allocatedShots: 20,
}));

const MOCK_SABOTAGE_ACTIONS: SabotageAction[] = [];

// ---------------------------------------------------------------------------
// No-op async helpers
// ---------------------------------------------------------------------------
const noop = () => {};
const noopAsync = async () => {};
const noopAsyncStr = async (): Promise<string> => 'TEST01';

// ---------------------------------------------------------------------------
// View registry
// ---------------------------------------------------------------------------

interface ViewDef {
  id: string;
  label: string;
  category: string;
}

const VIEWS: ViewDef[] = [
  { id: 'BasketballCourt',       label: 'Basketball Court',       category: 'Student' },
  { id: 'CourtHeatmap',          label: 'Court Heatmap',          category: 'Student' },
  { id: 'Lobby',                 label: 'Waiting Lobby',                  category: 'Student' },
  { id: 'TeamStrategy',          label: 'Team Strategy',          category: 'Student' },
  { id: 'ShotAllocationPanel',   label: 'Shot Allocation Panel',  category: 'Student' },
  { id: 'SabotagePanel',         label: 'Sabotage Panel',         category: 'Student' },
  { id: 'TeamReview',            label: 'Team Review',            category: 'Student' },
  { id: 'SessionJoin',           label: 'Session Join',           category: 'Student' },
  { id: 'SessionEndedStudent',   label: 'Session Ended (Student)', category: 'Student' },
  { id: 'TeacherLobby',          label: 'Teacher Lobby',          category: 'Teacher' },
  { id: 'SessionCreate',         label: 'Session Create',         category: 'Teacher' },
  { id: 'SessionEndedTeacher',   label: 'Session Ended (Teacher)', category: 'Teacher' },
  { id: 'StatsDisplay',          label: 'Stats Display',          category: 'Shared' },
  { id: 'ShotHistory',           label: 'Shot History',           category: 'Shared' },
  { id: 'CourtHeatmapStats',     label: 'Heatmap + Stats',        category: 'Shared' },
  { id: 'MentorDashboard',       label: 'Mentor Dashboard',       category: 'Practice' },
];

// ---------------------------------------------------------------------------
// Component renderer
// ---------------------------------------------------------------------------

function renderView(id: string): React.ReactNode {
  switch (id) {
    case 'BasketballCourt':
      return (
        <BasketballCourt
          onShotRecorded={noop}
          shots={MOCK_SHOTS.filter((s) => s.studentId === 'p1')}
          maxShots={20}
          onUndo={noop}
        />
      );

    case 'CourtHeatmap':
      return <CourtHeatmap shots={MOCK_SHOTS.filter((s) => s.studentId === 'p1')} stats={MOCK_STATS} />;

    case 'CourtHeatmapStats':
      return (
        <div className="stats-tab-layout">
          <CourtHeatmap shots={MOCK_SHOTS.filter((s) => s.studentId === 'p1')} stats={MOCK_STATS} />
          <StatsDisplay stats={MOCK_STATS} />
        </div>
      );

    case 'Lobby':
      return (
        <Lobby
          sessionCode="TEST01"
          myParticipant={MOCK_PARTICIPANTS[0]}
          updateName={noopAsync}
          studentId="p1"
        />
      );

    case 'MentorDashboard':
      return (
        <MentorDashboard
          shots={MOCK_SHOTS}
          stats={calculateStats(MOCK_SHOTS)}
          onDelete={noop}
          onClear={noop}
        />
      );

    case 'SabotagePanel':
      return (
        <SabotagePanel
          sessionCode="TEST01"
          participants={MOCK_PARTICIPANTS}
          myParticipant={MOCK_PARTICIPANTS[0]}
          sabotageActions={MOCK_SABOTAGE_ACTIONS}
          saveSabotageActions={noopAsync}
        />
      );

    case 'SessionCreate':
      return (
        <SessionCreate
          createSession={noopAsyncStr}
          onCreated={noop}
          onBack={noop}
        />
      );

    case 'SessionEndedStudent':
      return (
        <SessionEnded
          role="student"
          shots={MOCK_SHOTS.filter((s) => s.studentId === 'p1')}
          participants={MOCK_PARTICIPANTS}
          sessionCode="TEST01"
          session={{ ...MOCK_SESSION, status: 'ended' }}
          onReturnHome={noop}
        />
      );

    case 'SessionEndedTeacher':
      return (
        <SessionEnded
          role="teacher"
          shots={[...MOCK_SHOTS, ...MOCK_TEAM_SHOTS]}
          participants={MOCK_PARTICIPANTS}
          sessionCode="TEST01"
          session={{ ...MOCK_SESSION, status: 'ended' }}
          onReturnHome={noop}
        />
      );

    case 'SessionJoin':
      return (
        <SessionJoin
          joinSession={noopAsync}
          onJoined={noop}
          onBack={noop}
          onGoToTeacher={noop}
          onGoToPractice={noop}
          onGoToTest={noop}
        />
      );

    case 'ShotAllocationPanel':
      return (
        <ShotAllocationPanel
          sessionCode="TEST01"
          participants={MOCK_PARTICIPANTS}
          myParticipant={MOCK_PARTICIPANTS[0]}
          shots={MOCK_SHOTS}
          allocations={MOCK_ALLOCATIONS}
          saveShotAllocations={noopAsync}
        />
      );

    case 'ShotHistory':
      return (
        <ShotHistory
          shots={MOCK_SHOTS.filter((s) => s.studentId === 'p1')}
          onDelete={noop}
          onClear={noop}
        />
      );

    case 'StatsDisplay':
      return <StatsDisplay stats={MOCK_STATS} />;

    case 'TeacherLobby':
      return (
        <TeacherLobby
          session={MOCK_SESSION}
          participants={MOCK_PARTICIPANTS}
          shots={MOCK_SHOTS}
          sessionCode="TEST01"
          advanceSession={noopAsync}
          pairTeams={noopAsync}
          assignGroups={noopAsync}
          calculateRound1Winner={noopAsync}
          saveShotAllocations={noopAsync}
          saveSabotageActions={noopAsync}
          allocations={MOCK_ALLOCATIONS}
          sabotageActions={MOCK_SABOTAGE_ACTIONS}
          onReturnHome={noop}
        />
      );

    case 'TeamReview':
      return (
        <TeamReview
          shots={[...MOCK_SHOTS, ...MOCK_TEAM_SHOTS]}
          myParticipant={MOCK_PARTICIPANTS[0]}
          participants={MOCK_PARTICIPANTS}
          studentId="p1"
        />
      );

    case 'TeamStrategy':
      return (
        <TeamStrategy
          shots={MOCK_SHOTS}
          teammateShots={MOCK_SHOTS.filter((s) => s.studentId === 'p2')}
          myParticipant={MOCK_PARTICIPANTS[0]}
          participants={MOCK_PARTICIPANTS}
          studentId="p1"
        />
      );

    default:
      return <div className="test-mode-error">Unknown view: {id}</div>;
  }
}

// ---------------------------------------------------------------------------
// TestMode component
// ---------------------------------------------------------------------------

interface TestModeProps {
  onBack: () => void;
}

const TestMode: React.FC<TestModeProps> = ({ onBack }) => {
  const [activeView, setActiveView] = useState<string | null>(null);

  if (activeView) {
    const viewDef = VIEWS.find((v) => v.id === activeView);
    return (
      <div className="test-mode-preview-wrapper">
        <div className="test-mode-preview-bar">
          <button className="test-mode-back-btn" onClick={() => setActiveView(null)}>
            ← Back to List
          </button>
          <span className="test-mode-preview-label">{viewDef?.label ?? activeView}</span>
        </div>
        <div className="test-mode-preview-content">
          {renderView(activeView)}
        </div>
      </div>
    );
  }

  const categories = [...new Set(VIEWS.map((v) => v.category))];

  return (
    <div className="test-mode">
      <div className="test-mode-header">
        <button className="test-mode-exit-btn" onClick={onBack}>← Back to App</button>
        <div className="test-mode-header-title">
          <span className="test-mode-icon">🔬</span>
          <h1>Test Mode</h1>
        </div>
        <p className="test-mode-header-sub">Select a component to preview it with mock data.</p>
      </div>

      <div className="test-mode-body">
        {categories.map((cat) => (
          <div key={cat} className="test-mode-category">
            <h2 className="test-mode-category-title">{cat}</h2>
            <div className="test-mode-grid">
              {VIEWS.filter((v) => v.category === cat).map((view) => (
                <button
                  key={view.id}
                  className="test-mode-card"
                  onClick={() => setActiveView(view.id)}
                >
                  <span className="test-mode-card-label">{view.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TestMode;
