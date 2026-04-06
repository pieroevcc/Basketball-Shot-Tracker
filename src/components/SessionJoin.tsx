import React, { useState } from 'react';
import { UseSessionReturn } from '../hooks/useSession';
import { generateNickname } from '../utils/nicknames';
import './SessionJoin.css';

interface SessionJoinProps {
  onJoined: (sessionCode: string, studentId: string, name: string) => void;
  joinSession: UseSessionReturn['joinSession'];
  onBack: () => void;
  onGoToTeacher: () => void;
  onGoToPractice: () => void;
}

const SessionJoin: React.FC<SessionJoinProps> = ({ onJoined, joinSession, onBack: _onBack, onGoToTeacher, onGoToPractice }) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCode(e.target.value.toUpperCase().slice(0, 6));
  };

  const handleGenerateName = () => {
    setName(generateNickname());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (code.length !== 6) {
      setError('Session code must be exactly 6 characters.');
      return;
    }
    if (!name.trim()) {
      setError('Please enter a name or generate one!');
      return;
    }

    const studentId = crypto.randomUUID();
    setLoading(true);
    try {
      await joinSession(code, name.trim(), studentId);
      localStorage.setItem('sessionCode', code);
      localStorage.setItem('studentId', studentId);
      localStorage.setItem('studentName', name.trim());
      localStorage.setItem('appRole', 'student');
      onJoined(code, studentId, name.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join session. Try again!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="session-join">
      <div className="session-join-card">
        <div className="session-join-icon">🏀</div>
        <h1 className="session-join-title">Join Session</h1>
        <p className="session-join-subtitle">Enter your class code to get started!</p>

        <form className="session-join-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="session-code" className="form-label">
              Session Code
            </label>
            <input
              id="session-code"
              type="text"
              className="form-input code-input"
              value={code}
              onChange={handleCodeChange}
              placeholder="ABCD12"
              maxLength={6}
              autoComplete="off"
              autoFocus
            />
            <span className="char-count">{code.length}/6</span>
          </div>

          <div className="form-group">
            <label htmlFor="player-name" className="form-label">
              Your Name
            </label>
            <div className="name-row">
              <input
                id="player-name"
                type="text"
                className="form-input name-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name..."
                maxLength={24}
              />
              <button
                type="button"
                className="btn-generate"
                onClick={handleGenerateName}
                title="Generate a random name"
                style={{ background: '#111', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px', borderRadius: 12 }}
              >
                 <span style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                   <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute' }}>
                     <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                     <path d="M3 3v5h5" />
                   </svg>
                   <span style={{ fontSize: 12, fontWeight: 900 }}>?</span>
                 </span>
              </button>
            </div>
          </div>

          {error && <div className="join-error">{error}</div>}

          <button
            type="submit"
            className="btn-join"
            disabled={loading || code.length !== 6 || !name.trim()}
          >
            {loading ? 'Joining...' : 'Join Game! 🚀'}
          </button>
        </form>

        <div className="session-join-alt-links" style={{ alignItems: 'center' }}>
          <button className="alt-link" style={{ fontSize: 16, fontWeight: 600 }} onClick={onGoToTeacher}>Create a Session</button>
          <button className="alt-link" style={{ fontSize: 16, fontWeight: 600 }} onClick={onGoToPractice}>Practice Mode</button>
        </div>
      </div>
    </div>
  );
};

export default SessionJoin;
