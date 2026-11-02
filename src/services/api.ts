import { WEBAPP_URL, COLUMN_MAP } from '@/utils/constants';
import { SheetData, Supplies, CustomItem, StorageTypes } from '@/types';

export interface ApiResponse {
  data: SheetData;
  tracking: SheetData;
  storage: SheetData;
  customItems: CustomItem[];
  storageTypes: StorageTypes;
  supplies: Supplies;
}

export class ApiService {
  private static instance: ApiService;
  
  static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  private async makeRequest(action: string, params: Record<string, any> = {}): Promise<any> {
    const url = new URL(WEBAPP_URL);
    url.searchParams.append('action', action);
    
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        mode: 'cors',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  async getData(): Promise<ApiResponse> {
    return this.makeRequest('getData');
  }

  async togglePacked(row: number, col: number, mode: 'storage' | 'tracking' = 'tracking'): Promise<void> {
    return this.makeRequest('togglePacked', { row, col, type: mode });
  }

  async markGroupPacked(destination: string, packed: boolean, mode: 'storage' | 'tracking' = 'tracking'): Promise<void> {
    const colIndex = COLUMN_MAP[destination];
    if (colIndex === undefined) {
      throw new Error(`Invalid destination: ${destination}`);
    }
    // Google Apps Script expects 1-based column numbers
    const sheetColumn = colIndex + 1;
    return this.makeRequest('markGroupPacked', { col: sheetColumn, packed: packed ? 1 : 0, type: mode });
  }

  async updateSupply(type: 'mealBoxes' | 'forks', destination: string, checked: boolean): Promise<void> {
    return this.makeRequest('updateSupply', { 
      type, 
      destination, 
      checked: checked ? 1 : 0 
    });
  }

  async addCustomItem(name: string, quantity: string, destination: string): Promise<void> {
    return this.makeRequest('addCustomItem', { name, quantity, destination });
  }

  async deleteCustomItem(itemId: string): Promise<void> {
    return this.makeRequest('deleteCustomItem', { itemId });
  }

  async toggleRanOut(row: number): Promise<void> {
    return this.makeRequest('toggleRanOut', { row });
  }
}