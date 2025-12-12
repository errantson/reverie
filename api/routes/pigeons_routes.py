"""
Pigeons Routes Blueprint
Handles automated message delivery configuration
"""

from flask import Blueprint, request, jsonify
import time
import json

# Create blueprint
bp = Blueprint('pigeons', __name__, url_prefix='/api/pigeons')

# Import shared dependencies
from core.admin_auth import require_auth
from core.database import DatabaseManager


# ============================================================================
# PIGEONS CRUD ENDPOINTS
# ============================================================================

@bp.route('/list', methods=['GET'])
@require_auth()
def list_pigeons():
    """Get all pigeons (automation rules)"""
    try:
        print(f"[PIGEONS_API] Listing all pigeons")
        db = DatabaseManager()
        
        cursor = db.execute('''
            SELECT 
                id, name, status, trigger_type, trigger_config,
                dialogue_key, conditions, condition_operator,
                priority, repeating, max_deliveries,
                created_at, updated_at, created_by
            FROM pigeons
            ORDER BY name
        ''')
        
        pigeons = []
        for row in cursor.fetchall():
            # Parse JSON fields
            trigger_config = None
            if row['trigger_config']:
                try:
                    trigger_config = json.loads(row['trigger_config'])
                except Exception as e:
                    print(f"[PIGEONS_API] Error parsing trigger_config for pigeon {row['id']}: {e}")
                    trigger_config = {}
            
            conditions = []
            if row['conditions']:
                try:
                    conditions = json.loads(row['conditions'])
                except Exception as e:
                    print(f"[PIGEONS_API] Error parsing conditions for pigeon {row['id']}: {e}")
                    conditions = []
            
            pigeons.append({
                'id': row['id'],
                'name': row['name'],
                'status': row['status'],
                'trigger_type': row['trigger_type'],
                'trigger_config': trigger_config,
                'dialogue_key': row['dialogue_key'],
                'conditions': conditions,
                'condition_operator': row['condition_operator'],
                'priority': row['priority'],
                'repeating': bool(row['repeating']),
                'max_deliveries': row['max_deliveries'],
                'created_at': row['created_at'],
                'updated_at': row['updated_at'],
                'created_by': row['created_by']
            })
        
        print(f"[PIGEONS_API] Returning {len(pigeons)} pigeons")
        return jsonify({'status': 'success', 'pigeons': pigeons})
        
    except Exception as e:
        print(f"[PIGEONS_API] Error listing pigeons: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'error': str(e)}), 500


@bp.route('/create', methods=['POST'])
@require_auth()
def create_pigeon():
    """Create a new pigeon automation"""
    try:
        data = request.get_json()
        print(f"[PIGEONS_API] Creating pigeon with data: {json.dumps(data, indent=2)}")
        
        name = data.get('name', '').strip()
        status = data.get('status', 'active')
        trigger_type = data.get('trigger_type', 'manual')
        trigger_config = data.get('trigger_config')
        dialogue_key = data.get('dialogue_key', '')
        conditions = data.get('conditions', [])
        condition_operator = data.get('condition_operator', 'AND')
        priority = data.get('priority', 50)
        repeating = data.get('repeating', True)
        max_deliveries = data.get('max_deliveries')
        
        if not name:
            print(f"[PIGEONS_API] Error: Name is required")
            return jsonify({'status': 'error', 'error': 'Name is required'}), 400
        
        print(f"[PIGEONS_API] Creating pigeon '{name}' with trigger '{trigger_type}'")
        
        db = DatabaseManager()
        now = int(time.time())
        
        # Convert to JSON
        trigger_config_json = json.dumps(trigger_config) if trigger_config else None
        conditions_json = json.dumps(conditions)
        
        cursor = db.execute('''
            INSERT INTO pigeons (
                name, status, trigger_type, trigger_config,
                dialogue_key, conditions, condition_operator,
                priority, repeating, max_deliveries,
                created_at, updated_at, created_by
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ''', (
            name, status, trigger_type, trigger_config_json,
            dialogue_key, conditions_json, condition_operator,
            priority, repeating, max_deliveries,
            now, now, request.admin_did
        ))
        
        # Auto-committed by DatabaseManager
        pigeon_id = cursor.lastrowid
        
        return jsonify({
            'status': 'success',
            'pigeon': {
                'id': pigeon_id,
                'name': name,
                'status': status,
                'trigger_type': trigger_type,
                'trigger_config': trigger_config,
                'dialogue_key': dialogue_key,
                'conditions': conditions,
                'condition_operator': condition_operator,
                'priority': priority,
                'repeating': repeating,
                'max_deliveries': max_deliveries,
                'created_at': now,
                'updated_at': now,
                'created_by': request.admin_did
            }
        })
        
    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e)}), 500


@bp.route('/update', methods=['POST'])
@require_auth()
def update_pigeon():
    """Update a pigeon's fields"""
    try:
        data = request.get_json()
        
        pigeon_id = data.get('id')
        if not pigeon_id:
            return jsonify({'status': 'error', 'error': 'Pigeon ID required'}), 400
        
        db = DatabaseManager()
        now = int(time.time())
        
        # Build dynamic UPDATE based on provided fields
        updates = []
        params = []
        
        for field in ['name', 'status', 'trigger_type', 'dialogue_key', 
                      'condition_operator', 'priority', 'max_deliveries']:
            if field in data:
                updates.append(f"{field} = %s")
                params.append(data[field])
        
        # Handle JSON fields
        if 'trigger_config' in data:
            updates.append("trigger_config = %s")
            params.append(json.dumps(data['trigger_config']) if data['trigger_config'] else None)
        
        if 'conditions' in data:
            updates.append("conditions = %s")
            params.append(json.dumps(data['conditions']))
        
        if 'repeating' in data:
            updates.append("repeating = %s")
            params.append(data['repeating'])
        
        if not updates:
            return jsonify({'status': 'error', 'error': 'No fields to update'}), 400
        
        # Add updated_at
        updates.append("updated_at = %s")
        params.append(now)
        
        # Add pigeon_id for WHERE clause
        params.append(pigeon_id)
        
        query = f"UPDATE pigeons SET {', '.join(updates)} WHERE id = %s"
        db.execute(query, tuple(params))
        # Auto-committed by DatabaseManager
        
        return jsonify({'status': 'success'})
        
    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e)}), 500


@bp.route('/<int:pigeon_id>/test', methods=['POST'])
@require_auth()
def test_pigeon(pigeon_id):
    """
    Test a pigeon by simulating its trigger evaluation.
    Returns how many users would match the conditions.
    """
    try:
        db = DatabaseManager()
        
        # Get pigeon
        cursor = db.execute('''
            SELECT 
                name, trigger_type, trigger_config, dialogue_key,
                conditions, condition_operator
            FROM pigeons
            WHERE id = %s
        ''', (pigeon_id,))
        
        row = cursor.fetchone()
        if not row:
            return jsonify({'status': 'error', 'error': 'Pigeon not found'}), 404
        
        # Parse conditions
        conditions = []
        if row['conditions']:
            try:
                conditions = json.loads(row['conditions'])
            except:
                conditions = []
        
        # Import condition evaluator (we'll create this in aviary.py)
        # For now, return a mock response
        
        # Count users who would match
        # This is a simplified version - full implementation in aviary.py
        cursor = db.execute('SELECT COUNT(*) as count FROM dreamers')
        total_users = cursor.fetchone()['count']
        
        # Estimate matches (in real implementation, evaluate conditions)
        estimated_matches = total_users if not conditions else max(1, total_users // 2)
        
        return jsonify({
            'status': 'success',
            'pigeon': {
                'id': pigeon_id,
                'name': row['name'],
                'trigger_type': row['trigger_type'],
                'dialogue_key': row['dialogue_key']
            },
            'test_results': {
                'total_users': total_users,
                'estimated_matches': estimated_matches,
                'conditions_count': len(conditions),
                'message': f'Would send "{row["dialogue_key"]}" to ~{estimated_matches} users on {row["trigger_type"]} trigger'
            }
        })
        
    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e)}), 500


@bp.route('/<int:pigeon_id>', methods=['DELETE'])
@require_auth()
def delete_pigeon(pigeon_id):
    """Delete a pigeon"""
    try:
        db = DatabaseManager()
        
        cursor = db.execute('DELETE FROM pigeons WHERE id = %s', (pigeon_id,))
        # Auto-committed by DatabaseManager
        
        if cursor.rowcount == 0:
            return jsonify({'status': 'error', 'error': 'Pigeon not found'}), 404
        
        return jsonify({'status': 'success'})
        
    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e)}), 500


@bp.route('/<int:pigeon_id>/stats', methods=['GET'])
@require_auth()
def get_pigeon_stats(pigeon_id):
    """Get delivery statistics for a pigeon"""
    try:
        db = DatabaseManager()
        
        # Get pigeon info
        cursor = db.execute('''
            SELECT name, created_at
            FROM pigeons
            WHERE id = %s
        ''', (pigeon_id,))
        
        row = cursor.fetchone()
        if not row:
            return jsonify({'status': 'error', 'error': 'Pigeon not found'}), 404
        
        # Get delivery stats
        cursor = db.execute('''
            SELECT 
                COUNT(*) as total_deliveries,
                COUNT(DISTINCT user_did) as unique_users,
                MIN(delivered_at) as first_delivery,
                MAX(delivered_at) as last_delivery
            FROM pigeon_deliveries
            WHERE pigeon_id = %s
        ''', (pigeon_id,))
        
        stats = dict(cursor.fetchone())
        
        # Get recent deliveries
        cursor = db.execute('''
            SELECT 
                user_did, message_id, delivered_at, trigger_data
            FROM pigeon_deliveries
            WHERE pigeon_id = %s
            ORDER BY delivered_at DESC
            LIMIT 10
        ''', (pigeon_id,))
        
        recent = []
        for delivery in cursor.fetchall():
            recent.append({
                'user_did': delivery['user_did'],
                'message_id': delivery['message_id'],
                'delivered_at': delivery['delivered_at'],
                'trigger_data': json.loads(delivery['trigger_data']) if delivery['trigger_data'] else {}
            })
        
        return jsonify({
            'status': 'success',
            'pigeon': {
                'id': pigeon_id,
                'name': row['name'],
                'created_at': row['created_at']
            },
            'stats': {
                'total_deliveries': stats['total_deliveries'] or 0,
                'unique_users': stats['unique_users'] or 0,
                'first_delivery': stats['first_delivery'],
                'last_delivery': stats['last_delivery']
            },
            'recent_deliveries': recent
        })
        
    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e)}), 500


# ============================================================================
# HELPER ENDPOINTS
# ============================================================================

@bp.route('/triggers', methods=['GET'])
@require_auth()
def get_trigger_types():
    """
    Get list of available trigger types with descriptions.
    
    Only returns triggers that are actually implemented in aviary.py.
    Each trigger includes:
    - type: Internal trigger type identifier
    - name: Human-readable display name
    - category: Grouping for UI organization
    - description: What causes this trigger to fire
    - status: 'stable' or 'experimental'
    - config_fields: Required configuration parameters
    """
    triggers = [
        # Canon Events - Fully Stable
        {
            'type': 'canon_set',
            'name': 'Canon Key Set',
            'category': 'Canon Events',
            'description': 'When user sets any value for a canon key',
            'status': 'stable',
            'config_fields': ['canon_key']
        },
        {
            'type': 'canon_equals',
            'name': 'Canon Key Equals',
            'category': 'Canon Events',
            'description': 'When user\'s canon key equals specific value',
            'status': 'stable',
            'config_fields': ['canon_key', 'value']
        },
        
        # Role Events - Fully Stable
        {
            'type': 'role_granted',
            'name': 'Role Granted',
            'category': 'Role Events',
            'description': 'When user receives a role',
            'status': 'stable',
            'config_fields': ['role']
        },
        {
            'type': 'role_revoked',
            'name': 'Role Revoked',
            'category': 'Role Events',
            'description': 'When user loses a role',
            'status': 'stable',
            'config_fields': ['role']
        },
        
        # Quest Events - Experimental (infrastructure in place)
        {
            'type': 'quest_started',
            'name': 'Quest Started',
            'category': 'Quest Events',
            'description': 'When user starts a specific quest',
            'status': 'experimental',
            'config_fields': ['quest_key']
        },
        {
            'type': 'quest_completed',
            'name': 'Quest Completed',
            'category': 'Quest Events',
            'description': 'When user completes a specific quest',
            'status': 'experimental',
            'config_fields': ['quest_key']
        },
        {
            'type': 'quest_abandoned',
            'name': 'Quest Abandoned',
            'category': 'Quest Events',
            'description': 'When user abandons a specific quest',
            'status': 'experimental',
            'config_fields': ['quest_key']
        },
        
        # User Activity - Fully Stable
        {
            'type': 'first_login',
            'name': 'First Login',
            'category': 'User Activity',
            'description': 'When user logs in for the first time',
            'status': 'stable',
            'config_fields': []
        },
        {
            'type': 'user_login',
            'name': 'User Login',
            'category': 'User Activity',
            'description': 'When user logs in (triggers every login)',
            'status': 'stable',
            'config_fields': []
        },
        {
            'type': 'return_visit',
            'name': 'Return Visit',
            'category': 'User Activity',
            'description': 'User returns after being away N days',
            'status': 'stable',
            'config_fields': ['days_away']
        },
        {
            'type': 'idle_duration',
            'name': 'Idle Duration',
            'category': 'User Activity',
            'description': 'User has been inactive for N+ days',
            'status': 'stable',
            'config_fields': ['days']
        },
        
        # Time-Based - Experimental (infrastructure in place)
        {
            'type': 'time_based',
            'name': 'Time-Based / Scheduled',
            'category': 'Time-Based',
            'description': 'Triggers at specific times or intervals',
            'status': 'experimental',
            'config_fields': ['schedule']
        },
        
        # Admin - Fully Stable
        {
            'type': 'manual',
            'name': 'Manual',
            'category': 'Admin',
            'description': 'Manually triggered by admin',
            'status': 'stable',
            'config_fields': []
        }
    ]
    
    return jsonify({'status': 'success', 'triggers': triggers})


@bp.route('/trigger/user_login', methods=['POST'])
@require_auth()
def trigger_user_login():
    """
    Manually trigger user_login pigeons for a specific user.
    Called from login.js when a user successfully logs in.
    
    Body: { "user_did": "did:plc:..." }
    """
    try:
        data = request.get_json()
        user_did = data.get('user_did')
        
        if not user_did:
            return jsonify({'status': 'error', 'error': 'user_did required'}), 400
        
        # Import aviary
        from aviary import AviaryRunner
        
        # Create aviary instance and trigger user_login
        aviary = AviaryRunner()
        aviary.process_user_login_trigger(user_did)
        
        return jsonify({
            'status': 'success',
            'message': f'User login trigger processed for {user_did}'
        })
        
    except Exception as e:
        print(f"❌ Error in trigger_user_login: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'error': str(e)}), 500

