import { useState, useEffect } from 'react';
import { Shot } from '../types';
import {
  loadShots,
  addShot as addShotToStore,
  deleteShot as deleteShotFromStore,
  clearShots as clearShotsFromStore,
  startNewSession,
} from '../services/shotsService';

export function useShots() {
  const [shots, setShots] = useState<Shot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadShots().then((loaded) => {
      setShots(loaded);
      setLoading(false);
    });
  }, []);

  const addShot = async (shot: Shot) => {
    await addShotToStore(shot);
    setShots((prev) => [...prev, shot]);
  };

  const deleteShot = async (shotId: string) => {
    await deleteShotFromStore(shotId);
    setShots((prev) => prev.filter((s) => s.id !== shotId));
  };

  const clearShots = async () => {
    await clearShotsFromStore();
    setShots([]);
  };

  const resetForNewSession = () => {
    startNewSession();
    setShots([]);
  };

  return { shots, loading, addShot, deleteShot, clearShots, resetForNewSession };
}