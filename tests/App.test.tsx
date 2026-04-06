import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App';

vi.mock('../src/firebase', () => ({
  isFirebaseConfigured: () => true,
  db: {},
}));

vi.mock('../src/services/shotsService', () => ({
  loadShots: vi.fn().mockResolvedValue([]),
  addShot: vi.fn().mockResolvedValue(undefined),
  deleteShot: vi.fn().mockResolvedValue(undefined),
  clearShots: vi.fn().mockResolvedValue(undefined),
  startNewSession: vi.fn(),
}));

vi.mock('../src/services/sessionService', () => ({
  subscribeToSession: vi.fn(),
  subscribeToParticipants: vi.fn(),
  subscribeToShots: vi.fn(),
  subscribeToAllocations: vi.fn(),
  subscribeToSabotages: vi.fn(),
  createSession: vi.fn().mockResolvedValue('TEST01'),
  advanceSession: vi.fn().mockResolvedValue(undefined),
  pairTeams: vi.fn().mockResolvedValue(undefined),
  assignRound1Groups: vi.fn().mockResolvedValue(undefined),
  joinSession: vi.fn().mockResolvedValue(undefined),
  updateParticipantName: vi.fn().mockResolvedValue(undefined),
  addSessionShot: vi.fn().mockResolvedValue(undefined),
  undoLastShot: vi.fn().mockResolvedValue(undefined),
  saveShotAllocations: vi.fn().mockResolvedValue(undefined),
  saveSabotageActions: vi.fn().mockResolvedValue(undefined),
  calculateRound1Winner: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('App', () => {
  it('shows student practice court, stats, history tabs', async () => {
    localStorage.setItem('appMode', 'practice');
    localStorage.setItem('practiceSubMode', 'student');
    render(<App />);
    expect(screen.getByText(/🏀 Court/i)).toBeInTheDocument();
    expect(screen.getByText(/📊 Stats/i)).toBeInTheDocument();
    expect(screen.getByText(/📝 History/i)).toBeInTheDocument();
  });

  it('shows mentor dashboard when practiceSubMode is mentor', () => {
    localStorage.setItem('appMode', 'practice');
    localStorage.setItem('practiceSubMode', 'mentor');
    render(<App />);
    expect(screen.getByText(/Mentor Dashboard/i)).toBeInTheDocument();
  });

  it('switches to Stats tab in student practice mode', async () => {
    localStorage.setItem('appMode', 'practice');
    localStorage.setItem('practiceSubMode', 'student');
    render(<App />);
    await userEvent.click(screen.getByText(/📊 Stats/i));
    expect(screen.getByText(/Overall Stats/i)).toBeInTheDocument();
  });

  it('switches to History tab in student practice mode', async () => {
    localStorage.setItem('appMode', 'practice');
    localStorage.setItem('practiceSubMode', 'student');
    render(<App />);
    await userEvent.click(screen.getByText(/📝 History/i));
    expect(screen.getByText(/No shots recorded yet/i)).toBeInTheDocument();
  });

  it('shows practice sub-mode selector when practiceSubMode not set', async () => {
    localStorage.setItem('appMode', 'practice');
    render(<App />);
    expect(screen.getByText(/Student/i)).toBeInTheDocument();
    expect(screen.getByText(/Mentor View/i)).toBeInTheDocument();
  });

  it('restores practice mentor mode from localStorage on mount', () => {
    localStorage.setItem('appMode', 'practice');
    localStorage.setItem('practiceSubMode', 'mentor');
    render(<App />);
    expect(screen.getByText(/Mentor Dashboard/i)).toBeInTheDocument();
  });

  it('shows SessionJoin when session mode with no active session', () => {
    localStorage.setItem('appMode', 'session');
    localStorage.setItem('appRole', 'student');
    render(<App />);
    // SessionJoin form should be shown
    expect(screen.getByRole('button', { name: /join/i })).toBeInTheDocument();
  });
});
