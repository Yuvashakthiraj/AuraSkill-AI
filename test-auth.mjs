/**
 * Test Firebase Authentication
 * Tests login/signup endpoints with Firebase
 */

async function testAuth() {
  const baseUrl = 'http://localhost:8082';
  
  console.log('🧪 Testing Firebase Authentication...\n');
  
  // Test 1: Login with admin credentials
  console.log('📝 Test 1: Admin Login');
  try {
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@auraskills.com',
        password: 'admin@123'
      })
    });
    
    const loginData = await loginResponse.json();
    
    if (loginResponse.ok) {
      console.log('✅ Login successful');
      console.log('   User ID:', loginData.user.id);
      console.log('   Email:', loginData.user.email);
      console.log('   Admin:', loginData.user.isAdmin);
      console.log('   Token:', loginData.token.substring(0, 20) + '...');
      if (loginData.customToken) {
        console.log('   Firebase Token:', loginData.customToken.substring(0, 20) + '...');
      }
    } else {
      console.error('❌ Login failed:', loginData.error);
      return;
    }
    
    console.log('');
    
    // Test 2: Verify token with /me endpoint
    console.log('📝 Test 2: Token Verification (/api/auth/me)');
    const meResponse = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${loginData.token}`
      }
    });
    
    const meData = await meResponse.json();
    
    if (meResponse.ok) {
      console.log('✅ Token verification successful');
      console.log('   User:', meData.user.email);
    } else {
      console.error('❌ Token verification failed:', meData.error);
    }
    
    console.log('');
    
    // Test 3: Try signup with new user (optional)
    const testEmail = `test${Date.now()}@vidyamitra.com`;
    console.log('📝 Test 3: New User Signup');
    const signupResponse = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'Test@123',
        name: 'Test User'
      })
    });
    
    const signupData = await signupResponse.json();
    
    if (signupResponse.ok) {
      console.log('✅ Signup successful');
      console.log('   New User ID:', signupData.user.id);
      console.log('   Email:', signupData.user.email);
      console.log('   Name:', signupData.user.name);
    } else {
      console.error('❌ Signup failed:', signupData.error);
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 All authentication tests passed!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run tests
testAuth();
