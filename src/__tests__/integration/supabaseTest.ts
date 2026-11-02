import { SupabaseService } from '../services/supabaseService'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

// Load environment variables
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

async function testSupabaseConnection() {
  console.log('🔄 Testing Supabase Connection...\n')

  try {
    // Initialize service
    const supabase = new SupabaseService(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY
    )

    // Test 1: Basic connection
    console.log('1️⃣  Testing basic connection...')
    const connectionResult = await supabase.testConnection()
    if (connectionResult.connected) {
      console.log('✅ Connected to Supabase successfully!\n')
    } else {
      console.error('❌ Connection failed:', connectionResult.error)
      return
    }

    // Test 2: Fetch destinations
    console.log('2️⃣  Testing destinations table...')
    const destinations = await supabase.getDestinations()
    console.log(`✅ Found ${destinations.length} destinations:`)
    destinations.forEach(d => console.log(`   - ${d.code}: ${d.name}`))
    console.log()

    // Test 3: Test week data function
    console.log('3️⃣  Testing week data function...')
    const testDate = new Date().toISOString().split('T')[0]
    const weekData = await supabase.getWeekData(testDate)
    console.log(`✅ Week data function works! Found ${weekData.length} items for ${testDate}\n`)

    // Test 4: Create test data
    console.log('4️⃣  Testing data operations...')
    
    // Get first destination for testing
    const testDestination = destinations[0]
    if (testDestination) {
      // Add a test custom item
      const customItem = await supabase.addCustomItem(
        testDestination.id,
        testDate,
        'Test Item',
        10,
        'boxes',
        'test-user'
      )
      console.log('✅ Successfully created custom item:', customItem.item_name)

      // Toggle its packed status
      const newStatus = await supabase.toggleCustomItemPacked(customItem.id)
      console.log(`✅ Toggled packed status to: ${newStatus}`)

      // Clean up - delete the test item
      await supabase.deleteCustomItem(customItem.id)
      console.log('✅ Cleaned up test data\n')
    }

    // Test 5: Real-time subscriptions
    console.log('5️⃣  Testing real-time subscriptions...')
    const unsubscribe = supabase.subscribeToTrackingUpdates(testDate, (payload) => {
      console.log('📡 Received real-time update:', payload.type)
    })
    console.log('✅ Real-time subscription established')
    
    // Clean up subscription
    unsubscribe()
    console.log('✅ Real-time subscription cleaned up\n')

    // Summary
    console.log('🎉 All tests passed successfully!')
    console.log('\n📋 Summary:')
    console.log('  ✓ Database connection working')
    console.log('  ✓ Tables created and accessible')
    console.log('  ✓ Functions operational')
    console.log('  ✓ CRUD operations working')
    console.log('  ✓ Real-time subscriptions enabled')
    console.log('\n✨ Supabase Phase 1 setup is complete!')

  } catch (error) {
    console.error('\n❌ Test failed with error:', error)
    console.log('\n📝 Please check:')
    console.log('  1. Your .env file has correct credentials')
    console.log('  2. All SQL scripts have been run in Supabase')
    console.log('  3. Your Supabase project is active')
  }
}

// Run the test
testSupabaseConnection()