-- Schema V14: User Roles and Permissions
-- Add role-based access control for analysis mode management

-- Create user role enum type
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'mode_manager', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add role column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'user';

-- Create index for role-based queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Set first user as admin (update this with actual user ID)
-- UPDATE users SET role = 'admin' WHERE id = 'YOUR_FIRST_ADMIN_USER_ID';

-- Comment: To set your first admin, run:
-- UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
-- or
-- UPDATE users SET role = 'admin' WHERE student_id = 'YOUR_STUDENT_ID';
