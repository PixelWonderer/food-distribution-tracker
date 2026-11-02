import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageService } from '@/services/storage';
import { SyncChange } from '@/types';
import { localStorageData } from '../setup';

describe('StorageService', () => {
  let storageService: StorageService;

  beforeEach(() => {
    storageService = StorageService.getInstance();
    
    // Clear the mock localStorage data
    Object.keys(localStorageData).forEach(key => delete localStorageData[key]);
    
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = StorageService.getInstance();
      const instance2 = StorageService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('savePendingChanges / loadPendingChanges', () => {
    it('should save and load pending changes', () => {
      const changes = new Map<string, SyncChange>();
      changes.set('test-key', { type: 'toggle', row: 5, col: 10 });

      storageService.savePendingChanges(changes);
      const loaded = storageService.loadPendingChanges();

      expect(loaded.get('test-key')).toEqual({ type: 'toggle', row: 5, col: 10 });
    });

    it('should return empty map when no saved changes', () => {
      const loaded = storageService.loadPendingChanges();
      expect(loaded.size).toBe(0);
    });

    it('should handle corrupted data gracefully', () => {
      localStorage.setItem('tracker_pending_changes', 'invalid-json');
      const loaded = storageService.loadPendingChanges();
      expect(loaded.size).toBe(0);
    });
  });

  describe('saveFailedChanges / loadFailedChanges', () => {
    it('should save and load failed changes', () => {
      const changes = new Map<string, SyncChange>();
      changes.set('failed-key', { type: 'supply', value: { type: 'mealBoxes', destination: 'coop_c' } });

      storageService.saveFailedChanges(changes);
      const loaded = storageService.loadFailedChanges();

      expect(loaded.get('failed-key')).toEqual({ 
        type: 'supply', 
        value: { type: 'mealBoxes', destination: 'coop_c' } 
      });
    });
  });

  describe('saveLastSyncTime / loadLastSyncTime', () => {
    it('should save and load sync time', () => {
      const timestamp = Date.now();
      
      storageService.saveLastSyncTime(timestamp);
      const loaded = storageService.loadLastSyncTime();

      expect(loaded).toBe(timestamp);
    });

    it('should return null when no sync time saved', () => {
      const loaded = storageService.loadLastSyncTime();
      expect(loaded).toBeNull();
    });
  });

  describe('clearPendingChanges', () => {
    it('should clear pending changes from localStorage', () => {
      const changes = new Map<string, SyncChange>();
      changes.set('test-key', { type: 'toggle', row: 5, col: 10 });
      
      storageService.savePendingChanges(changes);
      expect(storageService.loadPendingChanges().size).toBe(1);
      
      storageService.clearPendingChanges();
      expect(storageService.loadPendingChanges().size).toBe(0);
    });
  });

  describe('clearFailedChanges', () => {
    it('should clear failed changes from localStorage', () => {
      const changes = new Map<string, SyncChange>();
      changes.set('failed-key', { type: 'toggle', row: 5, col: 10 });
      
      storageService.saveFailedChanges(changes);
      expect(storageService.loadFailedChanges().size).toBe(1);
      
      storageService.clearFailedChanges();
      expect(storageService.loadFailedChanges().size).toBe(0);
    });
  });

  describe('isOnline', () => {
    it('should return navigator.onLine value', () => {
      // Mock navigator.onLine
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
      expect(storageService.isOnline()).toBe(true);

      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
      expect(storageService.isOnline()).toBe(false);
    });
  });
});