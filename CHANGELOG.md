# Changelog

All notable changes to Reverie House will be documented in this file.

## [Unreleased]

### Added
- Account deletion functionality with proper PDS account removal
- User deletion endpoint (`DELETE /api/user/delete`)
- Deactivation check during login (prevents login to deleted accounts)
- Delete account widget in user dashboard
- `formers` table for archiving deleted user profiles
- Asset archiving (avatars/banners) for deleted accounts
- Departure event logging in world history
- Session cleanup on account deletion
- Comprehensive test suite for account deletion flow

### Changed
- Moved documentation files to `docs/` directory
- Improved login flow with early deactivation detection
- Enhanced error messages for deactivated accounts
- Updated feedgen routing to use localhost instead of container names
- Changed deletion logging from `logger` to `print()` for visibility

### Fixed
- Account deletion now properly deletes PDS accounts (liberates handles)
- Login blocked for deactivated accounts before PDS authentication attempt
- UPSERT logic for formers table (handles duplicate deletion attempts)
- Feedgen endpoints returning 502 errors (network routing issue)
- Session tokens persisting after account deletion

### Security
- Added rate limiting to account deletion endpoint
- Enhanced authentication checks for account deletion
- Proper session invalidation on account deletion

## [1.0.0] - 2024

### Initial Release
- Personal Data Server (PDS) integration
- Custom Bluesky feeds (Expanded Lore, Idle Dreaming)
- World management system
- Greeter/Mapper role system
- Quest system for community activities
- Spectrum personality analysis
- Souvenir collection system
- Integration with lore.farm labeling service
- Admin panel for community management
- OAuth authentication flow
- Courier system for scheduled posts
