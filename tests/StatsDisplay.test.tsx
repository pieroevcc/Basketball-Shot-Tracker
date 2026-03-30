import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatsDisplay from '../src/components/StatsDisplay';
import { Stats } from '../src/types';

const emptyStats: Stats = {
  totalShots: 0,
  totalMade: 0,
  shootingPercentage: 0,
  totalPoints: 0,
  byZone: {
    'Zone 1: Paint': { made: 0, total: 0, percentage: 0, points: 0 },
    'Zone 2: Left Mid-Range': { made: 0, total: 0, percentage: 0, points: 0 },
    'Zone 3: Right Mid-Range': { made: 0, total: 0, percentage: 0, points: 0 },
    'Zone 4: Left Outside': { made: 0, total: 0, percentage: 0, points: 0 },
    'Zone 5: Top of Key': { made: 0, total: 0, percentage: 0, points: 0 },
    'Zone 6: Right Outside': { made: 0, total: 0, percentage: 0, points: 0 },
  },
};

const populatedStats: Stats = {
  totalShots: 10,
  totalMade: 7,
  shootingPercentage: 70,
  totalPoints: 9,
  byZone: {
    'Zone 1: Paint': { made: 5, total: 6, percentage: 83.3, points: 5 },
    'Zone 2: Left Mid-Range': { made: 2, total: 4, percentage: 50, points: 4 },
    'Zone 3: Right Mid-Range': { made: 0, total: 0, percentage: 0, points: 0 },
    'Zone 4: Left Outside': { made: 0, total: 0, percentage: 0, points: 0 },
    'Zone 5: Top of Key': { made: 0, total: 0, percentage: 0, points: 0 },
    'Zone 6: Right Outside': { made: 0, total: 0, percentage: 0, points: 0 },
  },
};

describe('StatsDisplay', () => {
  it('renders Overall Stats heading', () => {
    render(<StatsDisplay stats={emptyStats} />);
    expect(screen.getByText(/Overall Stats/i)).toBeInTheDocument();
  });

  it('renders Stats by Zone heading', () => {
    render(<StatsDisplay stats={emptyStats} />);
    expect(screen.getByText(/Stats by Zone/i)).toBeInTheDocument();
  });

  it('renders Heat Map Legend', () => {
    render(<StatsDisplay stats={emptyStats} />);
    expect(screen.getByText(/Heat Map Legend/i)).toBeInTheDocument();
  });

  it('displays total shots count', () => {
    render(<StatsDisplay stats={populatedStats} />);
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('displays made shots count', () => {
    render(<StatsDisplay stats={populatedStats} />);
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('displays shooting percentage', () => {
    render(<StatsDisplay stats={populatedStats} />);
    expect(screen.getByText('70.0%')).toBeInTheDocument();
  });

  it('displays zone names', () => {
    render(<StatsDisplay stats={populatedStats} />);
    expect(screen.getByText('Zone 1: Paint')).toBeInTheDocument();
    expect(screen.getByText('Zone 2: Left Mid-Range')).toBeInTheDocument();
  });

  it('displays made/total for a zone', () => {
    render(<StatsDisplay stats={populatedStats} />);
    expect(screen.getByText('5/6')).toBeInTheDocument();
  });

  it('shows legend labels', () => {
    render(<StatsDisplay stats={emptyStats} />);
    expect(screen.getByText(/Hot \(70%\+\)/)).toBeInTheDocument();
    expect(screen.getByText(/Warm \(50-69%\)/)).toBeInTheDocument();
    expect(screen.getByText(/Cool \(30-49%\)/)).toBeInTheDocument();
    expect(screen.getByText(/Cold \(<30%\)/)).toBeInTheDocument();
  });
});
