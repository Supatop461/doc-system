SELECT * FROM public.users
ORDER BY user_id ASC 


UPDATE public.users
SET password_hash = '<HASH>'
WHERE username = 'admin';


UPDATE public.users
SET password_hash = '$2b$10$P2QOSdmxvgAlDQJWSEeUDefwfdEfers2Ltg.OxCyNCbzGcwXX795m'
WHERE username = 'user1';


UPDATE public.users
SET password_hash = '<HASH>'
WHERE username = 'user1';


SELECT username, password_hash, role FROM public.users ORDER BY user_id;

UPDATE public.users
SET password_hash = '$2b$10$P2QOSdmxvgAlDQJWSEeUDefwfdEfers2Ltg.OxCyNCbzGcwXX795m'
WHERE username = 'admin';

SELECT username, password_hash, role
FROM public.users
ORDER BY user_id;

