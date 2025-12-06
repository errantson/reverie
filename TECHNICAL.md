# Technical Documentation

## Overview
Reverie House is a decentralized social platform built on ATProto (Bluesky), providing community features for creatives, roleplayers, and dreamweavers of various sorts. The system indexes public ATProto data and maintains custom feeds, profiles, and interactions for novel storytelling purposes.

## Architecture

### Backend (Python/Flask)
- **Framework**: Flask with Flask-CORS
- **Database**: PostgreSQL with psycopg2
- **ATProto**: atproto library for firehose and API interactions
- **Authentication**: App passwords via ATProto
- **Rate Limiting**: PostgreSQL-backed persistent rate limiter

### Frontend (Static/HTML)
- **Tech**: Vanilla HTML/CSS/JavaScript
- **Server**: Express.js for API endpoints
- **Styling**: Custom CSS with responsive design

### Data Flow
1. **Firehose Indexer**: Subscribes to ATProto firehose, indexes posts from community members
2. **Profile Updates**: Periodic sync of user profiles and metadata
3. **Feed Generation**: Creates custom feeds (Expanded Lore, Idle Dreaming)
4. **API**: REST endpoints for interactions, authentication, and data retrieval

## Key Components

### Core Modules
- `database.py`: PostgreSQL connection and query management
- `auth.py`: ATProto authentication with token caching
- `firehose_indexer.py`: Real-time post indexing
- `feedgen.py`: Custom feed generation
- `rate_limiter.py`: API rate limiting

### Database Schema
- `dreamers`: User profiles and handles
- `canon`: Labeled posts for story continuity
- `spectrum`: Creative spectrum classifications
- `rate_limits`: API usage tracking

## Deployment
- **Containerized**: Docker Compose setup
- **Reverse Proxy**: Caddy for SSL and routing
- **Automation**: Cron jobs for maintenance tasks
- **Backup**: Automated PostgreSQL dumps

## Development
- **Requirements**: Python 3.8+, Node.js for frontend
- **Testing**: pytest for backend tests
- **Linting**: Follow PEP 8 standards
- **Contributing**: See CONTRIBUTING.md for guidelines

## Security
- Docker secrets for sensitive config
- Rate limiting on all endpoints
- Input validation and sanitization
- Public data only (no private ATProto access)

## Monitoring
- Health checks via `scripts/health_check.sh`
- Docker logs for service monitoring
- Database connection pooling
- Error logging with timestamps

## API Endpoints
- `/api/auth/*`: Authentication flows
- `/api/posts/*`: Post creation and management
- `/api/dreamers/*`: User profile operations
- `/api/admin/*`: Administrative functions

For detailed API documentation, see individual route files in `api/routes/`.