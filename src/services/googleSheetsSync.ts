import { SupabaseService } from './supabaseService'
import { logger } from '@/lib/logger';
import { WEBAPP_URL } from '@/utils/constants';

interface SheetRow {
  itemName: string
  totalQuantity: number
  unit: string | null
  allocations: Record<string, number>
  ranOut: boolean
  storageType: string | null
  surplus: number
  nonAllocated: number  // Column N - quantity not allocated to any destination
}

interface FetchOptions {
  sheetName?: string
}

interface SyncResult {
  success: boolean
  ordersProcessed: number
  allocationsCreated: number
  suppliesProcessed: number
  errors: string[]
  warnings: string[]
  timestamp: Date
  sheetName?: string
  inventoryImported?: number
}

export class GoogleSheetsSync {
  private supabase: SupabaseService
  private webappUrl: string
  private lastSyncTime: Date | null = null

  constructor(webappUrl?: string) {
    // Google Apps Script web-app URL (set VITE_SHEETS_WEBAPP_URL in .env)
    this.webappUrl = webappUrl || WEBAPP_URL
    this.supabase = SupabaseService.getInstance()
  }

  private async fetchJson(url: string): Promise<any> {
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const text = await response.text()

    if (text.includes('script.googleusercontent.com')) {
      const redirectUrl = text.match(/href="([^"]+)"/)?.[1]
      if (redirectUrl) {
        const redirectResponse = await fetch(redirectUrl)
        if (!redirectResponse.ok) {
          throw new Error(`Redirect HTTP error! status: ${redirectResponse.status}`)
        }
        return await redirectResponse.json()
      }
    }

    return JSON.parse(text)
  }

  /**
   * Fetch current data from Google Sheets via Apps Script endpoint
   * Returns data including custom items from hidden sheet
   */
  async fetchSheetData(options?: FetchOptions): Promise<any> {
    try {
      const sheetQuery = options?.sheetName ? `&sheet=${encodeURIComponent(options.sheetName)}` : ''
      const data = await this.fetchJson(`${this.webappUrl}?type=getData${sheetQuery}`)
      logger.debug('📋 Received data from Google Sheets (with custom items):', data.customItems?.length || 0, 'custom items')
      return data
    } catch (error) {
      console.error('Error fetching sheet data:', error)
      throw error
    }
  }

  async listSheets(): Promise<Array<{ name: string; index: number; visible: boolean }>> {
    try {
      const data = await this.fetchJson(`${this.webappUrl}?type=listSheets`)
      return Array.isArray(data.sheets) ? data.sheets : []
    } catch (error) {
      console.error('Error fetching sheet list:', error)
      throw error
    }
  }

  /**
   * Extract the date from Google Sheets cell B1 (last updated date)
   */
  private extractSheetDate(sheetData: any): string | null {
    try {
      // Check if sheetData has rawData from Google Apps Script (row 0, column 1 = B1)
      if (sheetData && sheetData.rawData && sheetData.rawData[0] && sheetData.rawData[0][1]) {
        const dateValue = sheetData.rawData[0][1];
        logger.debug(`📅 Found sheet date from rawData[0][1] (B1): ${dateValue}`);
        return dateValue;
      }
      
      // Legacy format check for sheet data
      if (sheetData && sheetData.sheet && sheetData.sheet[0] && sheetData.sheet[0][1]) {
        const dateValue = sheetData.sheet[0][1];
        logger.debug(`📅 Found sheet date from sheet[0][1] (B1): ${dateValue}`);
        return dateValue;
      }
      
      // Fallback: look for lastUpdated field in the response
      if (sheetData && sheetData.lastUpdated) {
        logger.debug(`📅 Found sheet date from lastUpdated: ${sheetData.lastUpdated}`);
        return sheetData.lastUpdated;
      }
      
      console.warn('⚠️ No date found in Google Sheets data - checked rawData[0][1], sheet[0][1], and lastUpdated');
      return null;
    } catch (error) {
      console.error('❌ Error extracting sheet date:', error);
      return null;
    }
  }



  /**
   * Parse Google Sheets data into structured format
   */
  parseSheetData(rawData: any): SheetRow[] {
    const rows: SheetRow[] = []
    
    // DEBUG: Log the actual structure being received
    logger.debug('🔍 DEBUG: rawData structure:', JSON.stringify(Object.keys(rawData), null, 2))
    logger.debug('🔍 DEBUG: rawData.rawData exists:', !!rawData.rawData)
    logger.debug('🔍 DEBUG: rawData.data exists:', !!rawData.data)
    logger.debug('🔍 DEBUG: rawData itself is array:', Array.isArray(rawData))
    
    // IMPORTANT: Use rawData array, NOT the orders array which has incorrect allocations
    // The API's orders array has a bug where allocations are mismatched
    const sheetData = rawData.rawData || rawData.data || []
    
    logger.debug('🔍 DEBUG: Final sheetData length:', sheetData.length)
    
    if (rawData.orders && !rawData.rawData) {
      console.warn('WARNING: Using orders array which may have incorrect allocations. rawData preferred.')
    }
    
    const normalizeHeader = (value: unknown) =>
      typeof value === 'string' ? value.trim().toLowerCase().replace(/[^a-z0-9]/g, '') : ''

    const headerRows: any[][] = [
      Array.isArray(sheetData[0]) ? sheetData[0] : [],
      Array.isArray(sheetData[1]) ? sheetData[1] : [],
    ]

    // Debug: Show header rows with normalized names
    logger.debug('📋 Header row 1 (raw):', headerRows[0])
    logger.debug('📋 Header row 1 (normalized):', headerRows[0].map((h: unknown, i: number) => `${i}:${normalizeHeader(h)}`))
    logger.debug('📋 Header row 2 (raw):', headerRows[1])

    const findColumnIndex = (aliases: string[], fallback?: number): number => {
      for (const row of headerRows) {
        for (let i = 0; i < row.length; i++) {
          const normalized = normalizeHeader(row[i])
          if (!normalized) continue
          if (aliases.includes(normalized)) {
            return i
          }
        }
      }
      return typeof fallback === 'number' ? fallback : -1
    }

    // Fallback column indices - should match constants.ts COLUMN_MAP
    // These are used if dynamic header detection fails
    const DEFAULT_DEST_COLUMNS = {
      partner_7: 4,  // Column E
      partner_1: 5,  // Column F
      partner_2: 6,  // Column G
      partner_3: 7,  // Column H
      coop_b: 8,     // Column I
      coop_a: 9,     // Column J
      partner_4: 10, // Column K
      partner_5: 11, // Column L
      partner_6: 12, // Column M
      coop_c: 13,    // Column N
    }

    const destinationAliases: Record<keyof typeof DEFAULT_DEST_COLUMNS, string[]> = {
      partner_7: ['partnergroup7', 'partner7', 'p7'],
      partner_1: ['partnergroup1', 'partner1', 'p1'],
      partner_2: ['partnergroup2', 'partner2', 'p2'],
      partner_3: ['partnergroup3', 'partner3', 'p3'],
      coop_b: ['coopb', 'cob'],
      coop_a: ['coopa', 'coa'],
      partner_4: ['partnergroup4', 'partner4', 'p4'],
      partner_5: ['partnergroup5', 'partner5', 'p5'],
      partner_6: ['partnergroup6', 'partner6', 'p6'],
      coop_c: ['coopc', 'coc'],
    }

    const destColumnMap: Record<string, number> = {}
    for (const [key, aliases] of Object.entries(destinationAliases)) {
      destColumnMap[key] = findColumnIndex(aliases, DEFAULT_DEST_COLUMNS[key as keyof typeof DEFAULT_DEST_COLUMNS])
    }

    const itemCol = findColumnIndex(['item', 'itemname'], 0)
    const unitCol = findColumnIndex(['uom', 'unit', 'units'], 1)
    const totalRequestedCol = findColumnIndex(['totalqtyrequested', 'totalrequested', 'qtyrequested', 'totalqty'], 3)
    // Column O (index 14) - Non-allocated quantity (items not assigned to any destination).
    // The sheet header is being renamed "Reserve"; headers are normalized (lowercase, a-z0-9 only)
    // before comparison, so 'Reserve' -> 'reservestock'. Old names stay as aliases.
    const nonAllocatedCol = findColumnIndex(['nonallocated', 'non-allocated', 'unallocated', 'reserve', 'reservestock'], 14)
    const surplusCol = findColumnIndex(['surplus', 'maxout', 'maxout?'], 15)
    const ranOutCol = findColumnIndex(['ranout', 'ranout?', 'ranoutyesno'], 16)
    const storageTypeCol = findColumnIndex(['storagetype', 'storage', 'storagecategory'], 17)

    logger.debug('🗺️ Resolved column map:', {
      itemCol,
      unitCol,
      totalRequestedCol,
      nonAllocatedCol,
      surplusCol,
      ranOutCol,
      storageTypeCol,
      destinations: destColumnMap,
    })

    const normalizeQuantity = (cell: unknown): number => {
      if (typeof cell === 'number' && !isNaN(cell)) {
        return cell
      }
      if (typeof cell === 'boolean') {
        return cell ? 1 : 0
      }
      if (typeof cell === 'string') {
        const trimmed = cell.trim()
        if (!trimmed || trimmed.toLowerCase() === 'n/a') {
          return 0
        }
        const match = trimmed.match(/-?\d+(\.\d+)?/)
        if (match) {
          const parsed = parseFloat(match[0])
          return isNaN(parsed) ? 0 : parsed
        }
        if (trimmed.toLowerCase() === 'true') return 1
        if (trimmed.toLowerCase() === 'false') return 0
        return 0
      }
      return 0
    }

    // Process all data rows starting from row 3 (0-indexed: 2)
    // This includes:
    // - Regular items (rows 3-14, 0-indexed: 2-13)  
    // - Reserved Food Bank items (rows 15-28, 0-indexed: 14-27) - may be empty
    // - Supply items (rows 29-30, 0-indexed: 28-29) - meal boxes, forks
    // - Custom items (rows 31+, 0-indexed: 30+)
    for (let i = 2; i < sheetData.length; i++) {
      const row = sheetData[i]
      if (!row) continue

      const rawItem = itemCol >= 0 ? row[itemCol] : row[0]
      const itemName = typeof rawItem === 'string' ? rawItem.trim() : rawItem
      if (!itemName) continue

      const allocations: Record<string, number> = {}
      
      // Extract allocations for each destination
      for (const [dest, col] of Object.entries(destColumnMap)) {
        if (col < 0) continue
        const cellValue = row[col]
        const value = normalizeQuantity(cellValue)
        
        // Debug specific destinations
        if (dest === 'partner_1' || dest === 'partner_7') {
          logger.debug(`🔍 PARSE DEBUG: Row ${i} ${row[0]} -> ${dest} (col ${col}): cellValue="${cellValue}", value=${value}`)
        }
        
        if (!isNaN(value) && value > 0) {
          allocations[dest] = value
          if (dest === 'partner_1' || dest === 'partner_7') {
            logger.debug(`✅ ALLOCATION ADDED: ${dest} = ${value}`)
          }
        }
      }

      // Parse total quantity from resolved column (defaults to Total Qty Requested)
      const requestedQty = totalRequestedCol >= 0 ? normalizeQuantity(row[totalRequestedCol]) : 0
      const allocationTotal = Object.values(allocations).reduce((sum, qty) => sum + qty, 0)
      const rawNonAllocated = nonAllocatedCol >= 0 ? row[nonAllocatedCol] : undefined
      const nonAllocatedQty = nonAllocatedCol >= 0 ? normalizeQuantity(row[nonAllocatedCol]) : 0
      const surplusQty = surplusCol >= 0 ? normalizeQuantity(row[surplusCol]) : 0

      // Debug non-allocated parsing
      if (nonAllocatedQty > 0 || (rawNonAllocated !== undefined && rawNonAllocated !== '' && rawNonAllocated !== 0)) {
        logger.debug(`📦 NON-ALLOCATED: "${itemName}" raw=${JSON.stringify(rawNonAllocated)} parsed=${nonAllocatedQty}`)
      }

      const totalQty = requestedQty > 0 ? requestedQty : allocationTotal

      const ranOutValue = ranOutCol >= 0 ? row[ranOutCol] : false
      const storageTypeValue = storageTypeCol >= 0 ? row[storageTypeCol] : null

      // Only add items that have quantity or allocations
      if (totalQty > 0 || Object.keys(allocations).length > 0) {
        rows.push({
          itemName,
          totalQuantity: totalQty,
          unit: (unitCol >= 0 ? row[unitCol] : null) || 'Case',  // Column B - UOM, default to 'Case'
          allocations,
          ranOut: ranOutValue === true || ranOutValue === 'true',
          storageType: (storageTypeValue ?? null) as string | null, // Column Q (Storage Type)
          surplus: surplusQty,
          nonAllocated: nonAllocatedQty,  // Column N - items not assigned to any destination
        })
      }
    }

    return rows
  }

  /**
   * Clear all data and import fresh data from Google Sheets
   */
  async importToSupabase(options?: FetchOptions): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      ordersProcessed: 0,
      allocationsCreated: 0,
      suppliesProcessed: 0,
      errors: [],
      warnings: [],
      timestamp: new Date(),
      sheetName: options?.sheetName,
      inventoryImported: 0
    }

    try {
      logger.debug(`🔄 Starting clear & import from Google Sheets`)

      // Fetch current sheet data
      const sheetData = await this.fetchSheetData(options)
      logger.debug('🔍 Raw Google Sheets data structure:', JSON.stringify(sheetData, null, 2))
      if (sheetData?.sheetName) {
        result.sheetName = sheetData.sheetName
      }
      
      const parsedRows = this.parseSheetData(sheetData)
      
      // Extract the date from Google Sheets cell B1
      const sheetDate = this.extractSheetDate(sheetData)
      logger.debug('📅 Extracted sheet date:', sheetDate)

      // Prepare batch data
      const orders = []
      const allocations = []

      for (const row of parsedRows) {
        // Create order entry
        orders.push({
          item_name: row.itemName,
          quantity: row.totalQuantity,
          unit: row.unit,
          storage_type: row.storageType,
          ran_out: row.ranOut,
          non_allocated: row.nonAllocated  // Column N - items not assigned to any destination
        })

        // Create allocation entries
        for (const [destCode, qty] of Object.entries(row.allocations)) {
          allocations.push({
            item_name: row.itemName,
            destination_code: destCode,
            quantity: qty
          })
        }
      }

      // Debug: Log the actual data being sent to stored procedure
      logger.debug('🔍 DEBUGGING: Orders being sent:', JSON.stringify(orders, null, 2))
      logger.debug('🔍 DEBUGGING: Allocations being sent:', JSON.stringify(allocations, null, 2))
      logger.debug(`📊 Orders count: ${orders.length}, Allocations count: ${allocations.length}`)
      
      const weekDate = sheetDate || new Date().toISOString().split('T')[0]

      // Clear all data and import fresh data
      const syncResult = await this.supabase.clearAndImportData(
        orders,
        allocations,
        weekDate,
      )

      // Add any warnings from the import (e.g., skipped allocations)
      if (syncResult.warnings) {
        result.warnings.push(...syncResult.warnings)
      }

      // Reset destination timings to defaults (for schedule management feature)
      try {
        await this.supabase.resetDestinationTimings()
        logger.debug('📅 Reset destination timings to defaults')
      } catch (resetError) {
        console.warn('⚠️ Failed to reset destination timings:', resetError)
        // Don't fail the import if timing reset fails
      }

      // Update sync metadata with the sheet date from cell B1
      if (sheetDate) {
        await this.supabase.updateSyncMetadata(sheetDate)
        logger.debug(`📅 Updated sync metadata with sheet date: ${sheetDate}`)
      }

      // Import non-allocated quantities to inventory (additive - adds to existing counts)
      try {
        const ordersWithNonAllocated = orders.filter(o => (o.non_allocated || 0) > 0)
        logger.debug(`📦 Orders with non-allocated quantities:`, ordersWithNonAllocated.map(o => `${o.item_name}: ${o.non_allocated}`))
        if (ordersWithNonAllocated.length > 0) {
          logger.debug(`📦 Processing ${ordersWithNonAllocated.length} orders with non-allocated quantities...`)
          const inventoryResult = await this.supabase.importNonAllocatedToInventory(weekDate)
          logger.debug(`📦 Inventory import result:`, inventoryResult)
          result.inventoryImported = inventoryResult.length
          if (inventoryResult.length === 0 && ordersWithNonAllocated.length > 0) {
            result.warnings.push(`Reserve items found in sheet but none were imported to inventory (${ordersWithNonAllocated.length} items)`)
          }
        } else {
          logger.debug('📦 No orders with non-allocated quantities found')
        }
      } catch (inventoryError) {
        const errorMsg = inventoryError instanceof Error ? inventoryError.message : String(inventoryError)
        console.warn('⚠️ Failed to auto-import non-allocated to inventory:', inventoryError)
        result.warnings.push(`Failed to import Reserve to inventory: ${errorMsg}`)
      }

      result.ordersProcessed = syncResult.orders_upserted
      result.allocationsCreated = syncResult.allocations_upserted
      result.suppliesProcessed = 0  // Supplies now flow through regular orders/allocations
      result.success = true

      // Note: Tracking states and custom items are managed directly in Supabase
      // No need to sync them from Google Sheets

      this.lastSyncTime = new Date()
      logger.debug(`✅ Import completed: ${result.ordersProcessed} orders, ${result.allocationsCreated} allocations`)

    } catch (error: any) {
      result.errors.push(error.message)
      console.error('❌ Import failed:', error)
    }

    return result
  }


  // Removed complex sync methods - import is now one-way only

  // Only manual imports are supported via Clear & Import button

  /**
   * Add custom item as a new row in the main Google Sheet
   * This will be imported as a regular item during the next weekly import
   */
  async addCustomItem(destination: string, itemName: string, quantity: string, addedBy: string = 'system'): Promise<any> {
    try {
      const url = `${this.webappUrl}?action=addCustomItemRow&destination=${encodeURIComponent(destination)}&itemName=${encodeURIComponent(itemName)}&quantity=${encodeURIComponent(quantity)}&addedBy=${encodeURIComponent(addedBy)}`
      
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const text = await response.text()
      
      // Handle Google's redirect response
      if (text.includes('script.googleusercontent.com')) {
        const redirectUrl = text.match(/href="([^"]+)"/)?.[1]
        if (redirectUrl) {
          const redirectResponse = await fetch(redirectUrl)
          return await redirectResponse.json()
        }
      }

      return JSON.parse(text)
    } catch (error) {
      console.error('Error adding custom item row to Google Sheets:', error)
      throw error
    }
  }

  /**
   * Get last import information
   */
  getLastImportInfo() {
    return {
      lastImport: this.lastSyncTime,
      timeSinceLastImport: this.lastSyncTime 
        ? Math.floor((Date.now() - this.lastSyncTime.getTime()) / 1000)
        : null
    }
  }

  // Backwards compatibility
  syncToSupabase() {
    return this.importToSupabase()
  }
}
