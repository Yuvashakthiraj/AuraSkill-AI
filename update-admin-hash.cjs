/**
 * Update Firebase Admin Password Hash from SQLite
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Load service account
const serviceAccountPath = path.resolve(__dirname, 'firebase-admin-key.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// SQLite admin password hash (for admin@123)
const SQLITE_ADMIN_HASH = '62f0c73611d573c2777f5e0103498ab6:9fe83bc81fa83897f9a0a5ad9d13301114bcbfa461be5d231abb2e74482cc561abe6d26448d7e8c7383827c85ad4329e8afaa450fae3babaeb572255523bcdf0';

async function updateAdminHash() {
  try {
    console.log('🔄 Updating Firebase admin password hash...\n');
    
    // Get admin user
    const userRecord = await admin.auth().getUserByEmail('admin@auraskills.com');
    
    // Update Firestore document with SQLite password hash
    await admin.firestore().collection('users').doc(userRecord.uid).update({
      password_hash: SQLITE_ADMIN_HASH,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    console.log('✅ Admin password hash updated successfully');
    console.log('   UID:', userRecord.uid);
    console.log('   Email:', userRecord.email);
    console.log('   Hash:', SQLITE_ADMIN_HASH.substring(0, 40) + '...');
    console.log('\n💡 You can now login with: admin@auraskills.com / admin@123\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

updateAdminHash();
