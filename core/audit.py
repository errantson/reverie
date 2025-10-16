#!/usr/bin/env python3
"""
🔒 Audit Logging System
Hyper-secure logging of all sensitive operations with geolocation

Uses PostgreSQL for audit logging
"""

import time
import json
import os
import requests
from pathlib import Path
from typing import Optional, Dict, Any
from core.database import DatabaseManager


class AuditLogger:
    """Secure audit logging system with geolocation"""
    
    def __init__(self, db_path: str = None):
        # db_path parameter kept for compatibility but not used
        self.db = DatabaseManager()
        self._ensure_database()
    
    def _ensure_database(self):
        """Create audit database and tables if they don't exist"""
        
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS audit_log (
                id SERIAL PRIMARY KEY,
                timestamp INTEGER NOT NULL,
                event_type TEXT NOT NULL,
                endpoint TEXT NOT NULL,
                method TEXT NOT NULL,
                user_did TEXT,
                user_ip TEXT NOT NULL,
                user_agent TEXT,
                request_id TEXT,
                request_body TEXT,
                response_status INTEGER,
                response_size INTEGER,
                query_duration_ms INTEGER,
                rows_affected INTEGER,
                error_message TEXT,
                
                -- Geolocation data
                ip_country TEXT,
                ip_city TEXT,
                ip_region TEXT,
                ip_timezone TEXT,
                ip_isp TEXT,
                ip_asn TEXT,
                ip_is_proxy INTEGER DEFAULT 0,
                ip_is_vpn INTEGER DEFAULT 0,
                ip_is_tor INTEGER DEFAULT 0,
                ip_threat_level TEXT,
                
                -- Additional metadata
                extra_data TEXT
            )
        """)
        
        self.db.execute("CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp DESC)")
        self.db.execute("CREATE INDEX IF NOT EXISTS idx_audit_ip ON audit_log(user_ip)")
        self.db.execute("CREATE INDEX IF NOT EXISTS idx_audit_event_type ON audit_log(event_type)")
        self.db.execute("CREATE INDEX IF NOT EXISTS idx_audit_did ON audit_log(user_did)")
        
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS audit_summary (
                date TEXT PRIMARY KEY,
                total_requests INTEGER DEFAULT 0,
                unique_ips INTEGER DEFAULT 0,
                failed_requests INTEGER DEFAULT 0,
                suspicious_ips INTEGER DEFAULT 0,
                last_updated INTEGER
            )
        """)
        
        # Enhanced error tracking table
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS error_log (
                id SERIAL PRIMARY KEY,
                timestamp INTEGER NOT NULL,
                error_type TEXT NOT NULL,
                error_message TEXT NOT NULL,
                stack_trace TEXT,
                endpoint TEXT,
                method TEXT,
                user_did TEXT,
                user_ip TEXT,
                user_agent TEXT,
                request_data TEXT,
                severity TEXT DEFAULT 'error',
                status TEXT DEFAULT 'new',
                resolved_at INTEGER,
                resolved_by TEXT,
                notes TEXT,
                occurrence_count INTEGER DEFAULT 1,
                first_seen INTEGER NOT NULL,
                last_seen INTEGER NOT NULL,
                client_side INTEGER DEFAULT 0,
                
                -- Hash for grouping similar errors
                error_hash TEXT,
                
                -- Additional metadata
                extra_data TEXT
            )
        """)
        
        self.db.execute("CREATE INDEX IF NOT EXISTS idx_error_timestamp ON error_log(timestamp DESC)")
        self.db.execute("CREATE INDEX IF NOT EXISTS idx_error_type ON error_log(error_type)")
        self.db.execute("CREATE INDEX IF NOT EXISTS idx_error_hash ON error_log(error_hash)")
        self.db.execute("CREATE INDEX IF NOT EXISTS idx_error_status ON error_log(status)")
        self.db.execute("CREATE INDEX IF NOT EXISTS idx_error_severity ON error_log(severity)")
    
    def get_ip_info(self, ip: str) -> Dict[str, Any]:
        """
        Get geolocation and threat info for IP address
        Uses ip-api.com (free, no key required, 45 req/min limit)
        """
        if ip in ['127.0.0.1', 'localhost'] or ip.startswith('192.168.') or ip.startswith('10.'):
            return {
                'country': 'LOCAL',
                'city': 'localhost',
                'region': 'N/A',
                'timezone': 'N/A',
                'isp': 'Local Network',
                'asn': 'N/A',
                'is_proxy': False,
                'is_vpn': False,
                'is_tor': False,
                'threat_level': 'none'
            }
        
        try:
            resp = requests.get(
                f'http://ip-api.com/json/{ip}',
                params={'fields': 'status,country,city,regionName,timezone,isp,as,proxy,mobile'},
                timeout=2
            )
            
            if resp.status_code == 200:
                data = resp.json()
                
                if data.get('status') == 'success':
                    return {
                        'country': data.get('country', 'Unknown'),
                        'city': data.get('city', 'Unknown'),
                        'region': data.get('regionName', 'Unknown'),
                        'timezone': data.get('timezone', 'Unknown'),
                        'isp': data.get('isp', 'Unknown'),
                        'asn': data.get('as', 'Unknown'),
                        'is_proxy': data.get('proxy', False),
                        'is_vpn': False,
                        'is_tor': False,
                        'threat_level': 'medium' if data.get('proxy') else 'none'
                    }
        except Exception as e:
            print(f"IP lookup failed for {ip}: {e}")
        
        return {
            'country': 'Unknown',
            'city': 'Unknown',
            'region': 'Unknown',
            'timezone': 'Unknown',
            'isp': 'Unknown',
            'asn': 'Unknown',
            'is_proxy': False,
            'is_vpn': False,
            'is_tor': False,
            'threat_level': 'unknown'
        }
    
    def log(
        self,
        event_type: str,
        endpoint: str,
        method: str,
        user_ip: str,
        response_status: int,
        user_did: Optional[str] = None,
        user_agent: Optional[str] = None,
        request_id: Optional[str] = None,
        request_body: Optional[str] = None,
        response_size: Optional[int] = None,
        query_duration_ms: Optional[int] = None,
        rows_affected: Optional[int] = None,
        error_message: Optional[str] = None,
        extra_data: Optional[Dict] = None
    ):
        """Log an event to audit database with geolocation"""
        
        ip_info = self.get_ip_info(user_ip)
        
        if request_body and len(request_body) > 10000:
            request_body = request_body[:10000] + '... [truncated]'
        
        if user_agent and len(user_agent) > 500:
            user_agent = user_agent[:500]
        
        self.db.execute("""
            INSERT INTO audit_log (
                timestamp, event_type, endpoint, method,
                user_did, user_ip, user_agent, request_id,
                request_body, response_status, response_size,
                query_duration_ms, rows_affected, error_message,
                ip_country, ip_city, ip_region, ip_timezone,
                ip_isp, ip_asn, ip_is_proxy, ip_is_vpn, ip_is_tor,
                ip_threat_level, extra_data
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            int(time.time()),
            event_type,
            endpoint,
            method,
            user_did,
            user_ip,
            user_agent,
            request_id,
            request_body,
            response_status,
            response_size,
            query_duration_ms,
            rows_affected,
            error_message,
            ip_info['country'],
            ip_info['city'],
            ip_info['region'],
            ip_info['timezone'],
            ip_info['isp'],
            ip_info['asn'],
            1 if ip_info['is_proxy'] else 0,
            1 if ip_info['is_vpn'] else 0,
            1 if ip_info['is_tor'] else 0,
            ip_info['threat_level'],
            json.dumps(extra_data) if extra_data else None
        ))
    
    def get_recent_logs(self, limit: int = 100, event_type: Optional[str] = None) -> list:
        """Get recent audit log entries"""
        
        if event_type:
            cursor = self.db.execute("""
                SELECT * FROM audit_log
                WHERE event_type = %s
                ORDER BY timestamp DESC
                LIMIT %s
            """, (event_type, limit))
        else:
            cursor = self.db.execute("""
                SELECT * FROM audit_log
                ORDER BY timestamp DESC
                LIMIT %s
            """, (limit,))
        
        rows = cursor.fetchall()
        
        return [dict(row) for row in rows]
    
    def get_suspicious_ips(self, hours: int = 24) -> list:
        """Get IPs with suspicious activity in last N hours"""
        
        since = int(time.time()) - (hours * 3600)
        
        cursor = self.db.execute("""
            SELECT 
                user_ip,
                COUNT(*) as request_count,
                SUM(CASE WHEN response_status >= 400 THEN 1 ELSE 0 END) as error_count,
                MAX(ip_country) as country,
                MAX(ip_is_proxy) as is_proxy,
                MAX(ip_threat_level) as threat_level
            FROM audit_log
            WHERE timestamp >= %s
            GROUP BY user_ip
            HAVING 
                request_count > 100 OR
                error_count > 20 OR
                is_proxy = 1
            ORDER BY request_count DESC
        """, (since,))
        
        rows = cursor.fetchall()
        
        return [dict(row) for row in rows]
    
    def get_stats(self, hours: int = 24) -> Dict:
        """Get audit statistics for last N hours"""
        
        since = int(time.time()) - (hours * 3600)
        
        cursor = self.db.execute("""
            SELECT 
                COUNT(*) as total_requests,
                COUNT(DISTINCT user_ip) as unique_ips,
                SUM(CASE WHEN response_status >= 400 THEN 1 ELSE 0 END) as error_count,
                SUM(CASE WHEN ip_is_proxy = 1 OR ip_is_vpn = 1 OR ip_is_tor = 1 THEN 1 ELSE 0 END) as proxy_requests,
                AVG(query_duration_ms) as avg_duration_ms,
                MAX(timestamp) as last_request
            FROM audit_log
            WHERE timestamp >= %s
        """, (since,))
        
        stats = dict(cursor.fetchone())
        
        return stats
    
    def log_error(
        self,
        error_type: str,
        error_message: str,
        stack_trace: Optional[str] = None,
        endpoint: Optional[str] = None,
        method: Optional[str] = None,
        user_did: Optional[str] = None,
        user_ip: Optional[str] = None,
        user_agent: Optional[str] = None,
        request_data: Optional[str] = None,
        severity: str = 'error',
        client_side: bool = False,
        extra_data: Optional[Dict] = None
    ):
        """Log an error with deduplication using error hash"""
        import hashlib
        
        # Create hash from error type and message for grouping
        error_hash = hashlib.md5(f"{error_type}:{error_message}".encode()).hexdigest()
        
        # Check if this error already exists
        cursor = self.db.execute("""
            SELECT id, occurrence_count, first_seen 
            FROM error_log 
            WHERE error_hash = %s AND status != 'resolved'
            ORDER BY last_seen DESC 
            LIMIT 1
        """, (error_hash,))
        
        existing = cursor.fetchone()
        timestamp = int(time.time())
        
        if existing:
            # Update existing error
            self.db.execute("""
                UPDATE error_log 
                SET occurrence_count = occurrence_count + 1,
                    last_seen = %s,
                    stack_trace = COALESCE(%s, stack_trace),
                    user_ip = COALESCE(%s, user_ip),
                    user_agent = COALESCE(%s, user_agent)
                WHERE id = %s
            """, (timestamp, stack_trace, user_ip, user_agent, existing['id']))
        else:
            # Insert new error
            self.db.execute("""
                INSERT INTO error_log (
                    timestamp, error_type, error_message, stack_trace,
                    endpoint, method, user_did, user_ip, user_agent,
                    request_data, severity, error_hash, first_seen, 
                    last_seen, client_side, extra_data
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                timestamp, error_type, error_message, stack_trace,
                endpoint, method, user_did, user_ip, user_agent,
                request_data, severity, error_hash, timestamp,
                timestamp, 1 if client_side else 0,
                json.dumps(extra_data) if extra_data else None
            ))
    
    def get_errors(
        self,
        limit: int = 100,
        status: Optional[str] = None,
        severity: Optional[str] = None,
        since: Optional[int] = None
    ) -> list:
        """Get error log entries with filtering"""
        
        query = "SELECT * FROM error_log WHERE 1=1"
        params = []
        
        if status:
            query += " AND status = %s"
            params.append(status)
        
        if severity:
            query += " AND severity = %s"
            params.append(severity)
        
        if since:
            query += " AND timestamp >= %s"
            params.append(since)
        
        query += " ORDER BY timestamp DESC LIMIT %s"
        params.append(limit)
        
        cursor = self.db.execute(query, params)
        rows = cursor.fetchall()
        
        return [dict(row) for row in rows]
    
    def get_error_stats(self, hours: int = 24) -> Dict:
        """Get error statistics"""
        
        since = int(time.time()) - (hours * 3600)
        
        cursor = self.db.execute("""
            SELECT 
                COUNT(*) as total_errors,
                SUM(occurrence_count) as total_occurrences,
                COUNT(CASE WHEN status = 'new' THEN 1 END) as new_errors,
                COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_errors,
                COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_errors,
                COUNT(CASE WHEN severity = 'error' THEN 1 END) as errors,
                COUNT(CASE WHEN severity = 'warning' THEN 1 END) as warnings,
                COUNT(CASE WHEN client_side = 1 THEN 1 END) as client_errors,
                MAX(timestamp) as latest_error
            FROM error_log
            WHERE timestamp >= %s
        """, (since,))
        
        stats = dict(cursor.fetchone())
        
        # Get error breakdown by type
        cursor = self.db.execute("""
            SELECT error_type, COUNT(*) as count, SUM(occurrence_count) as occurrences
            FROM error_log
            WHERE timestamp >= %s
            GROUP BY error_type
            ORDER BY occurrences DESC
            LIMIT 10
        """, (since,))
        
        stats['error_types'] = [dict(row) for row in cursor.fetchall()]
        
        return stats
    
    def resolve_error(self, error_id: int, resolved_by: str, notes: Optional[str] = None):
        """Mark an error as resolved"""
        
        self.db.execute("""
            UPDATE error_log
            SET status = 'resolved',
                resolved_at = %s,
                resolved_by = %s,
                notes = %s
            WHERE id = %s
        """, (int(time.time()), resolved_by, notes, error_id))


_audit_logger = None

def get_audit_logger() -> AuditLogger:
    """Get global audit logger instance"""
    global _audit_logger
    if _audit_logger is None:
        _audit_logger = AuditLogger()
    return _audit_logger


if __name__ == '__main__':
    logger = AuditLogger()
    
    print("🔒 Testing audit logger...")
    
    logger.log(
        event_type='test_event',
        endpoint='/api/test',
        method='GET',
        user_ip='8.8.8.8',
        response_status=200,
        user_did='did:plc:test123',
        user_agent='Mozilla/5.0',
        request_id='test_123'
    )
    
    print("✅ Test event logged")
    
    logs = logger.get_recent_logs(limit=5)
    print(f"\n📋 Recent logs: {len(logs)} entries")
    for log in logs:
        print(f"  {log['timestamp']} | {log['event_type']} | {log['endpoint']} | {log['user_ip']} ({log['ip_country']})")
    
    stats = logger.get_stats(hours=24)
    print(f"\n📊 Stats (last 24h):")
    print(f"  Total requests: {stats['total_requests']}")
    print(f"  Unique IPs: {stats['unique_ips']}")
    print(f"  Errors: {stats['error_count']}")
    print(f"  Proxy requests: {stats['proxy_requests']}")
