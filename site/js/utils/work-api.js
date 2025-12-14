/**
 * Work API Client
 * 
 * Unified client for interacting with work/role endpoints.
 * Used by both work.html and dashboard.js for consistent behavior.
 */

class WorkAPI {
    constructor() {
        this.baseUrl = '';
    }

    /**
     * Get authorization token from localStorage
     */
    getToken() {
        return localStorage.getItem('oauth_token');
    }

    /**
     * Get greeter status (current greeter, role info, etc.)
     */
    async getGreeterStatus() {
        const token = this.getToken();
        const response = await fetch('/api/work/greeter/status', {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        
        if (!response.ok) {
            throw new Error(`Failed to get greeter status: ${response.status}`);
        }
        
        return await response.json();
    }

    /**
     * Activate as greeter with app password
     * 
     * @param {string} appPassword - App password in xxxx-xxxx-xxxx-xxxx format
     * @returns {Promise<Object>} - Result with success, is_worker, status
     */
    async activateGreeter(appPassword) {
        const token = this.getToken();
        if (!token) {
            throw new Error('No authentication token');
        }

        const response = await fetch('/api/work/greeter/activate', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ appPassword })
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Activation failed');
        }

        return data;
    }

    /**
     * Activate as greeter using existing stored credentials
     */
    async activateGreeterWithExistingCredentials() {
        const token = this.getToken();
        if (!token) {
            throw new Error('No authentication token');
        }

        const response = await fetch('/api/work/greeter/activate', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ use_existing_credentials: true })
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Activation failed');
        }

        return data;
    }

    /**
     * Step down as greeter
     */
    async stepDownGreeter() {
        const token = this.getToken();
        if (!token) {
            throw new Error('No authentication token');
        }

        const response = await fetch('/api/work/greeter/step-down', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Step down failed');
        }

        return data;
    }

    /**
     * Set greeter status (working, retiring)
     */
    async setGreeterStatus(status) {
        const token = this.getToken();
        if (!token) {
            throw new Error('No authentication token');
        }

        const response = await fetch('/api/work/greeter/set-status', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Status update failed');
        }

        return data;
    }

    /**
     * Get credential status (connected, roles, etc.)
     */
    async getCredentialStatus() {
        const token = this.getToken();
        if (!token) {
            return { connected: false, roles_available: ['greeter'] };
        }

        try {
            const response = await fetch('/api/user/credentials/status', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) {
                return { connected: false, roles_available: ['greeter'] };
            }
            
            return await response.json();
        } catch (error) {
            console.error('Failed to get credential status:', error);
            return { connected: false, roles_available: ['greeter'] };
        }
    }

    /**
     * Get user's roles
     */
    async getUserRoles() {
        const token = this.getToken();
        if (!token) {
            return { roles: [] };
        }

        try {
            const response = await fetch('/api/user/roles', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) {
                return { roles: [] };
            }
            
            return await response.json();
        } catch (error) {
            console.error('Failed to get user roles:', error);
            return { roles: [] };
        }
    }

    /**
     * Disable a role
     */
    async disableRole(role) {
        const token = this.getToken();
        if (!token) {
            throw new Error('No authentication token');
        }

        const response = await fetch('/api/user/roles/disable', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ role })
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to disable role');
        }

        return data;
    }

    /**
     * Check if user has active greeter role
     */
    async isActiveGreeter() {
        const rolesData = await this.getUserRoles();
        const greeterRole = rolesData.roles.find(r => r.role === 'greeter');
        return greeterRole && greeterRole.status === 'active';
    }

    /**
     * Check if user has stored credentials
     */
    async hasStoredCredentials() {
        const status = await getCredentialStatus();
        return status.connected;
    }

    // ========================================================================
    // PROVISIONER METHODS
    // ========================================================================

    /**
     * Get provisioner status (current provisioner, role info, etc.)
     */
    async getProvisionerStatus() {
        const token = this.getToken();
        const response = await fetch('/api/work/provisioner/status', {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        
        if (!response.ok) {
            throw new Error(`Failed to get provisioner status: ${response.status}`);
        }
        
        return await response.json();
    }

    /**
     * Activate as provisioner using existing stored credentials
     */
    async activateProvisionerWithExistingCredentials() {
        const token = this.getToken();
        if (!token) {
            throw new Error('No authentication token');
        }

        const response = await fetch('/api/work/provisioner/activate', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ use_existing_credentials: true })
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Activation failed');
        }

        return data;
    }

    /**
     * Step down as provisioner
     */
    async stepDownProvisioner() {
        const token = this.getToken();
        if (!token) {
            throw new Error('No authentication token');
        }

        const response = await fetch('/api/work/provisioner/step-down', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Step down failed');
        }

        return data;
    }

    /**
     * Set provisioner status (working, retiring)
     */
    async setProvisionerStatus(status) {
        const token = this.getToken();
        if (!token) {
            throw new Error('No authentication token');
        }

        const response = await fetch('/api/work/provisioner/set-status', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Status update failed');
        }

        return data;
    }

    /**
     * Check if user has active provisioner role
     */
    async isActiveProvisioner() {
        const rolesData = await this.getUserRoles();
        const provisionerRole = rolesData.roles.find(r => r.role === 'provisioner');
        return provisionerRole && provisionerRole.status === 'active';
    }
}

// Export singleton instance
window.WorkAPI = new WorkAPI();
console.log('✅ [WorkAPI] Unified work API client loaded');
