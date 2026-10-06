import { Coordinates } from './spatial';
import { RoadLayer } from './barrierEngine';

export interface PendingOfflineReport {
  id: string;
  title: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  location: string;
  description: string;
  coordinates: Coordinates;
  roadLayer: RoadLayer;
  createdAt: number;
}

const STORAGE_KEY = 'pixel_muse_offline_barrier_queue';

export class OfflineSyncManager {
  private queue: PendingOfflineReport[] = [];
  private onFlushCallback?: (reports: PendingOfflineReport[]) => void;

  constructor() {
    this.loadFromStorage();

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.flushQueue();
      });
    }
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        this.queue = JSON.parse(data);
      }
    } catch {
      this.queue = [];
    }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
    } catch {
      // Storage quota or restriction error fallback
    }
  }

  public setFlushCallback(callback: (reports: PendingOfflineReport[]) => void): void {
    this.onFlushCallback = callback;
  }

  public enqueueReport(reportInput: Omit<PendingOfflineReport, 'id' | 'createdAt'>): PendingOfflineReport {
    const pendingReport: PendingOfflineReport = {
      ...reportInput,
      id: `off-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: Date.now(),
    };

    this.queue.push(pendingReport);
    this.saveToStorage();

    // If online immediately flush
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      this.flushQueue();
    }

    return pendingReport;
  }

  public getPendingQueue(): PendingOfflineReport[] {
    return [...this.queue];
  }

  public flushQueue(): PendingOfflineReport[] {
    if (this.queue.length === 0) return [];

    const flushed = [...this.queue];
    this.queue = [];
    this.saveToStorage();

    if (this.onFlushCallback) {
      this.onFlushCallback(flushed);
    }

    return flushed;
  }
}

export const offlineSyncManager = new OfflineSyncManager();
