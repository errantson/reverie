# Courier Authentication Recovery Implementation

## Summary

Implemented comprehensive auth failure handling for scheduled posts when app passwords expire or become invalid.

## Changes Made

### 1. Database Schema
- ✅ Added `last_failure_at` INTEGER column to `user_credentials` table
- ✅ Added `auth_failed` status to `courier` table constraint
- ✅ Allows tracking when credentials failed and distinguishing auth failures from other failures

### 2. Backend: Courier Service (`/srv/reverie.house/core/courier.py`)
- ✅ Enhanced error handling to detect 401 authentication failures
- ✅ When 401 detected:
  - Post status set to `auth_failed` instead of generic `failed`
  - Error message: "App password expired or invalid. Please reconnect."
  - User credentials marked as `is_valid = FALSE`
  - `last_failure_at` timestamp recorded
- ✅ Prevents courier from retrying failed auth posts indefinitely

### 3. Backend: Auth Status API (`/srv/reverie.house/api/routes/auth_routes.py`)
- ✅ New endpoint: `GET /api/auth-status?did=<user_did>`
- ✅ Returns:
  ```json
  {
    "has_invalid_credentials": boolean,
    "failed_posts_count": integer,
    "last_failure_at": timestamp
  }
  ```
- ✅ Called on dashboard load to detect auth issues proactively

### 4. Backend: Retry API (`/srv/reverie.house/api/routes/courier_routes.py`)
- ✅ New endpoint: `POST /api/courier/retry-auth-failed?user_did=<user_did>`
- ✅ Verifies user has valid credentials
- ✅ Resets all `auth_failed` posts to `pending` status
- ✅ Returns count of posts reset for user feedback

### 5. Frontend: Dashboard Widget (`/srv/reverie.house/site/js/widgets/dashboard.js`)
- ✅ Added `checkAuthStatus()` method - called on dashboard initialization
- ✅ Added `showAuthFailureModal()` - displays blocking modal with:
  - Count of failed posts
  - App password input field
  - "Reconnect & Retry Posts" button
  - "I'll fix this later" dismiss option
- ✅ Added `reconnectAndRetry()` method:
  - Saves new app password via `/api/connect-app-password`
  - Calls `/api/courier/retry-auth-failed` to reset posts
  - Shows success notification with count of posts being retried
  - Refreshes courier schedule view
- ✅ Added `dismissAuthModal()` - removes modal from DOM

### 6. Frontend: Styling (`/srv/reverie.house/site/css/widgets/dashboard.css`)
- ✅ Added `.auth-failure-modal-overlay` - dark overlay backdrop
- ✅ Added `.auth-failure-modal` - centered modal with animations
- ✅ Added `.auth-reconnect-section` - form styling for password input
- ✅ Added `fadeIn` and `slideUp` animations for smooth UX
- ✅ Responsive design works on mobile and desktop

### 7. Tests (`/srv/reverie.house/tests/test_courier_auth_recovery.py`)
- ✅ 8 comprehensive tests covering:
  - Database schema validates `auth_failed` status
  - `last_failure_at` column exists and works
  - Auth status endpoint detects valid/invalid states
  - Retry endpoint resets posts to pending
  - Courier invalidates credentials on 401
  - Complete end-to-end recovery flow

## User Flow

### Normal Operation
1. User schedules post with valid app password
2. Courier sends post successfully at scheduled time
3. Post marked as `sent`

### Auth Failure Flow
1. App password expires/revoked on Bluesky
2. Courier attempts to send scheduled post
3. Receives 401 from Bluesky API
4. **System Response:**
   - Post status → `auth_failed`
   - Credentials → `is_valid = FALSE`
   - `last_failure_at` timestamp recorded
5. Courier stops retrying (prevents spam)

### User Recovery Flow
1. User returns to dashboard
2. Dashboard calls `/api/auth-status` automatically
3. **Modal appears immediately:**
   - "🔒 App Password Required"
   - "X posts waiting to be sent"
   - Password input field shown
4. User enters new app password
5. Clicks "Reconnect & Retry Posts"
6. **System Response:**
   - Saves new encrypted password
   - Marks credentials as `is_valid = TRUE`
   - Resets all `auth_failed` posts → `pending`
   - Shows success: "✅ Reconnected! X posts will retry shortly"
7. Courier picks up pending posts on next cycle (60s)
8. Posts sent successfully

## Security Considerations

- ✅ App passwords stored encrypted (Fernet symmetric encryption)
- ✅ Credentials automatically invalidated on auth failure
- ✅ No retry loops - waits for user to fix credentials
- ✅ User must actively reconnect (prevents silent failures)
- ✅ Rate limiting on retry endpoint (10 req/min)

## Testing

Run tests with Docker access:
```bash
docker exec reverie_api python3 -m pytest tests/test_courier_auth_recovery.py -v
```

Or run from inside Docker container:
```bash
cd /srv/reverie.house
python3 -m pytest tests/test_courier_auth_recovery.py -v
```

## Future Enhancements

Potential improvements:
- [ ] Email notification when auth fails
- [ ] Persistent banner in dashboard (in addition to modal)
- [ ] Retry count tracking to detect repeated failures
- [ ] OAuth refresh token support (when available from Bluesky)
- [ ] Batch credential validation endpoint
- [ ] Admin view of users with invalid credentials

## Files Changed

1. `/srv/reverie.house/core/courier.py` - Auth failure detection
2. `/srv/reverie.house/api/routes/auth_routes.py` - Auth status endpoint
3. `/srv/reverie.house/api/routes/courier_routes.py` - Retry endpoint
4. `/srv/reverie.house/site/js/widgets/dashboard.js` - Frontend logic
5. `/srv/reverie.house/site/css/widgets/dashboard.css` - Modal styling
6. `/srv/reverie.house/tests/test_courier_auth_recovery.py` - Test suite
7. `/srv/reverie.house/tests/README.md` - Documentation update

## Database Migrations Applied

```sql
-- Add last_failure_at column
ALTER TABLE user_credentials 
ADD COLUMN IF NOT EXISTS last_failure_at INTEGER;

-- Add auth_failed status constraint
ALTER TABLE courier 
ADD CONSTRAINT courier_status_valid 
CHECK (status IN ('pending', 'sent', 'failed', 'cancelled', 'auth_failed'));
```

## Deployment Notes

- ✅ Services restarted (courier, API)
- ✅ Database schema updated
- ✅ No breaking changes to existing functionality
- ✅ Backwards compatible (existing `failed` posts unaffected)
- ✅ Frontend loads new code automatically (no cache clear needed)
