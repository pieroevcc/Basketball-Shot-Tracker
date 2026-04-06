import React, { useState } from 'react';
import { UseSessionReturn } from '../hooks/useSession';
import './SessionCreate.css';

interface SessionCreateProps {
  onCreated: (sessionCode: string) => void;
  createSession: UseSessionReturn['createSession'];
  onBack: () => void;
}

const SessionCreate: React.FC<SessionCreateProps> = ({ onCreated, createSession, onBack }) => {
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);
    setLoading(true);
    try {
      const code = await createSession();
      const hostDeviceId = crypto.randomUUID();
      localStorage.setItem('sessionCode', code);
      localStorage.setItem('hostDeviceId', hostDeviceId);
      localStorage.setItem('appRole', 'teacher');
      setSessionCode(code);
      onCreated(code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="session-create">

      <div className="session-create-card">
        <div className="create-session-header">
          <button className="create-session-back-btn" onClick={onBack}>
            ←&nbsp;&nbsp;&nbsp;Back
          </button>
        </div>

        {sessionCode ? (
          <div className="session-create-content">
            <div className="session-created">
              <p className="created-label">Your Session Code</p>
              <div className="code-display">{sessionCode}</div>
              <p className="created-hint">
                Write this on the board or project it for students to join!
              </p>
              <div className="qr-hint">
                Students go to <strong>this site</strong> and enter the code above.
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="session-create-content">
              <div className="session-create-icon">
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
              <h1 className="session-create-title">Create Session</h1>
              <p className="session-create-subtitle">
                Start a new class session and share the code<br/>with your students.
              </p>
            </div>

            {error && <div className="create-error" style={{color: 'red', textAlign: 'center', marginBottom: '10px'}}>{error}</div>}
            <button
              className="create-session-start-btn"
              onClick={handleCreate}
              disabled={loading}
            >
              {loading ? '⏳ Creating...' : 'Start!'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default SessionCreate;
