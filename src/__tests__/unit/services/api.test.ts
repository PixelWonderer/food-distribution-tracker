import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiService } from '@/services/api';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ApiService', () => {
  let apiService: ApiService;

  beforeEach(() => {
    apiService = ApiService.getInstance();
    mockFetch.mockClear();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = ApiService.getInstance();
      const instance2 = ApiService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getData', () => {
    it('should fetch data successfully', async () => {
      const mockResponse = {
        data: [['item1'], ['item2']],
        tracking: [['tracking1']],
        storage: [['storage1']],
        customItems: [],
        storageTypes: {},
        supplies: { mealBoxes: {}, forks: {} },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await apiService.getData();
      
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResponse);
    });

    it('should handle fetch errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(apiService.getData()).rejects.toThrow('HTTP 500: Internal Server Error');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(apiService.getData()).rejects.toThrow('Network error');
    });
  });

  describe('togglePacked', () => {
    it('should make correct API call', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await apiService.togglePacked(5, 10, 'storage');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('action=togglePacked');
      expect(url).toContain('row=5');
      expect(url).toContain('col=10');
      expect(url).toContain('type=storage');
    });
  });

  describe('markGroupPacked', () => {
    it('should make correct API call for packing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await apiService.markGroupPacked('partner_1', true, 'tracking');

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('action=markGroupPacked');
      expect(url).toContain('col=6');
      expect(url).toContain('packed=1');
      expect(url).toContain('type=tracking');
    });

    it('should make correct API call for unpacking', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await apiService.markGroupPacked('coop_a', false);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('packed=0');
    });
  });

  describe('updateSupply', () => {
    it('should make correct API call', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await apiService.updateSupply('mealBoxes', 'coop_c', true);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('action=updateSupply');
      expect(url).toContain('type=mealBoxes');
      expect(url).toContain('destination=coop_c');
      expect(url).toContain('checked=1');
    });
  });

  describe('addCustomItem', () => {
    it('should make correct API call', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await apiService.addCustomItem('Fresh tomatoes', '5 lbs', 'partner_1');

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('action=addCustomItem');
      expect(url).toContain('name=Fresh+tomatoes');
      expect(url).toContain('quantity=5+lbs');
      expect(url).toContain('destination=partner_1');
    });
  });

  describe('deleteCustomItem', () => {
    it('should make correct API call', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await apiService.deleteCustomItem('item123');

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('action=deleteCustomItem');
      expect(url).toContain('itemId=item123');
    });
  });
});