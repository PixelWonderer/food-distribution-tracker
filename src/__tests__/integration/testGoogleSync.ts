import { GoogleSheetsSync } from '../services/googleSheetsSync'

async function testSync() {
  const sync = new GoogleSheetsSync()
  
  console.log('🔄 Testing Google Sheets sync with corrected column mapping...')
  console.log('------------------------------------------------')
  
  try {
    // Fetch raw data
    console.log('📥 Fetching sheet data...')
    const rawData = await sync.fetchSheetData()
    
    // Check if we have the right data
    if (rawData.orders && !rawData.rawData) {
      console.warn('⚠️  WARNING: Only have orders array (with bugs), no rawData array')
    } else if (rawData.rawData) {
      console.log('✅ Have rawData array (correct data)')
    }
    
    // Parse the data
    console.log('\n📊 Parsing sheet data...')
    const parsedData = sync.parseSheetData(rawData)
    
    console.log(`\n✅ Successfully parsed ${parsedData.length} items:\n`)
    
    // Show first 5 items with their allocations
    parsedData.slice(0, 5).forEach((item, i) => {
      console.log(`${i + 1}. ${item.itemName}`)
      console.log(`   Total Qty: ${item.totalQuantity}, Unit: ${item.unit || 'Case'}`)
      console.log(`   Storage: ${item.storageType || 'Unknown'}`)
      
      const allocStr = Object.entries(item.allocations)
        .map(([dest, qty]) => `${dest}: ${qty}`)
        .join(', ')
      console.log(`   Allocations: ${allocStr || 'None'}`)
      console.log('')
    })
    
    // Verify specific items that were problematic
    const brownRice = parsedData.find(item => item.itemName.includes('Brown Rice'))
    const onions = parsedData.find(item => item.itemName.includes('Onions'))
    
    console.log('🔍 Verification of specific items:')
    console.log('------------------------------------------------')
    
    if (brownRice) {
      console.log('Brown Rice allocations:', brownRice.allocations)
      console.log('  Expected: Partner Group 1 = 2')
      console.log('  Actual: ', brownRice.allocations.partner_1 === 2 ? '✅ CORRECT' : '❌ WRONG')
    }
    
    if (onions) {
      console.log('\nOnions allocations:', onions.allocations)
      console.log('  Expected: Partner Group 7 = 2')
      console.log('  Actual: ', onions.allocations.partner_7 === 2 ? '✅ CORRECT' : '❌ WRONG')
      console.log('  Total Qty:', onions.totalQuantity)
    }
    
    console.log('\n✅ Sync test completed successfully!')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testSync().catch(console.error)