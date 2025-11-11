import { DraftState } from '../types';
import {
  clearCurrentDraftState,
  getLatestDraftState,
  saveCurrentDraftState,
} from './database';

export async function saveState(state: DraftState): Promise<void> {
  try {
    await saveCurrentDraftState(state);
  } catch (error) {
    console.error('Failed to save state:', error);
  }
}

export async function loadState(): Promise<DraftState | null> {
  try {
    return await getLatestDraftState();
  } catch (error) {
    console.error('Failed to load state:', error);
    return null;
  }
}

export async function clearState(): Promise<void> {
  try {
    await clearCurrentDraftState();
  } catch (error) {
    console.error('Failed to clear state:', error);
  }
}

