// Simple test script for Vercel API routes
const testLeaderboardAPI = async () => {
  try {
    console.log('🧪 Testing Vercel API routes...');
    
    // Test GET /api/leaderboard
    console.log('📊 Testing GET /api/leaderboard...');
    const leaderboardResponse = await fetch('http://localhost:3000/api/leaderboard');
    const leaderboardData = await leaderboardResponse.json();
    console.log('✅ Leaderboard API response:', leaderboardData);
    
    // Test POST /api/leaderboard/submit
    console.log('🎯 Testing POST /api/leaderboard/submit...');
    const submitResponse = await fetch('http://localhost:3000/api/leaderboard/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletAddress: '11111111111111111111111111111111111111111111',
        score: 1500,
        gameType: 'cyber-defense'
      })
    });
    const submitData = await submitResponse.json();
    console.log('✅ Submit API response:', submitData);
    
    console.log('🎉 All API tests completed!');
  } catch (error) {
    console.error('❌ API test failed:', error);
  }
};

// Run the test
testLeaderboardAPI();
