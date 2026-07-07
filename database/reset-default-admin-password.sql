update public.admin_users
set password_hash = '$2b$12$XGHuzcpNZqfBmvXo0ccVSuXj7R82ZCYfphW3vA1UTSyjzGRjaH8rq',
    role = 'admin',
    updated_at = now()
where login_id = 'SanupLib';
