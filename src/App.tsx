import React, { useState, useEffect } from 'react';
import BasketballCourt from './components/BasketballCourt';
import StatsDisplay from './components/StatsDisplay';
import ShotHistory from './components/ShotHistory';
import ModeSelector from './components/ModeSelector';
import MentorDashboard from './components/MentorDashboard';
import CourtHeatmap from './components/CourtHeatmap';
import { useShots } from './hooks/useShots';
import { Shot, calculateStats } from './types';
import './App.css';

function App() {
  const [mode, setMode] = useState<'student' | 'mentor' | null>(() => {
    const saved = localStorage.getItem('appMode');
    return saved as 'student' | 'mentor' | null;
  });

  const [activeTab, setActiveTab] = useState<'court' | 'stats' | 'history'>('court');

  const { shots, addShot, deleteShot, clearShots } = useShots();

  // Save mode to localStorage whenever it changes
  useEffect(() => {
    if (mode) {
      localStorage.setItem('appMode', mode);
    }
  }, [mode]);

  const handleModeSelect = (selectedMode: 'student' | 'mentor') => {
    setMode(selectedMode);
  };

  const handleShotRecorded = (shot: Shot) => {
    addShot(shot);
  };

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear all shots? This cannot be undone.')) {
      clearShots();
    }
  };

  if (!mode) {
    return <ModeSelector onModeSelect={handleModeSelect} />;
  }

  const stats = calculateStats(shots);

  // Mentor dashboard
  if (mode === 'mentor') {
    return (
      <div className="app mentor-mode">
        <header className="app-header">
          <h1>👨‍🏫 Mentor Dashboard</h1>
          <p>Monitor and analyze student shooting performance</p>
          <button className="mode-switch-btn" onClick={() => setMode(null)}>
            Switch Mode
          </button>
        </header>

        <main className="app-content" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <MentorDashboard shots={shots} stats={stats} onDelete={deleteShot} onClear={handleClear} />
        </main>
      </div>
    );
  }

  // Student mode - regular interface
  return (
    <div className="app student-mode">
      <header className="app-header">
        <h1>🏀 Basketball Shot Tracker</h1>
        <p>Track your shooting performance with a visual heatmap</p>
        <button className="mode-switch-btn" onClick={() => setMode(null)}>
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
          <BasketballCourt onShotRecorded={handleShotRecorded} shots={shots} />
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

      <footer className="app-footer">
        <p>💡 Tip: Click on different zones to record shots. Green = Hot, Red = Cold</p>
      </footer>
    </div>
  );
}

export default App;
