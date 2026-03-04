import React, { useState } from 'react';
import { Participant } from '../types';
import { UseSessionReturn } from '../hooks/useSession';
import './Lobby.css';

interface LobbyProps {
  sessionCode: string;
  myParticipant: Participant | null;
  updateName: UseSessionReturn['updateName'];
  studentId: string;
}

const Lobby: React.FC<LobbyProps> = ({ sessionCode, myParticipant, updateName, studentId }) => {
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(myParticipant?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSaveName = async () => {
    if (!nameInput.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateName(sessionCode, studentId, nameInput.trim());
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save name.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="lobby">
      <div className="lobby-card">
        <div className="lobby-icon">⏳</div>
        <h1 className="lobby-title">Waiting Room</h1>
        <p className="lobby-waiting-text">
          Waiting for your teacher to start the game...
        </p>

        <div className="lobby-session-code">
          <span className="lobby-code-label">Session Code</span>
          <span className="lobby-code">{sessionCode}</span>
        </div>

        <div className="lobby-name-section">
          <p className="lobby-name-label">Your Name</p>
          {editing ? (
            <div className="lobby-name-edit">
              <input
                type="text"
                className="lobby-name-input"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                maxLength={24}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') setEditing(false);
                }}
              />
              <div className="lobby-edit-buttons">
                <button
                  className="btn-save-name"
                  onClick={handleSaveName}
                  disabled={saving || !nameInput.trim()}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  className="btn-cancel-name"
                  onClick={() => {
                    setNameInput(myParticipant?.name ?? '');
                    setEditing(false);
                  }}
                >
                  Cancel
                </button>
              </div>
              {saveError && <p className="lobby-save-error">{saveError}</p>}
            </div>
          ) : (
            <div className="lobby-name-display">
              <span className="lobby-current-name">
                {myParticipant?.name ?? '...'}
              </span>
              <button
                className="btn-edit-name"
                onClick={() => {
                  setNameInput(myParticipant?.name ?? '');
                  setEditing(true);
                }}
              >
                ✏️ Edit
              </button>
            </div>
          )}
        </div>

        <div className="lobby-pulse-dots">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </div>
      </div>
    </div>
  );
};

export default Lobby;
