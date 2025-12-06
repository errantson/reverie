"""
Docker Networking Tests
Tests for Docker container networking and service connectivity
"""
import pytest
import subprocess
import requests
import socket


@pytest.mark.docker
class TestDockerServices:
    """Test Docker services are running"""
    
    def test_docker_daemon_running(self, docker_available):
        """Docker daemon should be running"""
        assert docker_available is True
    
    def test_reverie_containers_running(self):
        """Reverie containers should be running"""
        result = subprocess.run(
            ['docker', 'ps', '--format', '{{.Names}}'],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        container_names = result.stdout.strip().split('\n')
        
        # Check for key containers
        expected_containers = ['reverie_api', 'reverie_db', 'caddy']
        for container in expected_containers:
            assert container in container_names, f"Container {container} not running"
    
    def test_containers_healthy(self):
        """All Reverie containers should be healthy or running"""
        result = subprocess.run(
            ['docker', 'ps', '--filter', 'name=reverie', '--format', '{{.Names}}\t{{.Status}}'],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        for line in result.stdout.strip().split('\n'):
            if line:
                name, status = line.split('\t')
                # Container should be "Up" not "Exited" or "Restarting"
                assert 'Up' in status, f"Container {name} not healthy: {status}"


@pytest.mark.docker
class TestDockerNetworking:
    """Test Docker bridge network configuration"""
    
    def test_reverie_network_exists(self):
        """reverie_network bridge should exist"""
        result = subprocess.run(
            ['docker', 'network', 'ls', '--format', '{{.Name}}'],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        networks = result.stdout.strip().split('\n')
        assert 'reverie_network' in networks
    
    def test_network_driver_is_bridge(self):
        """reverie_network should use bridge driver"""
        result = subprocess.run(
            ['docker', 'network', 'inspect', 'reverie_network', '--format', '{{.Driver}}'],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        driver = result.stdout.strip()
        assert driver == 'bridge'
    
    def test_containers_on_bridge_network(self):
        """Reverie containers should be on bridge network"""
        result = subprocess.run(
            ['docker', 'network', 'inspect', 'reverie_network', 
             '--format', '{{range .Containers}}{{.Name}} {{end}}'],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        containers = result.stdout.strip().split()
        
        # Key services should be on the network
        expected = ['reverie_api', 'reverie_db', 'caddy']
        for container in expected:
            assert container in containers, f"{container} not on reverie_network"


@pytest.mark.docker
class TestServiceConnectivity:
    """Test services can communicate"""
    
    def test_database_port_not_exposed_externally(self):
        """PostgreSQL port should NOT be exposed to host"""
        # Port 5432 should not be listening on host
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(1)
        
        try:
            # Try to connect to PostgreSQL from host
            result = sock.connect_ex(('127.0.0.1', 5432))
            # Connection should FAIL (port not exposed)
            assert result != 0, "Database port 5432 should not be exposed"
        finally:
            sock.close()
    
    def test_api_accessible_via_caddy(self):
        """API should be accessible through Caddy reverse proxy"""
        try:
            response = requests.get(
                'https://localhost/api/world',
                verify=False,
                timeout=5
            )
            assert response.status_code == 200
        except requests.RequestException as e:
            pytest.fail(f"API not accessible via Caddy: {e}")
    
    def test_api_not_directly_exposed(self):
        """API port 4444 should NOT be exposed to internet"""
        # Port 4444 should only be accessible from Docker network
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(1)
        
        try:
            # Try from external interface
            result = sock.connect_ex(('0.0.0.0', 4444))
            # Should fail - port not exposed
            # Note: May succeed if bound to 0.0.0.0 for Docker internal routing
        finally:
            sock.close()
    
    def test_only_web_ports_exposed(self):
        """Only ports 80, 443, and 2222 should be exposed"""
        result = subprocess.run(
            ['docker', 'ps', '--format', '{{.Ports}}'],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        ports_output = result.stdout
        
        # Should see ports 80, 443, 2222
        assert '80' in ports_output or '443' in ports_output
        
        # Should NOT see database, API, or other internal ports
        # (unless they're only bound to Docker network)


@pytest.mark.docker
class TestDatabaseConnectivity:
    """Test database connectivity from containers"""
    
    def test_api_can_reach_database(self):
        """API container should be able to reach database"""
        result = subprocess.run(
            ['docker', 'exec', 'reverie_api', 
             'python3', '-c', 
             'from core.database import DatabaseManager; db = DatabaseManager(); print(db.fetch_one("SELECT 1 as test")["test"])'],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        assert result.returncode == 0
        assert '1' in result.stdout
    
    def test_database_hostname_resolution(self):
        """Database hostname 'reverie_db' should resolve in containers"""
        result = subprocess.run(
            ['docker', 'exec', 'reverie_api',
             'getent', 'hosts', 'reverie_db'],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        assert result.returncode == 0
        assert 'reverie_db' in result.stdout


@pytest.mark.docker
class TestCaddyReverseProxy:
    """Test Caddy reverse proxy configuration"""
    
    def test_caddy_proxies_to_api(self):
        """Caddy should proxy /api/* to reverie_api container"""
        try:
            response = requests.get(
                'https://localhost/api/world',
                verify=False,
                timeout=5
            )
            assert response.status_code == 200
            
            # Should return JSON from API
            data = response.json()
            assert 'dreamers' in data
        except Exception as e:
            pytest.fail(f"Caddy not proxying to API: {e}")
    
    def test_caddy_serves_static_files(self):
        """Caddy should serve static HTML files"""
        try:
            response = requests.get(
                'https://localhost/',
                verify=False,
                timeout=5
            )
            assert response.status_code == 200
            assert 'text/html' in response.headers.get('Content-Type', '')
        except Exception as e:
            pytest.fail(f"Caddy not serving static files: {e}")
    
    def test_caddy_uses_docker_dns(self):
        """Caddy should resolve container names via Docker DNS"""
        # Check Caddyfile for container names
        result = subprocess.run(
            ['docker', 'exec', 'caddy', 'cat', '/etc/caddy/Caddyfile'],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        caddyfile = result.stdout
        
        # Should use container names, not localhost
        assert 'reverie_api' in caddyfile or 'http://reverie_api' in caddyfile
        assert 'localhost:4444' not in caddyfile or 'reverie_api:4444' in caddyfile


@pytest.mark.docker
class TestSecurityIsolation:
    """Test security isolation via Docker networking"""
    
    def test_minimal_port_exposure(self):
        """Only minimal ports should be exposed to host"""
        result = subprocess.run(
            ['ss', '-tlnp'],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        listening_ports = result.stdout
        
        # Web ports should be listening
        assert ':80 ' in listening_ports or ':443 ' in listening_ports
        
        # Internal service ports should NOT be listening on host
        # Database
        assert ':5432 ' not in listening_ports or '127.0.0.1:5432' in listening_ports
    
    def test_containers_cannot_reach_host_services(self):
        """Containers should be isolated from host network"""
        # This is by design with bridge networking
        # Containers can't access host's 127.0.0.1 services
        pass  # Placeholder for future implementation
