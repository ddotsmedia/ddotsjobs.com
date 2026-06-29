-- 0022_admin_credentials — additive. Username/password login for admins.
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_username TEXT UNIQUE;
