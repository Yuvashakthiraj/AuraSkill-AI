/**
 * Initialize Firebase Admin User
 * Run: node server/init-admin.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Load service account
const serviceAccountPath = path.resolve(__dirname, '../firebase-admin-key.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const ADMIN_EMAIL = 'admin@auraskills.com';
const ADMIN_PASSWORD = 'admin@123';

async function initializeAdmin() {
  try {
    console.log('🔥 Initializing Firebase Admin User...\n');

    // Check if user already exists
    try {
      const existingUser = await admin.auth().getUserByEmail(ADMIN_EMAIL);
      console.log('✅ Admin user already exists:', ADMIN_EMAIL);
      console.log('   UID:', existingUser.uid);
      
      // Update Firestore document
      await admin.firestore().collection('users').doc(existingUser.uid).set({
        id: existingUser.uid,
        email: ADMIN_EMAIL,
        password_hash: require('crypto').createHash('sha256').update(ADMIN_PASSWORD).digest('hex'),
        name: 'Admin',
        is_admin: true,
        target_role: null,
        skills: [],
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      
      console.log('✅ Admin user document updated in Firestore\n');
      return;
    } catch (error) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    // Create new admin user
    console.log('Creating new admin user...');
    const userRecord = await admin.auth().createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      displayName: 'Admin',
      emailVerified: true,
    });

    console.log('✅ Firebase Auth user created');
    console.log('   UID:', userRecord.uid);
    console.log('   Email:', userRecord.email);

    // Create Firestore document
    await admin.firestore().collection('users').doc(userRecord.uid).set({
      id: userRecord.uid,
      email: ADMIN_EMAIL,
      password_hash: require('crypto').createHash('sha256').update(ADMIN_PASSWORD).digest('hex'),
      name: 'Admin',
      is_admin: true,
      target_role: null,
      skills: [],
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('✅ Firestore user document created\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 Admin user initialized successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📋 Admin Credentials:');
    console.log('   Email:', ADMIN_EMAIL);
    console.log('   Password:', ADMIN_PASSWORD);
    console.log('\n💡 You can now log in with these credentials\n');

  } catch (error) {
    console.error('❌ Error initializing admin user:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

initializeAdmin();
