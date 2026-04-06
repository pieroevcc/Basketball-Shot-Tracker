import { useState, useEffect } from 'react';
import BasketballCourt from './BasketballCourt';
import StatsDisplay from './StatsDisplay';
import ShotHistory from './ShotHistory';
import MentorDashboard from './MentorDashboard';
import CourtHeatmap from './CourtHeatmap';
import { useShots } from '../hooks/useShots';
import { Shot, calculateStats } from '../types';
import './PracticeMode.css';

interface PracticeModeProps {
  onBack: () => void;
}

const PracticeMode: React.FC<PracticeModeProps> = ({ onBack }) => {
  const [practiceSubMode, setPracticeSubMode] = useState<'student' | 'mentor' | null>(() => {
    return localStorage.getItem('practiceSubMode') as 'student' | 'mentor' | null;
  });
  const [activeTab, setActiveTab] = useState<'court' | 'stats' | 'history'>('court');
  const { shots, addShot, deleteShot, clearShots } = useShots();

  useEffect(() => {
    if (practiceSubMode) localStorage.setItem('practiceSubMode', practiceSubMode);
    else localStorage.removeItem('practiceSubMode');
  }, [practiceSubMode]);

  const handleShot = (shot: Shot) => {
    addShot(shot);
  };

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear all shots? This cannot be undone.')) {
      clearShots();
    }
  };

  const stats = calculateStats(shots);

  // Sub-mode selector
  if (!practiceSubMode) {
    return (
      <div className="practice-mode-container">
        <div className="practice-mode-body">
        <div className="practice-mode-icon">🎯</div>
        <h1 className="practice-title">Practice Mode</h1>
        <p className="practice-subtitle">Practice your skills here, nothing's easy!</p>

        <div className="practice-cards">
          <button
            className="practice-card student-card"
            onClick={() => setPracticeSubMode('student')}
          >
            <div className="practice-card-label">STUDENT</div>
            <div className="practice-card-sub">Record your shots</div>
          </button>

          <button
            className="practice-card mentor-card"
            onClick={() => setPracticeSubMode('mentor')}
          >
            <div className="practice-card-label">Mentor View</div>
            <div className="practice-card-sub">Analyze performance</div>
          </button>
        </div>

        <button className="practice-back-btn" onClick={onBack}>
          ←&nbsp;&nbsp;&nbsp;Back
        </button>
        </div>
      </div>
    );
  }

  // Mentor dashboard
  if (practiceSubMode === 'mentor') {
    return (
      <div className="app mentor-mode">
        <header className="practice-header">
          <h1>👨‍🏫 Mentor Dashboard</h1>
          <p>Monitor and analyze student shooting performance</p>
          <button className="mode-switch-btn" onClick={() => setPracticeSubMode(null)}>
            Switch Mode
          </button>
        </header>
        <main className="practice-content" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <MentorDashboard
            shots={shots}
            stats={stats}
            onDelete={deleteShot}
            onClear={handleClear}
          />
        </main>
      </div>
    );
  }

  // Student practice mode
  return (
    <div className="app student-mode">
      <header className="practice-header">
        <h1>🏀 Basketball Shot Tracker</h1>
        <p>Track your shooting performance with a visual heatmap</p>
        <button className="mode-switch-btn" onClick={() => setPracticeSubMode(null)}>
          Switch Mode
        </button>
      </header>

      <div className="practice-nav-tabs">
        <button
          className={`practice-tab ${activeTab === 'court' ? 'active' : ''}`}
          onClick={() => setActiveTab('court')}
        >
          🏀 Court
        </button>
        <button
          className={`practice-tab ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          📊 Stats
        </button>
        <button
          className={`practice-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          📝 History
        </button>
      </div>

      <main className="practice-content">
        {activeTab === 'court' && (
          <BasketballCourt onShotRecorded={handleShot} shots={shots} />
        )}
        {activeTab === 'stats' && (
          <div className="stats-tab-layout">
            <CourtHeatmap shots={shots} stats={stats} />
            <StatsDisplay stats={stats} />
          </div>
        )}
        {activeTab === 'history' && (
          <ShotHistory shots={shots} onDelete={deleteShot} onClear={handleClear} />
        )}
      </main>
    </div>
  );
};

export default PracticeMode;
