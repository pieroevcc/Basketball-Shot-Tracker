import React from 'react';
import './ModeSelector.css';

interface ModeSelectorProps {
  onModeSelect: (mode: 'student' | 'mentor') => void;
}

const ModeSelector: React.FC<ModeSelectorProps> = ({ onModeSelect }) => {
  return (
    <div className="mode-selector-container">
      <div className="mode-selector">
        <h1>🏀 Basketball Shot Tracker</h1>
        <p>Choose your mode:</p>
        
        <button 
          className="mode-button student-mode"
          onClick={() => onModeSelect('student')}
        >
          <div className="mode-icon">📊</div>
          <div className="mode-title">Student Mode</div>
          <div className="mode-description">Tracks your performance</div>
        </button>
        
        <button 
          className="mode-button mentor-mode"
          onClick={() => onModeSelect('mentor')}
        >
          <div className="mode-icon">👨‍🏫</div>
          <div className="mode-title">Mentor Mode</div>
          <div className="mode-description">Monitor student progress</div>
        </button>
      </div>
    </div>
  );
};

export default ModeSelector;
