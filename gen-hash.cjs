const crypto = require('crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

const adminHash = hashPassword('admin@123');
console.log('Admin password hash:');
console.log(adminHash);
console.log('\nUse this hash to update the Firestore admin user document.');
