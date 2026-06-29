// Generate a bcrypt hash for an admin password.
// Usage: npx tsx apps/web/scripts/hash-password.ts 'DdotsAdmin@2026'
import bcrypt from 'bcryptjs';

const pw = process.argv[2];
if (!pw) {
  console.error('Usage: tsx hash-password.ts <password>');
  process.exit(1);
}
bcrypt.hash(pw, 12).then((h) => {
  console.log(h);
});
