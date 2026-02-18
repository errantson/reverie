#!/usr/bin/env python3
"""
🐦 AVIARY - Pigeons Automation Runner

Monitors events and triggers automated message delivery based on pigeon rules.
Runs as a standalone service alongside the main admin API.

Architecture:
- Polls database for trigger events every 10 seconds
- Evaluates pigeon conditions against user data
- Sends messages via core.messages module
- Tracks deliveries to prevent duplicates (for non-repeating pigeons)

Trigger Sources:
- Database polling (quest events, canon changes, role updates)
- Time-based cron (scheduled deliveries)
- User activity tracking (login, page visits, idle duration)
"""

import sys
import os
import time
import json
import argparse
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import DatabaseManager
from core.messages import create_message


class AviaryRunner:
    """Main automation runner for Pigeons system"""
    
    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.db = DatabaseManager()
        self.running = True
        
        # Track last check times for different trigger types
        self.last_checks = {
            'quest_events': 0,
            'canon_changes': 0,
            'role_changes': 0,
            'user_activity': 0,
            'time_based': 0
        }
        
        self.log("🐦 Aviary starting up...")
    
    def log(self, message: str, force: bool = False):
        """Log message with timestamp"""
        if self.verbose or force:
            timestamp = datetime.now().strftime("%H:%M:%S")
            print(f"[{timestamp}] {message}")
    
    def debug(self, category: str, message: str, data: Optional[Dict] = None):
        """Enhanced debug logging with category and optional data"""
        if self.verbose:
            timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
            log_msg = f"[{timestamp}] [{category}] {message}"
            if data:
                log_msg += f" | Data: {json.dumps(data, default=str)}"
            print(log_msg)
    
    def run(self):
        """Main run loop"""
        self.log("✅ Aviary is running. Monitoring for triggers...", force=True)
        
        poll_interval = 10  # seconds
        
        try:
            while self.running:
                start_time = time.time()
                
                # Check different trigger types
                self.check_quest_triggers()
                self.check_canon_triggers()
                self.check_role_triggers()
                self.check_user_activity_triggers()
                self.check_time_based_triggers()
                
                elapsed = time.time() - start_time
                sleep_time = max(0, poll_interval - elapsed)
                
                if sleep_time > 0:
                    time.sleep(sleep_time)
                    
        except KeyboardInterrupt:
            self.log("🛑 Aviary shutting down...", force=True)
            self.running = False
    
    # ========================================================================
    # TRIGGER CHECKERS
    # ========================================================================
    
    def check_quest_triggers(self):
        """Check for quest-related triggers"""
        now = int(time.time())
        since = self.last_checks['quest_events']
        
        # Get active pigeons watching quest events
        pigeons = self.db.fetch_all('''
            SELECT id, name, trigger_type, trigger_config, dialogue_key,
                   conditions, condition_operator, priority, repeating
            FROM pigeons
            WHERE status = 'active' 
              AND trigger_type IN ('quest_started', 'quest_completed', 'quest_abandoned')
        ''')
        
        if not pigeons:
            return
        
        # Check for quest events since last check
        # This requires a quest_events table or similar tracking
        # For now, we'll log that we're checking
        self.log(f"🔍 Checking {len(pigeons)} quest-watching pigeons...")
        
        self.last_checks['quest_events'] = now
    
    def check_canon_triggers(self):
        """Check for canon-related triggers"""
        now = int(time.time())
        
        self.debug("CANON_CHECK", "Starting canon trigger check")
        
        # Get active pigeons watching canon changes
        pigeons = self.db.fetch_all('''
            SELECT id, name, trigger_type, trigger_config, dialogue_key,
                   conditions, condition_operator, priority, repeating
            FROM pigeons
            WHERE status = 'active' 
              AND trigger_type IN ('canon_set', 'canon_equals', 'canon_changed')
        ''')
        
        self.debug("CANON_CHECK", f"Found {len(pigeons)} active canon-watching pigeons")
        
        if not pigeons:
            return
        
        # Get all users to check their canon values
        user_rows = self.db.fetch_all('SELECT did FROM users')
        users = [row['did'] for row in user_rows]
        
        self.debug("CANON_CHECK", f"Checking canon triggers for {len(users)} users")
        
        for pigeon in pigeons:
            pigeon_id = pigeon['id']
            trigger_config = json.loads(pigeon['trigger_config']) if pigeon['trigger_config'] else {}
            canon_key = trigger_config.get('canon_key')
            
            if not canon_key:
                self.debug("CANON_CHECK", f"Pigeon {pigeon['name']} missing canon_key in config", 
                          {"pigeon_id": pigeon_id})
                continue
            
            self.debug("CANON_CHECK", f"Checking pigeon '{pigeon['name']}' for canon key '{canon_key}'",
                      {"pigeon_id": pigeon_id, "trigger_type": pigeon['trigger_type']})
            
            for user_did in users:
                # Check if already delivered (if non-repeating)
                if not pigeon['repeating']:
                    delivered = self.db.fetch_one('''
                        SELECT 1 FROM pigeon_deliveries 
                        WHERE pigeon_id = %s AND user_did = %s
                    ''', (pigeon_id, user_did))
                    
                    if delivered:
                        continue
                
                # Get user's canon value
                canon_row = self.db.fetch_one('''
                    SELECT value FROM canon 
                    WHERE user_did = %s AND key = %s
                ''', (user_did, canon_key))
                
                triggered = False
                trigger_data = {"canon_key": canon_key}
                
                if pigeon['trigger_type'] == 'canon_set':
                    # Trigger if canon key exists with any value
                    if canon_row:
                        triggered = True
                        trigger_data['value'] = canon_row['value']
                        self.debug("CANON_SET", f"Canon key '{canon_key}' is set for user", 
                                  {"user_did": user_did, "value": canon_row['value']})
                
                elif pigeon['trigger_type'] == 'canon_equals':
                    # Trigger if canon key equals specific value
                    expected_value = str(trigger_config.get('value', ''))
                    if canon_row and str(canon_row['value']) == expected_value:
                        triggered = True
                        trigger_data['value'] = canon_row['value']
                        self.debug("CANON_EQUALS", f"Canon key '{canon_key}' equals '{expected_value}'", 
                                  {"user_did": user_did})
                
                if triggered:
                    # Evaluate additional conditions
                    if self.evaluate_conditions(pigeon, user_did):
                        if self.should_deliver(pigeon_id, user_did):
                            self.debug("DELIVERY", f"Delivering pigeon '{pigeon['name']}' to user",
                                      {"pigeon_id": pigeon_id, "user_did": user_did, "trigger_data": trigger_data})
                            self.deliver_message(pigeon, user_did, trigger_data)
        
        self.last_checks['canon_changes'] = now
    
    def check_role_triggers(self):
        """Check for role-related triggers"""
        now = int(time.time())
        
        self.debug("ROLE_CHECK", "Starting role trigger check")
        
        pigeons = self.db.fetch_all('''
            SELECT id, name, trigger_type, trigger_config, dialogue_key,
                   conditions, condition_operator, priority, repeating
            FROM pigeons
            WHERE status = 'active' 
              AND trigger_type IN ('role_granted', 'role_revoked')
        ''')
        
        self.debug("ROLE_CHECK", f"Found {len(pigeons)} active role-watching pigeons")
        
        if not pigeons:
            return
        
        # Get all users with roles from user_roles table
        user_rows = self.db.fetch_all('SELECT DISTINCT did FROM user_roles')
        users = [row['did'] for row in user_rows]
        
        self.debug("ROLE_CHECK", f"Checking role triggers for {len(users)} users with roles")
        
        for pigeon in pigeons:
            pigeon_id = pigeon['id']
            trigger_config = json.loads(pigeon['trigger_config']) if pigeon['trigger_config'] else {}
            target_role = trigger_config.get('role')
            
            if not target_role:
                self.debug("ROLE_CHECK", f"Pigeon {pigeon['name']} missing role in config",
                          {"pigeon_id": pigeon_id})
                continue
            
            self.debug("ROLE_CHECK", f"Checking pigeon '{pigeon['name']}' for role '{target_role}'",
                      {"pigeon_id": pigeon_id, "trigger_type": pigeon['trigger_type']})
            
            for user_did in users:
                # Get user's roles from user_roles table
                roles_rows = self.db.fetch_all('''
                    SELECT role FROM user_roles 
                    WHERE did = %s AND status = 'active'
                ''', (user_did,))
                
                user_roles = [row['role'] for row in roles_rows] if roles_rows else []
                has_role = target_role in user_roles
                
                triggered = False
                trigger_data = {"role": target_role}
                
                if pigeon['trigger_type'] == 'role_granted' and has_role:
                    triggered = True
                    self.debug("ROLE_GRANTED", f"User has role '{target_role}'",
                              {"user_did": user_did, "all_roles": user_roles})
                elif pigeon['trigger_type'] == 'role_revoked' and not has_role:
                    triggered = True
                    self.debug("ROLE_REVOKED", f"User missing role '{target_role}'",
                              {"user_did": user_did, "all_roles": user_roles})
                
                if triggered:
                    if self.evaluate_conditions(pigeon, user_did):
                        if self.should_deliver(pigeon_id, user_did):
                            self.debug("DELIVERY", f"Delivering pigeon '{pigeon['name']}' to user",
                                      {"pigeon_id": pigeon_id, "user_did": user_did, "trigger_data": trigger_data})
                            self.deliver_message(pigeon, user_did, trigger_data)
        
        self.last_checks['role_changes'] = now
    
    def check_user_activity_triggers(self):
        """Check for user activity triggers (return_visit, idle_duration, etc.)"""
        # Note: user_login is handled by direct API call from login.js, not polling
        now = int(time.time())
        
        self.debug("ACTIVITY_CHECK", "Starting user activity trigger check")
        
        pigeons = self.db.fetch_all('''
            SELECT id, name, trigger_type, trigger_config, dialogue_key,
                   conditions, condition_operator, priority, repeating
            FROM pigeons
            WHERE status = 'active' 
              AND trigger_type IN ('return_visit', 'idle_duration')
        ''')
        
        self.debug("ACTIVITY_CHECK", f"Found {len(pigeons)} active activity-watching pigeons")
        
        if not pigeons:
            return
        
        # Check return_visit pigeons
        return_visit_pigeons = [p for p in pigeons if p['trigger_type'] == 'return_visit']
        if return_visit_pigeons:
            self.debug("ACTIVITY_CHECK", f"Processing {len(return_visit_pigeons)} return_visit pigeons")
            self.process_return_visit_triggers(return_visit_pigeons)
        
        # Check idle_duration pigeons
        idle_pigeons = [p for p in pigeons if p['trigger_type'] == 'idle_duration']
        if idle_pigeons:
            self.debug("ACTIVITY_CHECK", f"Processing {len(idle_pigeons)} idle_duration pigeons")
            self.process_idle_duration_triggers(idle_pigeons)
        
        self.last_checks['user_activity'] = now
    
    def check_time_based_triggers(self):
        """Check for scheduled/cron-like triggers"""
        now = int(time.time())
        
        pigeons = self.db.fetch_all('''
            SELECT id, name, trigger_type, trigger_config, dialogue_key,
                   conditions, condition_operator, priority, repeating
            FROM pigeons
            WHERE status = 'active' 
              AND trigger_type = 'time_based'
        ''')
        
        if not pigeons:
            return
        
        for pigeon in pigeons:
            config = json.loads(pigeon['trigger_config']) if pigeon['trigger_config'] else {}
            
            # Parse cron-like schedule (simplified)
            # Example: {"hour": 9, "days": [1, 3, 5]}  # Mon, Wed, Fri at 9am
            self.log(f"⏰ Checking time-based pigeon: {pigeon['name']}")
        
        self.last_checks['time_based'] = now
    
    # ========================================================================
    # SPECIFIC TRIGGER PROCESSORS
    # ========================================================================
    
    def process_first_login_triggers(self, pigeons: List[Dict]):
        """Send messages to users on their first login"""
        # Get users who logged in recently and haven't been sent these messages
        for pigeon in pigeons:
            self.log(f"👋 Processing first_login pigeon: {pigeon['name']}")
            
            # Find users who match conditions
            matching_users = self.find_matching_users(pigeon)
            
            # Send to each matching user (if not already sent)
            for user_did in matching_users:
                if self.should_deliver(pigeon['id'], user_did):
                    self.deliver_message(pigeon, user_did, {'trigger': 'first_login'})
    
    def process_user_login_trigger(self, user_did: str):
        """
        Process user_login trigger for a specific user.
        Called directly from API when user logs in (OAuth or PDS).
        Fires every time the user logs in.
        """
        self.log(f"🔑 Processing user_login trigger for {user_did}")
        
        # Get all active user_login pigeons
        rows = self.db.fetch_all('''
            SELECT * FROM pigeons
            WHERE trigger_type = 'user_login'
            AND status = 'active'
        ''')
        
        pigeons = [dict(row) for row in rows]
        
        for pigeon in pigeons:
            self.debug("USER_LOGIN", f"Checking pigeon '{pigeon['name']}'",
                      {"pigeon_id": pigeon['id'], "user_did": user_did})
            
            # Check if user matches conditions
            if self.evaluate_conditions(pigeon, user_did):
                # Check if should deliver (respects repeating flag)
                if self.should_deliver(pigeon['id'], user_did):
                    self.log(f"✉️  Delivering user_login pigeon '{pigeon['name']}' to {user_did}")
                    self.deliver_message(pigeon, user_did, {'trigger': 'user_login'})
                else:
                    self.debug("USER_LOGIN", f"Already delivered to this user",
                              {"pigeon_id": pigeon['id'], "user_did": user_did})
            else:
                self.debug("USER_LOGIN", f"Conditions not met",
                          {"pigeon_id": pigeon['id'], "user_did": user_did})
    
    def process_return_visit_triggers(self, pigeons: List[Dict]):
        """Send messages to users returning after being away"""
        for pigeon in pigeons:
            config = json.loads(pigeon['trigger_config']) if pigeon['trigger_config'] else {}
            days_away = config.get('days_away', 7)
            
            self.debug("RETURN_VISIT", f"Processing pigeon '{pigeon['name']}'",
                      {"pigeon_id": pigeon['id'], "days_away": days_away})
            
            # Find users who haven't logged in for N days but recently came back
            cutoff_start = int(time.time()) - (days_away * 86400)
            cutoff_end = int(time.time()) - ((days_away - 1) * 86400)
            
            cursor = self.db.fetch_all('''
                SELECT did, last_active
                FROM dreamers
                WHERE last_active BETWEEN %s AND %s
            ''', (cutoff_start, cutoff_end))
            
            for row in cursor:
                user_did = row['did']
                
                self.debug("RETURN_VISIT", f"User returned after {days_away} days",
                          {"user_did": user_did, "last_active": row['last_active']})
                
                # Check if matches conditions
                if self.evaluate_conditions(pigeon, user_did):
                    if self.should_deliver(pigeon['id'], user_did):
                        self.deliver_message(pigeon, user_did, {
                            'trigger': 'return_visit',
                            'days_away': days_away
                        })
    
    def process_idle_duration_triggers(self, pigeons: List[Dict]):
        """Send messages to users who have been inactive"""
        for pigeon in pigeons:
            config = json.loads(pigeon['trigger_config']) if pigeon['trigger_config'] else {}
            idle_days = config.get('days', 7)
            
            self.debug("IDLE_DURATION", f"Processing pigeon '{pigeon['name']}'",
                      {"pigeon_id": pigeon['id'], "idle_days": idle_days})
            
            # Find users inactive for N days
            cutoff = int(time.time()) - (idle_days * 86400)
            
            rows = self.db.fetch_all('''
                SELECT did, last_active
                FROM dreamers
                WHERE last_active < %s
            ''', (cutoff,))
            
            for row in rows:
                user_did = row['did']
                
                self.debug("IDLE_DURATION", f"User idle for {idle_days}+ days",
                          {"user_did": user_did, "last_active": row['last_active']})
                
                # Check if matches conditions
                if self.evaluate_conditions(pigeon, user_did):
                    if self.should_deliver(pigeon['id'], user_did):
                        self.deliver_message(pigeon, user_did, {
                            'trigger': 'idle_duration',
                            'idle_days': idle_days
                        })
    
    # ========================================================================
    # CONDITION EVALUATION
    # ========================================================================
    
    def evaluate_conditions(self, pigeon: Dict, user_did: str) -> bool:
        """
        Evaluate if user matches pigeon's conditions.
        
        Args:
            pigeon: Pigeon dict with conditions and operator
            user_did: User's DID
            
        Returns:
            True if user matches conditions, False otherwise
        """
        conditions = json.loads(pigeon['conditions']) if pigeon['conditions'] else []
        
        if not conditions:
            self.debug("CONDITIONS", f"No conditions for pigeon '{pigeon['name']}' - auto-match",
                      {"pigeon_id": pigeon['id'], "user_did": user_did})
            return True  # No conditions = always match
        
        operator = pigeon['condition_operator'] or 'AND'
        
        self.debug("CONDITIONS", f"Evaluating {len(conditions)} conditions with {operator} operator",
                  {"pigeon_id": pigeon['id'], "user_did": user_did, "conditions": conditions})
        
        results = []
        for idx, condition in enumerate(conditions):
            result = self.evaluate_single_condition(condition, user_did)
            results.append(result)
            
            self.debug("CONDITIONS", f"Condition {idx+1}/{len(conditions)}: {condition.get('type')} = {result}",
                      {"user_did": user_did, "condition": condition})
            
            # Short-circuit for AND
            if operator == 'AND' and not result:
                self.debug("CONDITIONS", f"AND short-circuit: condition failed",
                          {"user_did": user_did})
                return False
            
            # Short-circuit for OR
            if operator == 'OR' and result:
                self.debug("CONDITIONS", f"OR short-circuit: condition passed",
                          {"user_did": user_did})
                return True
        
        # Final evaluation
        final_result = all(results) if operator == 'AND' else any(results)
        self.debug("CONDITIONS", f"Final result: {final_result}",
                  {"user_did": user_did, "operator": operator, "results": results})
        return final_result
    
    def evaluate_single_condition(self, condition: Dict, user_did: str) -> bool:
        """
        Evaluate a single condition against user data.
        
        Condition types:
        - has_canon: User has canon key set
        - canon_equals: Canon key equals value
        - has_role: User has specific role
        - quest_completed: User completed quest
        - stat_threshold: User stat meets threshold
        """
        cond_type = condition.get('type')
        
        if cond_type == 'has_canon':
            key = condition.get('key')
            return self.user_has_canon(user_did, key)
        
        elif cond_type == 'canon_equals':
            key = condition.get('key')
            value = condition.get('value')
            return self.user_canon_equals(user_did, key, value)
        
        elif cond_type == 'has_role':
            role = condition.get('role')
            return self.user_has_role(user_did, role)
        
        elif cond_type == 'quest_completed':
            quest_key = condition.get('quest_key')
            return self.user_completed_quest(user_did, quest_key)
        
        elif cond_type == 'stat_threshold':
            stat = condition.get('stat')
            threshold = condition.get('threshold')
            operator = condition.get('operator', '>=')
            return self.user_stat_threshold(user_did, stat, threshold, operator)
        
        else:
            self.log(f"⚠️ Unknown condition type: {cond_type}")
            return False
    
    # ========================================================================
    # USER DATA HELPERS
    # ========================================================================
    
    def user_has_canon(self, user_did: str, key: str) -> bool:
        """Check if user has canon key set"""
        row = self.db.fetch_one('''
            SELECT value FROM canon WHERE did = %s AND key = %s
        ''', (user_did, key))
        return row is not None
    
    def user_canon_equals(self, user_did: str, key: str, value: str) -> bool:
        """Check if user's canon key equals specific value"""
        row = self.db.fetch_one('''
            SELECT value FROM canon WHERE did = %s AND key = %s
        ''', (user_did, key))
        return row and row['value'] == value
    
    def user_has_role(self, user_did: str, role: str) -> bool:
        """Check if user has specific role"""
        row = self.db.fetch_one('''
            SELECT role FROM user_roles 
            WHERE did = %s AND role = %s AND status = 'active'
        ''', (user_did, role))
        return row is not None
    
    def user_completed_quest(self, user_did: str, quest_key: str) -> bool:
        """Check if user completed specific quest"""
        # This requires quest tracking table
        # For now, return False
        return False
    
    def user_stat_threshold(self, user_did: str, stat: str, threshold: float, operator: str) -> bool:
        """Check if user's stat meets threshold"""
        # Get stat value (followers, posts, etc.)
        row = self.db.fetch_one('''
            SELECT {} FROM dreamers WHERE did = %s
        '''.format(stat), (user_did,))
        
        if not row:
            return False
        
        value = row[stat]
        
        if operator == '>=':
            return value >= threshold
        elif operator == '>':
            return value > threshold
        elif operator == '<=':
            return value <= threshold
        elif operator == '<':
            return value < threshold
        elif operator == '==':
            return value == threshold
        else:
            return False
    
    def find_matching_users(self, pigeon: Dict) -> List[str]:
        """
        Find all users who match pigeon's conditions.
        
        Returns:
            List of user DIDs
        """
        # Get all users
        all_rows = self.db.fetch_all('SELECT did FROM dreamers')
        all_users = [row['did'] for row in all_rows]
        
        # Filter by conditions
        matching = []
        for user_did in all_users:
            if self.evaluate_conditions(pigeon, user_did):
                matching.append(user_did)
        
        return matching
    
    # ========================================================================
    # MESSAGE DELIVERY
    # ========================================================================
    
    def should_deliver(self, pigeon_id: int, user_did: str) -> bool:
        """
        Check if message should be delivered to user.
        
        Prevents duplicate deliveries for non-repeating pigeons.
        Checks max_deliveries cap.
        """
        # Get pigeon settings
        row = self.db.fetch_one('''
            SELECT repeating, max_deliveries
            FROM pigeons
            WHERE id = %s
        ''', (pigeon_id,))
        
        if not row:
            return False
        
        repeating = bool(row['repeating'])
        max_deliveries = row['max_deliveries']
        
        # Check if already delivered to this user
        count_row = self.db.fetch_one('''
            SELECT COUNT(*) as count
            FROM pigeon_deliveries
            WHERE pigeon_id = %s AND user_did = %s
        ''', (pigeon_id, user_did))
        
        delivery_count = count_row['count']
        
        # Non-repeating pigeons only send once
        if not repeating and delivery_count > 0:
            return False
        
        # Check max deliveries (total across all users)
        if max_deliveries:
            total_row = self.db.fetch_one('''
                SELECT COUNT(*) as total
                FROM pigeon_deliveries
                WHERE pigeon_id = %s
            ''', (pigeon_id,))
            
            total_deliveries = total_row['total']
            if total_deliveries >= max_deliveries:
                # Delete pigeon (reached max deliveries)
                self.db.execute('''
                    DELETE FROM pigeons WHERE id = %s
                ''', (pigeon_id,))
                # DatabaseManager auto-commits
                self.log(f"💥 Pigeon {pigeon_id} deleted (max deliveries of {max_deliveries} reached)", force=True)
                self.debug("MAX_DELIVERIES", f"Pigeon auto-deleted after reaching limit",
                          {"pigeon_id": pigeon_id, "max_deliveries": max_deliveries, "total_deliveries": total_deliveries})
                return False
        
        return True
    
    def deliver_message(self, pigeon: Dict, user_did: str, trigger_data: Dict) -> bool:
        """
        Send message to user via pigeon.
        
        Args:
            pigeon: Pigeon dict
            user_did: User's DID
            trigger_data: Context about what triggered delivery
            
        Returns:
            True if delivered successfully
        """
        pigeon_id = pigeon['id']
        pigeon_name = pigeon['name']
        dialogue_key = pigeon['dialogue_key']
        
        self.debug("DELIVER", f"Attempting delivery of pigeon '{pigeon_name}'",
                  {"pigeon_id": pigeon_id, "user_did": user_did, "dialogue_key": dialogue_key,
                   "trigger_data": trigger_data})
        
        try:
            # Load dialogue template
            dialogue_messages = self.db.fetch_all('''
                SELECT sequence, speaker, avatar, text, buttons_json
                FROM dialogues
                WHERE key = %s AND enabled = true
                ORDER BY sequence
            ''', (dialogue_key,))
            
            if not dialogue_messages:
                self.debug("DELIVER_ERROR", f"No dialogue messages found for key '{dialogue_key}'",
                          {"pigeon_id": pigeon_id, "dialogue_key": dialogue_key})
                return False
            
            self.debug("DELIVER", f"Found {len(dialogue_messages)} dialogue messages",
                      {"pigeon_id": pigeon_id, "dialogue_key": dialogue_key})
            
            messages_data = []
            for row in dialogue_messages:
                # Interpolate placeholders in text
                text = self.interpolate_message_text(row['text'], user_did)
                
                msg = {
                    'speaker': row['speaker'],
                    'avatar': row['avatar'],
                    'text': text
                }
                if row['buttons_json']:
                    msg['buttons'] = json.loads(row['buttons_json'])
                messages_data.append(msg)
            
            self.debug("DELIVER", f"Prepared {len(messages_data)} message objects",
                      {"pigeon_id": pigeon_id})
            
            # Create message
            self.debug("DELIVER", "Calling create_message()",
                      {"user_did": user_did, "dialogue_key": dialogue_key, 
                       "priority": pigeon['priority'], "message_count": len(messages_data)})
            
            message_id = create_message(
                user_did=user_did,
                dialogue_key=dialogue_key,
                messages_data=messages_data,
                source='pigeon',
                priority=pigeon['priority']
            )
            
            self.debug("DELIVER", f"Message created with ID: {message_id}",
                      {"pigeon_id": pigeon_id, "message_id": message_id})
            
            # Track delivery (with duplicate protection via unique index)
            now = int(time.time())
            try:
                self.db.execute('''
                    INSERT INTO pigeon_deliveries (
                        pigeon_id, user_did, message_id, trigger_data, delivered_at
                    ) VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (pigeon_id, user_did) WHERE pigeon_id IS NOT NULL DO NOTHING
                ''', (pigeon_id, user_did, message_id, json.dumps(trigger_data), now))
                
                # Note: DatabaseManager auto-commits, no need to call commit()
            except Exception as e:
                self.debug("DELIVERY_TRACKING_ERROR", f"Failed to track delivery (possible duplicate): {e}",
                          {"pigeon_id": pigeon_id, "user_did": user_did, "message_id": message_id})
                # If we couldn't track it, it might be a duplicate - don't log success
                return False
            
            self.log(f"📬 Delivered '{dialogue_key}' to {user_did[:20]}... via pigeon '{pigeon_name}'", force=True)
            self.debug("DELIVER_SUCCESS", "Delivery complete and tracked",
                      {"pigeon_id": pigeon_id, "pigeon_name": pigeon_name, "user_did": user_did,
                       "message_id": message_id, "trigger_data": trigger_data})
            
            # Note: Non-repeating pigeons stay active but won't send to the same user twice
            # The pigeon is NOT deleted - it can still send to other users
            
            return True
            
        except Exception as e:
            self.log(f"❌ Error delivering pigeon '{pigeon_name}': {e}", force=True)
            self.debug("DELIVER_ERROR", f"Exception during delivery: {str(e)}",
                      {"pigeon_id": pigeon_id, "user_did": user_did, "error": str(e),
                       "error_type": type(e).__name__})
            import traceback
            if self.verbose:
                traceback.print_exc()
            return False
    
    def interpolate_message_text(self, text: str, user_did: str) -> str:
        """
        Replace {placeholders} in message text with user-specific data.
        
        Available placeholders:
        - {name} - User's display name
        - {handle} - User's handle (@username.bsky.social)
        - {username} - Just the username part
        - {origin} - Link to origin post (if available)
        - {zone} - User's zone number (from canon)
        """
        import re
        
        # Build user context
        context = self.get_user_context(user_did)
        
        def replacer(match):
            key = match.group(1)
            return str(context.get(key, match.group(0)))
        
        return re.sub(r'\{(\w+)\}', replacer, text)
    
    def get_user_context(self, user_did: str) -> dict:
        """
        Get user data for message interpolation.
        
        Returns dict with available placeholder values.
        """
        context = {
            'did': user_did,
            'name': 'friend',  # Default fallback
            'handle': 'unknown',
            'username': 'unknown'
        }
        
        # Get user data from dreamers table
        user_row = self.db.fetch_one('''
            SELECT display_name, handle
            FROM dreamers
            WHERE did = %s
        ''', (user_did,))
        
        if user_row:
            if user_row['display_name']:
                context['name'] = user_row['display_name']
            if user_row['handle']:
                context['handle'] = user_row['handle']
                # Extract username from handle
                if '.' in user_row['handle']:
                    context['username'] = user_row['handle'].split('.')[0].lstrip('@')
        
        # Canon data is stored in the canon table but doesn't have values
        # Pigeons can use other context data instead
        
        return context


def main():
    """CLI entry point"""
    parser = argparse.ArgumentParser(description='Aviary - Pigeons Automation Runner')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose logging')
    parser.add_argument('--once', action='store_true', help='Run once then exit (for testing)')
    
    args = parser.parse_args()
    
    runner = AviaryRunner(verbose=args.verbose)
    
    if args.once:
        # Run one cycle
        runner.log("🧪 Running single check cycle...", force=True)
        runner.check_quest_triggers()
        runner.check_canon_triggers()
        runner.check_role_triggers()
        runner.check_user_activity_triggers()
        runner.check_time_based_triggers()
        runner.log("✅ Single cycle complete", force=True)
    else:
        # Run continuously
        runner.run()


if __name__ == '__main__':
    main()
