#!/bin/bash
# Profile Refresh Cron Job
# Runs daily to refresh outdated dreamer profiles

cd /srv/reverie.house

# Refresh profiles older than 7 days
python3 utils/refresh_profiles.py --all --days 7 --quiet >> /srv/logs/profile-refresh.log 2>&1

# Also clean up the log (keep last 1000 lines)
tail -1000 /srv/logs/profile-refresh.log > /srv/logs/profile-refresh.log.tmp
mv /srv/logs/profile-refresh.log.tmp /srv/logs/profile-refresh.log
