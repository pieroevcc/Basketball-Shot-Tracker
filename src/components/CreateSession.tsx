import React from 'react';
import './CreateSession.css';

interface CreateSessionProps {
  onStart: () => void;
  onBack: () => void;
}

const CreateSession: React.FC<CreateSessionProps> = ({ onStart, onBack }) => {
  return (
    <div className="create-session-container">
      <div className="create-session-card">
        <div className="create-session-header">
          <button className="create-session-back-btn" onClick={onBack}>
            ←&nbsp;&nbsp;&nbsp;Back
          </button>
        </div>
        
        <div className="create-session-content">
          <div className="create-session-icon">
            <svg width="84" height="84" viewBox="0 0 24 24" fill="none" stroke="#602ce8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18h6" />
              <path d="M10 22h4" />
              <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1.5.8 2.8 2.2 3.5.7.4 1.2 1.2 1.4 2.1" />
              <path d="M12 2v2" />
              <path d="M4.9 4.9l1.4 1.4" />
              <path d="M17.7 5l1.4-1.4" />
              <path d="M2 12h2" />
              <path d="M20 12h2" />
            </svg>
          </div>
          <h2 className="create-session-title">Create Session</h2>
          <p className="create-session-subtitle">
            Start a new class session and share the code<br/>with your students.
          </p>
        </div>

        <button className="create-session-start-btn" onClick={onStart}>
          Start!
        </button>
      </div>
    </div>
  );
};

export default CreateSession;
