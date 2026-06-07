# Admin Account Setup

Use this when you need an account that can access the admin dashboard at:

```text
http://localhost:8080/admin
```

The backend checks `public.users.global_role = 'admin'`.

## 1. Run migrations

From the backend folder:

```bash
cd Back
npx prisma migrate deploy
npx prisma generate
```

This makes sure the admin-related `is_active` fields exist.

## 2. Create a normal user

Register through the app or API.

Frontend:

```text
http://localhost:8080/register
```

Or API:

```bash
curl -X POST "http://localhost:3000/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Platform Admin",
    "email": "admin@example.com",
    "password": "Password123!"
  }'
```

If email OTP is enabled, verify the account using the OTP flow.

## 3. Promote the user to admin

Connect to Postgres and run:

```sql
UPDATE public.users
SET global_role = 'admin',
    is_active = true,
    email_verified_at = COALESCE(email_verified_at, NOW())
WHERE email = 'admin@example.com';
```

If you are using the included Docker database, a typical command is:

```bash
docker exec -it <postgres-container-name> psql -U postgres -d hesbtk
```

Then paste the SQL above.

## 4. Login

Login normally:

```text
http://localhost:8080/login
```

Admin users are redirected to:

```text
http://localhost:8080/admin
```

## Troubleshooting

If login works but `/admin` says admin access is required, confirm the role:

```sql
SELECT id, full_name, email, global_role, is_active, email_verified_at
FROM public.users
WHERE email = 'admin@example.com';
```

Expected values:

```text
global_role = admin
is_active = true
```

If the backend says a column does not exist, run migrations again from `Back`:

```bash
npx prisma migrate deploy
npx prisma generate
```
