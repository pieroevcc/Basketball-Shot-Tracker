import React, { useState, useRef, useEffect } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Shot, Participant, Session, calculateStats, calculateScore } from '../types';
import CourtHeatmap from './CourtHeatmap';
import StatsDisplay from './StatsDisplay';
import './SessionEnded.css';

interface SessionEndedProps {
  role: 'student' | 'teacher';
  shots: Shot[];
  participants: Participant[];
  sessionCode: string;
  session?: Session;
  onReturnHome: () => void;
}

const GOOGLE_FORM_URL = 'GOOGLE_FORM_URL_HERE';

const SessionEnded: React.FC<SessionEndedProps> = ({
  role,
  shots,
  participants,
  sessionCode,
  onReturnHome,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'teams' | 'leaderboard'>('overview');
  const [isExporting, setIsExporting] = useState(false);
  const [showFeedbackPopup, setShowFeedbackPopup] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowFeedbackPopup(true), 5000);
    return () => clearTimeout(t);
  }, []);
  const pdfReportRef = useRef<HTMLDivElement>(null);

  // Round 1 leaderboard
  const leaderboard = [...participants]
    .map((p) => {
      const soloShots = shots.filter(
        (s) => s.studentId === p.studentId && s.activity === 'solo'
      );
      return {
        ...p,
        score: p.round1Score ?? calculateScore(soloShots),
      };
    })
    .sort((a, b) => b.score - a.score);

  const feedbackPopup = showFeedbackPopup && (
    <div className="feedback-popup-overlay">
      <div className="feedback-popup-card">
        <h2 className="feedback-popup-title">Rate the App! 🏀</h2>
        <p className="feedback-popup-body">
          Got 2 minutes? Your feedback helps improve this app for future classes.
        </p>
        <a
          href={GOOGLE_FORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="feedback-popup-link"
        >
          Open Feedback Form
        </a>
        <button
          className="feedback-popup-close"
          onClick={() => setShowFeedbackPopup(false)}
        >
          Maybe Later
        </button>
      </div>
    </div>
  );

  if (role === 'student') {
    return (
      <>
        <div className="session-ended student">
          <div className="ended-card">
            <div className="ended-trophy">🏆</div>
            <h1 className="ended-title">Great work today!</h1>
            <p className="ended-subtitle">The session is over. You crushed it! 🎉</p>

            {leaderboard.length > 0 && (
              <div className="ended-leaderboard-mini">
                <h3>Round 1 Leaderboard</h3>
                {leaderboard.map((p, i) => (
                  <div key={p.studentId} className="leaderboard-row">
                    <span className="leaderboard-rank">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                    </span>
                    <span className="leaderboard-name">{p.name}</span>
                    <span className="leaderboard-score">{p.score} pts</span>
                  </div>
                ))}
              </div>
            )}

            <button className="btn-return-home" onClick={onReturnHome}>
              Return to Home
            </button>
          </div>
        </div>
        {feedbackPopup}
      </>
    );
  }

  const generatePDF = async () => {
    const el = pdfReportRef.current;
    if (!el) return;
    setIsExporting(true);
    try {
      // Briefly bring the hidden report into view so html2canvas can render it
      el.style.position = 'fixed';
      el.style.left = '0';
      el.style.top = '0';
      el.style.visibility = 'visible';
      el.style.zIndex = '9999';
      // Wait for layout
      await new Promise((r) => setTimeout(r, 200));

      const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false });

      el.style.position = 'absolute';
      el.style.left = '-9999px';
      el.style.top = '0';
      el.style.visibility = 'hidden';
      el.style.zIndex = '';

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;

      let remainingH = imgH;
      let yOffset = 0;

      while (remainingH > 0) {
        if (yOffset > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, -yOffset, imgW, imgH);
        yOffset += pageH;
        remainingH -= pageH;
      }

      pdf.save(`session-report-${sessionCode}.pdf`);
    } finally {
      setIsExporting(false);
    }
  };

  // Teacher view
  const allShots = shots;
  const allStats = calculateStats(allShots);

  // Build team groups
  const teamMap: Record<string, { members: Participant[]; shots: Shot[] }> = {};
  participants.forEach((p) => {
    const key = p.teamId ?? '__unmatched__';
    if (!teamMap[key]) teamMap[key] = { members: [], shots: [] };
    teamMap[key].members.push(p);
    teamMap[key].shots.push(
      ...allShots.filter((s) => s.studentId === p.studentId && s.activity === 'team')
    );
  });

  // Find team winner
  const teamScores = Object.entries(teamMap)
    .filter(([key]) => key !== '__unmatched__')
    .map(([teamId, { shots: tShots }]) => ({
      teamId,
      score: calculateScore(tShots),
    }))
    .sort((a, b) => b.score - a.score);

  const winningTeamId = teamScores.length > 0 ? teamScores[0].teamId : null;

  return (
    <>
    <div className="session-ended teacher">
      <div className="ended-teacher-header">
        <h1 className="ended-teacher-title">Session Complete!</h1>
        <p className="ended-teacher-code">Code: {sessionCode}</p>
        <div className="ended-teacher-actions">
          <button
            className="btn-export-pdf"
            onClick={generatePDF}
            disabled={isExporting}
          >
            {isExporting ? 'Exporting…' : 'Export to PDF'}
          </button>
          <button className="btn-return-home small" onClick={onReturnHome}>
            End & Return Home
          </button>
        </div>
      </div>

      <div className="ended-tabs">
        <button
          className={`ended-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Class Overview
        </button>
        <button
          className={`ended-tab ${activeTab === 'teams' ? 'active' : ''}`}
          onClick={() => setActiveTab('teams')}
        >
          Team Results
        </button>
        <button
          className={`ended-tab ${activeTab === 'leaderboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('leaderboard')}
        >
          Leaderboard
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="ended-panel">
          <h2 className="ended-panel-title">All Shots — Class Overview</h2>
          <div className="ended-overview-layout">
            <div className="ended-heatmap-wrapper">
              <CourtHeatmap shots={allShots} stats={allStats} />
            </div>
            <div className="ended-stats-wrapper">
              <StatsDisplay stats={allStats} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'teams' && (
        <div className="ended-panel">
          <h2 className="ended-panel-title">Team Results</h2>
          <div className="ended-teams-grid">
            {Object.entries(teamMap)
              .filter(([key]) => key !== '__unmatched__')
              .map(([teamId, { members, shots: tShots }]) => {
                const tStats = calculateStats(tShots);
                const names = members.map((m) => m.name).join(' + ');
                const isWinner = teamId === winningTeamId;
                return (
                  <div key={teamId} className={`ended-team-card ${isWinner ? 'winner' : ''}`}>
                    {isWinner && <div className="winner-badge">🏆 Winner!</div>}
                    <h3 className="ended-team-name">{names}</h3>
                    <div className="ended-team-summary">
                      <span>{tShots.length} shots</span>
                      <span>{tStats.totalMade} made</span>
                      <span>{tStats.shootingPercentage.toFixed(0)}%</span>
                      <span><strong>{tStats.totalPoints} pts</strong></span>
                    </div>
                    <CourtHeatmap shots={tShots} stats={tStats} />
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {activeTab === 'leaderboard' && (
        <div className="ended-panel">
          <h2 className="ended-panel-title">Round 1 Individual Leaderboard</h2>
          <div className="ended-leaderboard">
            {leaderboard.map((p, i) => (
              <div
                key={p.studentId}
                className={`leaderboard-row ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}`}
              >
                <span className="leaderboard-rank">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                </span>
                <span className="leaderboard-name">{p.name}</span>
                <span className="leaderboard-score">{p.score} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hidden PDF report — rendered off-screen, captured by html2canvas */}
      <div
        ref={pdfReportRef}
        style={{
          position: 'absolute',
          left: '-9999px',
          top: '0',
          visibility: 'hidden',
          width: '1000px',
          background: '#fff',
          fontFamily: 'sans-serif',
          color: '#111',
          padding: '32px',
          boxSizing: 'border-box',
        }}
      >
        {/* Header */}
        <div style={{ borderBottom: '2px solid #222', paddingBottom: '16px', marginBottom: '24px' }}>
          <h1 style={{ margin: 0, fontSize: '28px' }}>Basketball Session Report</h1>
          <p style={{ margin: '6px 0 0', fontSize: '16px', color: '#555' }}>
            Session Code: <strong>{sessionCode}</strong>
            &nbsp;&nbsp;·&nbsp;&nbsp;
            {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            &nbsp;&nbsp;·&nbsp;&nbsp;
            {participants.length} participant{participants.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Class Overview */}
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '22px', borderBottom: '1px solid #ddd', paddingBottom: '8px', marginBottom: '16px' }}>
            Class Overview
          </h2>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
            <div style={{ flex: '0 0 auto' }}>
              <CourtHeatmap shots={allShots} stats={allStats} />
            </div>
            <div style={{ flex: '1 1 auto' }}>
              <StatsDisplay stats={allStats} />
            </div>
          </div>
        </div>

        {/* Team Results */}
        {Object.entries(teamMap).filter(([key]) => key !== '__unmatched__').length > 0 && (
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '22px', borderBottom: '1px solid #ddd', paddingBottom: '8px', marginBottom: '16px' }}>
              Team Results
            </h2>
            {Object.entries(teamMap)
              .filter(([key]) => key !== '__unmatched__')
              .map(([teamId, { members, shots: tShots }]) => {
                const tStats = calculateStats(tShots);
                const names = members.map((m) => m.name).join(' + ');
                const isWinner = teamId === winningTeamId;
                return (
                  <div
                    key={teamId}
                    style={{
                      border: isWinner ? '2px solid #f59e0b' : '1px solid #ddd',
                      borderRadius: '8px',
                      padding: '16px',
                      marginBottom: '20px',
                      background: isWinner ? '#fffbeb' : '#fafafa',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <h3 style={{ margin: 0, fontSize: '18px' }}>{names}</h3>
                      {isWinner && (
                        <span style={{ background: '#f59e0b', color: '#fff', padding: '2px 10px', borderRadius: '12px', fontSize: '13px', fontWeight: 700 }}>
                          🏆 Winner
                        </span>
                      )}
                    </div>
                    <p style={{ margin: '0 0 12px', color: '#555', fontSize: '14px' }}>
                      {tShots.length} shots &nbsp;·&nbsp; {tStats.totalMade} made &nbsp;·&nbsp;
                      {tStats.shootingPercentage.toFixed(0)}% &nbsp;·&nbsp;
                      <strong>{tStats.totalPoints} pts</strong>
                    </p>
                    <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
                      <div style={{ flex: '0 0 auto' }}>
                        <CourtHeatmap shots={tShots} stats={tStats} />
                      </div>
                      <div style={{ flex: '1 1 auto' }}>
                        <StatsDisplay stats={tStats} />
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {/* Round 1 Leaderboard */}
        <div>
          <h2 style={{ fontSize: '22px', borderBottom: '1px solid #ddd', paddingBottom: '8px', marginBottom: '16px' }}>
            Round 1 Leaderboard
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '15px' }}>
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Rank</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Name</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600 }}>Points</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((p, i) => (
                <tr key={p.studentId} style={{ borderBottom: '1px solid #eee', background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                  <td style={{ padding: '8px 12px' }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                  </td>
                  <td style={{ padding: '8px 12px' }}>{p.name}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>{p.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    {feedbackPopup}
    </>
  );
};

export default SessionEnded;
