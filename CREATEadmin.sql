CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO public.users (username, password_hash, role, is_active, created_at, updated_at)
VALUES (
  '671021',                             
  crypt('1234', gen_salt('bf')),         
  'ADMIN',
  TRUE,
  NOW(),
  NOW()
);