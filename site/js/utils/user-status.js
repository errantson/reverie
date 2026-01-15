/**
 * User Status Utility
 * Centralized status/role determination for users across the site
 * Checks lore.farm for character tags and work roles
 */

// Only define if not already loaded
if (!window.UserStatus) {

class UserStatus {
    /**
     * Get comprehensive user status by checking lore.farm APIs
     * @param {Object} dreamer - Dreamer object with did, handle, server
     * @param {Object} [options] - Additional options
     * @param {string} [options.authToken] - OAuth token for checking own work roles
     * @returns {Promise<Object>} Status object with all relevant data
     */
    static async getUserStatus(dreamer, options = {}) {
        if (!dreamer) return this._getDefaultStatus();
        
        const status = {
            did: dreamer.did,
            handle: dreamer.handle,
            server: dreamer.server,
            isKeeper: false,
            isGreeter: false,
            isMapper: false,
            isCogitarian: false,
            isProvisioner: false,
            isDreamstyler: false,
            isBursar: false,
            isCheerful: false,
            isCharacter: false,
            characterLevel: null, // 'known', 'well-known', or 'revered'
            canAutoLore: false,
            canAutoCanon: false,
            pdsHost: dreamer.server ? dreamer.server.replace(/^https?:\/\//, '') : undefined
        };
        
        // Check all status sources in parallel
        const checks = [
            this._checkKeeperStatus(dreamer.did),
            this._checkCharacterStatus(dreamer.did),
            this._checkWorkerStatus(dreamer.did, options.authToken)
        ];
        
        const [keeperResult, characterResult, workerResult] = await Promise.allSettled(checks);
        
        // Process results
        if (keeperResult.status === 'fulfilled' && keeperResult.value) {
            status.isKeeper = true;
        }
        
        if (characterResult.status === 'fulfilled' && characterResult.value) {
            status.isCharacter = characterResult.value.isCharacter;
            status.characterLevel = characterResult.value.characterLevel;
            status.canAutoLore = characterResult.value.canAutoLore;
            status.canAutoCanon = characterResult.value.canAutoCanon;
        }
        
        if (workerResult.status === 'fulfilled' && workerResult.value) {
            status.isGreeter = workerResult.value.isGreeter || false;
            status.isMapper = workerResult.value.isMapper || false;
            status.isCogitarian = workerResult.value.isCogitarian || false;
            status.isProvisioner = workerResult.value.isProvisioner || false;
            status.isDreamstyler = workerResult.value.isDreamstyler || false;
            status.isBursar = workerResult.value.isBursar || false;
            status.isCheerful = workerResult.value.isCheerful || false;
        }
        
        return status;
    }
    
    /**
     * Check if user is Keeper (loremaster of reverie.house)
     * @private
     */
    static async _checkKeeperStatus(did) {
        try {
            const response = await fetch('https://lore.farm/api/worlds');
            if (response.ok) {
                const data = await response.json();
                const reverieWorld = data.worlds?.find(w => w.domain === 'reverie.house');
                return reverieWorld && reverieWorld.gm_did === did;
            }
        } catch (error) {
            console.warn('Failed to check Keeper status:', error);
        }
        return false;
    }
    
    /**
     * Check character status and permissions from lore.farm
     * @private
     */
    static async _checkCharacterStatus(did) {
        const result = {
            isCharacter: false,
            characterLevel: null,
            canAutoLore: false,
            canAutoCanon: false
        };
        
        // PERFORMANCE: Check cache first (5 minute TTL)
        const cacheKey = `lore_farm_status_${did}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
            const { timestamp, data } = JSON.parse(cached);
            if (Date.now() - timestamp < 5 * 60 * 1000) {
                return data;
            }
        }
        
        try {
            // PERFORMANCE: Add 2 second timeout to prevent hanging
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            
            // Check if character via labels
            const labelsResponse = await fetch(
                `https://lore.farm/xrpc/com.atproto.label.queryLabels?uriPatterns=${encodeURIComponent(did)}`,
                { signal: controller.signal }
            );
            clearTimeout(timeoutId);
            
            if (labelsResponse.ok) {
                const labelsData = await labelsResponse.json();
                const hasCharacterLabel = labelsData.labels?.some(label => 
                    label.val === 'character' && label.src === 'did:plc:u5cwb2mwiv2bfq53cjufe6yn'
                );
                
                if (hasCharacterLabel) {
                    result.isCharacter = true;
                    result.characterLevel = 'known'; // Default
                    
                    // Check permissions for auto-lore/auto-canon
                    try {
                        const permController = new AbortController();
                        const permTimeout = setTimeout(() => permController.abort(), 2000);
                        
                        const permsResponse = await fetch(
                            `https://lore.farm/api/worlds/reverie.house/permissions?did=${did}`,
                            { signal: permController.signal }
                        );
                        clearTimeout(permTimeout);
                        
                        if (permsResponse.ok) {
                            const permsData = await permsResponse.json();
                            result.canAutoCanon = permsData.can_auto_canon || false;
                            result.canAutoLore = permsData.can_auto_lore || false;
                            
                            // Determine character level based on permissions
                            if (result.canAutoCanon) {
                                result.characterLevel = 'revered';
                            } else if (result.canAutoLore) {
                                result.characterLevel = 'well-known';
                            }
                        }
                    } catch (error) {
                        // Silent fail on timeout - lore.farm might be down
                        if (error.name !== 'AbortError') {
                            console.warn('Failed to check character permissions:', error);
                        }
                    }
                }
            }
            
            // Cache the result
            sessionStorage.setItem(cacheKey, JSON.stringify({
                timestamp: Date.now(),
                data: result
            }));
            
        } catch (error) {
            // Silent fail on timeout - don't block page load
            if (error.name !== 'AbortError') {
                console.warn('Failed to check character status:', error);
            }
        }
        
        return result;
    }
    
    /**
     * Check worker status (greeter/mapper/cogitarian/provisioner) from work APIs
     * @private
     * If authToken is provided, uses authenticated endpoints for current user
     * Otherwise uses public /api/work/{role}/info endpoints to check if DID is a worker
     */
    static async _checkWorkerStatus(did, authToken) {
        const result = {
            isGreeter: false,
            isMapper: false,
            isCogitarian: false,
            isProvisioner: false,
            isDreamstyler: false,
            isBursar: false,
            isCheerful: false
        };
        
        if (authToken) {
            // Authenticated check - use status endpoints
            try {
                const [greeterResponse, mapperResponse, cogitarianResponse, provisionerResponse, dreamstylerResponse, bursarResponse, cheerfulResponse] = await Promise.allSettled([
                    fetch('/api/work/greeter/status', {
                        headers: { 'Authorization': `Bearer ${authToken}` }
                    }),
                    fetch('/api/work/mapper/status', {
                        headers: { 'Authorization': `Bearer ${authToken}` }
                    }),
                    fetch('/api/work/cogitarian/status', {
                        headers: { 'Authorization': `Bearer ${authToken}` }
                    }),
                    fetch('/api/work/provisioner/status', {
                        headers: { 'Authorization': `Bearer ${authToken}` }
                    }),
                    fetch('/api/work/dreamstyler/status', {
                        headers: { 'Authorization': `Bearer ${authToken}` }
                    }),
                    fetch('/api/work/bursar/status', {
                        headers: { 'Authorization': `Bearer ${authToken}` }
                    }),
                    fetch('/api/work/cheerful/status', {
                        headers: { 'Authorization': `Bearer ${authToken}` }
                    })
                ]);
                
                // Process greeter status
                if (greeterResponse.status === 'fulfilled' && greeterResponse.value.ok) {
                    const data = await greeterResponse.value.json();
                    result.isGreeter = data.is_worker || false;
                }
                
                // Process mapper status
                if (mapperResponse.status === 'fulfilled' && mapperResponse.value.ok) {
                    const data = await mapperResponse.value.json();
                    result.isMapper = data.is_worker || false;
                }
                
                // Process cogitarian status
                if (cogitarianResponse.status === 'fulfilled' && cogitarianResponse.value.ok) {
                    const data = await cogitarianResponse.value.json();
                    result.isCogitarian = data.is_worker || false;
                }
                
                // Process provisioner status
                if (provisionerResponse.status === 'fulfilled' && provisionerResponse.value.ok) {
                    const data = await provisionerResponse.value.json();
                    result.isProvisioner = data.is_worker || false;
                }
                
                // Process dreamstyler status
                if (dreamstylerResponse.status === 'fulfilled' && dreamstylerResponse.value.ok) {
                    const data = await dreamstylerResponse.value.json();
                    result.isDreamstyler = data.is_worker || false;
                }
                
                // Process bursar status
                if (bursarResponse.status === 'fulfilled' && bursarResponse.value.ok) {
                    const data = await bursarResponse.value.json();
                    result.isBursar = data.is_worker || false;
                }
                
                // Process cheerful status
                if (cheerfulResponse.status === 'fulfilled' && cheerfulResponse.value.ok) {
                    const data = await cheerfulResponse.value.json();
                    result.isCheerful = data.is_worker || false;
                }
            } catch (error) {
                console.warn('Failed to check worker status (authenticated):', error);
            }
        } else {
            // Public check - use info endpoints and check if DID is in workers list
            try {
                const [greeterResponse, mapperResponse, cogitarianResponse, provisionerResponse, dreamstylerResponse, bursarResponse, cheerfulResponse] = await Promise.allSettled([
                    fetch('/api/work/greeter/info'),
                    fetch('/api/work/mapper/info'),
                    fetch('/api/work/cogitarian/info'),
                    fetch('/api/work/provisioner/info'),
                    fetch('/api/work/dreamstyler/info'),
                    fetch('/api/work/bursar/info'),
                    fetch('/api/work/cheerful/info')
                ]);
                
                // Check greeter
                if (greeterResponse.status === 'fulfilled' && greeterResponse.value.ok) {
                    const data = await greeterResponse.value.json();
                    const workers = data.workers || [];
                    result.isGreeter = workers.some(w => w.did === did);
                }
                
                // Check mapper
                if (mapperResponse.status === 'fulfilled' && mapperResponse.value.ok) {
                    const data = await mapperResponse.value.json();
                    const workers = data.workers || [];
                    result.isMapper = workers.some(w => w.did === did);
                }
                
                // Check cogitarian
                if (cogitarianResponse.status === 'fulfilled' && cogitarianResponse.value.ok) {
                    const data = await cogitarianResponse.value.json();
                    const workers = data.workers || [];
                    result.isCogitarian = workers.some(w => w.did === did);
                }
                
                // Check provisioner
                if (provisionerResponse.status === 'fulfilled' && provisionerResponse.value.ok) {
                    const data = await provisionerResponse.value.json();
                    const workers = data.workers || [];
                    result.isProvisioner = workers.some(w => w.did === did);
                }
                
                // Check dreamstyler
                if (dreamstylerResponse.status === 'fulfilled' && dreamstylerResponse.value.ok) {
                    const data = await dreamstylerResponse.value.json();
                    const workers = data.workers || [];
                    result.isDreamstyler = workers.some(w => w.did === did);
                }
                
                // Check bursar
                if (bursarResponse.status === 'fulfilled' && bursarResponse.value.ok) {
                    const data = await bursarResponse.value.json();
                    const workers = data.workers || [];
                    result.isBursar = workers.some(w => w.did === did);
                }
                
                // Check cheerful
                if (cheerfulResponse.status === 'fulfilled' && cheerfulResponse.value.ok) {
                    const data = await cheerfulResponse.value.json();
                    const workers = data.workers || [];
                    result.isCheerful = workers.some(w => w.did === did);
                }
            } catch (error) {
                console.warn('Failed to check worker status (public):', error);
            }
        }
        
        return result;
    }
    
    /**
     * Get default status object
     * @private
     */
    static _getDefaultStatus() {
        return {
            isKeeper: false,
            isGreeter: false,
            isMapper: false,
            isCogitarian: false,
            isProvisioner: false,
            isDreamstyler: false,
            isBursar: false,
            isCheerful: false,
            isCharacter: false,
            characterLevel: null,
            canAutoLore: false,
            canAutoCanon: false
        };
    }
    
    /**
     * Get the status label for a user (synchronous, requires pre-fetched data)
     * @param {Object} user - User object with status data
     * @returns {string} Status label
     */
    static getStatusLabel(user) {
        if (!user) return 'dreamer';
        
        // Check for Keeper status - highest priority
        if (user.isKeeper) {
            return 'Keeper of Reverie House';
        }
        
        // Check for worker roles (prioritize in order: greeter, mapper, cogitarian, provisioner, dreamstyler, bursar, cheerful)
        if (user.isGreeter) {
            return 'Greeter of Reveries';
        }
        if (user.isMapper) {
            return 'Spectrum Mapper';
        }
        if (user.isCogitarian) {
            return 'Cogitarian (Prime)';
        }
        if (user.isProvisioner) {
            return 'Head of Pantry';
        }
        if (user.isDreamstyler) {
            return 'Dreamstyler';
        }
        if (user.isBursar) {
            return 'Bursar';
        }
        if (user.isCheerful) {
            return 'Cheerful';
        }
        
        // Base status
        let baseStatus = 'dreamer';
        
        // Check if resident (PDS hosted on reverie.house)
        if (user.pdsHost === 'reverie.house' || user.server === 'reverie.house') {
            baseStatus = 'resident';
        }
        // Check if dreamweaver (has .reverie.house subdomain handle)
        else if (user.handle?.endsWith('.reverie.house')) {
            baseStatus = 'dreamweaver';
        }
        
        // Add character prefix if applicable
        if (user.characterLevel) {
            const prefixes = {
                'known': 'Known',
                'well-known': 'Well-Known',
                'revered': 'Revered'
            };
            const prefix = prefixes[user.characterLevel] || '';
            if (prefix) {
                // Capitalize base status for character prefix
                const capitalizedBase = baseStatus.charAt(0).toUpperCase() + baseStatus.slice(1);
                return `${prefix} ${capitalizedBase}`;
            }
        }
        
        return baseStatus;
    }
    
    /**
     * Get a more detailed status object
     * @param {Object} user - User object
     * @returns {Object} Status object with label, tier, and description
     */
    static getDetailedStatus(user) {
        const label = this.getStatusLabel(user);
        
        const statusMap = {
            'Keeper of Reverie House': {
                label: 'Keeper of Reverie House',
                tier: 'keeper',
                description: 'Loremaster of Reverie House, guardian of the world\'s canon and lore'
            },
            'Greeter of Reveries': {
                label: 'Greeter of Reveries',
                tier: 'worker',
                description: 'Active worker welcoming newcomers to Reverie House'
            },
            'Spectrum Mapper': {
                label: 'Spectrum Mapper',
                tier: 'worker',
                description: 'Active worker charting the origins of dreamers in the wild mindscape'
            },
            'Cogitarian (Prime)': {
                label: 'Cogitarian (Prime)',
                tier: 'worker',
                description: 'Active worker fostering thoughtful discourse in Reverie House'
            },
            'Head of Pantry': {
                label: 'Head of Pantry',
                tier: 'worker',
                description: 'Active worker providing for those in need at Reverie House'
            },
            'Dreamstyler': {
                label: 'Dreamstyler',
                tier: 'worker',
                description: 'Active worker crafting visual aesthetics for dreamweavers'
            },
            'Bursar': {
                label: 'Bursar',
                tier: 'worker',
                description: 'Active worker managing the treasury of Reverie House'
            },
            'Cheerful': {
                label: 'Cheerful',
                tier: 'worker',
                description: 'Active worker spreading positivity throughout Reverie House'
            },
            'Revered Resident': {
                label: 'Revered Resident',
                tier: 'character',
                description: 'Revered character of lore.farm with auto-canon privileges'
            },
            'Revered Dreamweaver': {
                label: 'Revered Dreamweaver',
                tier: 'character',
                description: 'Revered character of lore.farm with auto-canon privileges'
            },
            'Revered Dreamer': {
                label: 'Revered Dreamer',
                tier: 'character',
                description: 'Revered character of lore.farm with auto-canon privileges'
            },
            'Well-Known Resident': {
                label: 'Well-Known Resident',
                tier: 'character',
                description: 'Well-known character of lore.farm with auto-lore privileges'
            },
            'Well-Known Dreamweaver': {
                label: 'Well-Known Dreamweaver',
                tier: 'character',
                description: 'Well-known character of lore.farm with auto-lore privileges'
            },
            'Well-Known Dreamer': {
                label: 'Well-Known Dreamer',
                tier: 'character',
                description: 'Well-known character of lore.farm with auto-lore privileges'
            },
            'Known Resident': {
                label: 'Known Resident',
                tier: 'character',
                description: 'Known character of Reverie House in lore.farm'
            },
            'Known Dreamweaver': {
                label: 'Known Dreamweaver',
                tier: 'character',
                description: 'Known character of Reverie House in lore.farm'
            },
            'Known Dreamer': {
                label: 'Known Dreamer',
                tier: 'character',
                description: 'Known character of Reverie House in lore.farm'
            },
            'resident': {
                label: 'Resident',
                tier: 'resident',
                description: 'PDS hosted on reverie.house'
            },
            'Resident': {
                label: 'Resident',
                tier: 'resident',
                description: 'PDS hosted on reverie.house'
            },
            'dreamweaver': {
                label: 'Dreamweaver',
                tier: 'dreamweaver',
                description: 'Handle registered under reverie.house domain'
            },
            'Dreamweaver': {
                label: 'Dreamweaver',
                tier: 'dreamweaver',
                description: 'Handle registered under reverie.house domain'
            },
            'dreamer': {
                label: 'Dreamer',
                tier: 'visitor',
                description: 'Member of the ATProtocol network'
            },
            'Dreamer': {
                label: 'Dreamer',
                tier: 'visitor',
                description: 'Member of the ATProtocol network'
            }
        };
        
        return statusMap[label] || statusMap['dreamer'];
    }
    
    /**
     * Check if user has a specific status tier
     * @param {Object} user - User object
     * @param {string} tier - Tier to check ('worker', 'resident', 'dreamweaver', 'visitor')
     * @returns {boolean}
     */
    static hasStatusTier(user, tier) {
        const status = this.getDetailedStatus(user);
        
        // Allow tier matching for equal or higher tiers
        const tierHierarchy = ['visitor', 'dreamweaver', 'resident', 'worker'];
        const userTierIndex = tierHierarchy.indexOf(status.tier);
        const checkTierIndex = tierHierarchy.indexOf(tier);
        
        return userTierIndex >= checkTierIndex;
    }
    
    /**
     * Format status for display with optional styling
     * @param {Object} user - User object
     * @param {Object} [options] - Display options
     * @param {boolean} [options.capitalize] - Capitalize the label
     * @param {boolean} [options.article] - Include article (a/an)
     * @returns {string} Formatted status
     */
    static formatStatus(user, options = {}) {
        let label = this.getStatusLabel(user);
        
        // Don't modify worker role titles - they're already properly capitalized
        const workerRoles = ['Greeter of Reveries', 'Spectrum Mapper', 'Cogitarian (Prime)', 'Head of Pantry', 'Dreamstyler', 'Bursar', 'Cheerful', 'Keeper of Reverie House'];
        
        if (options.capitalize && !workerRoles.includes(label)) {
            label = label.charAt(0).toUpperCase() + label.slice(1);
        }
        
        if (options.article) {
            const article = ['a', 'e', 'i', 'o', 'u'].includes(label.charAt(0).toLowerCase()) ? 'an' : 'a';
            return `${article} ${label}`;
        }
        
        return label;
    }
}

// Export for use across the site
window.UserStatus = UserStatus;

console.log('✅ [UserStatus] User status utility loaded');

} // End of window.UserStatus check
