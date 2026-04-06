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
      {!sessionCode && <button className="back-btn" onClick={onBack}>← Back</button>}
      <div className="session-create-card">
        <div className="session-create-icon">👨‍🏫</div>
        <h1 className="session-create-title">Create Session</h1>
        <p className="session-create-subtitle">
          Start a new class session and share the code with your students.
        </p>

        {sessionCode ? (
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
        ) : (
          <>
            {error && <div className="create-error">{error}</div>}
            <button
              className="btn-create"
              onClick={handleCreate}
              disabled={loading}
            >
              {loading ? '⏳ Creating...' : '🚀 Create Session'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default SessionCreate;
