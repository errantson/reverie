/**
 * User Status Utility
 * Centralized status/role determination for users across the site
 * Checks lore.farm for character tags and work roles
 * 
 * Designation Hierarchy:
 * - Singular Overrides: House Patron, Keeper of Reverie House
 * - Exclusive Work Roles: Guardian, Greeter, Mapper, Cogitarian, Provisioner, Bursar
 * - Affix Roles: Cheerful (prefix), Stylist (suffix) - can compound
 * - Base Identities: Resident > Dreamweaver > Ward/Charge/Dreamer
 *   - Ward/Charge replace Dreamer only (not Dreamweaver/Resident)
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
            // Singular overrides
            isKeeper: false,
            // Exclusive work roles
            isGuardian: false,
            isGreeter: false,
            isMapper: false,
            isCogitarian: false,
            isProvisioner: false,
            isBursar: false,
            // Affix roles (can compound)
            isCheerful: false,    // Prefix: "Cheerful X"
            isStylist: false,     // Suffix: "X Stylist" (was isDreamstyler)
            // Stewardship (Ward/Charge replace Dreamer only)
            isWard: false,        // Under protective stewardship
            isCharge: false,      // Under light stewardship
            guardianDid: null,    // Their guardian's DID
            // Character info
            isCharacter: false,
            characterLevel: null, // 'known', 'well-known', or 'revered'
            canAutoLore: false,
            canAutoCanon: false,
            // Base identity info
            pdsHost: dreamer.server ? dreamer.server.replace(/^https?:\/\//, '') : undefined
        };
        
        // Check all status sources in parallel
        const checks = [
            this._checkKeeperStatus(dreamer.did),
            this._checkCharacterStatus(dreamer.did),
            this._checkWorkerStatus(dreamer.did, options.authToken),
            this._checkStewardshipStatus(dreamer.did, options.authToken)
        ];
        
        const [keeperResult, characterResult, workerResult, stewardshipResult] = await Promise.allSettled(checks);
        
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
            // Exclusive work roles
            status.isGuardian = workerResult.value.isGuardian || false;
            status.isGreeter = workerResult.value.isGreeter || false;
            status.isMapper = workerResult.value.isMapper || false;
            status.isCogitarian = workerResult.value.isCogitarian || false;
            status.isProvisioner = workerResult.value.isProvisioner || false;
            status.isBursar = workerResult.value.isBursar || false;
            // Affix roles
            status.isCheerful = workerResult.value.isCheerful || false;
            status.isStylist = workerResult.value.isStylist || false;
        }
        
        if (stewardshipResult.status === 'fulfilled' && stewardshipResult.value) {
            status.isWard = stewardshipResult.value.isWard || false;
            status.isCharge = stewardshipResult.value.isCharge || false;
            status.guardianDid = stewardshipResult.value.guardianDid || null;
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
     * Check worker status (exclusive roles + affix roles) from work APIs
     * @private
     * If authToken is provided, uses authenticated endpoints for current user
     * Otherwise uses public /api/work/{role}/info endpoints to check if DID is a worker
     * 
     * Exclusive work roles: guardian, greeter, mapper, cogitarian, provisioner, bursar
     * Affix roles: cheerful→prefix, dreamstyler→stylist (suffix)
     */
    static async _checkWorkerStatus(did, authToken) {
        const result = {
            // Exclusive work roles
            isCheerful: false,
            isGuardian: false,
            isGreeter: false,
            isMapper: false,
            isCogitarian: false,
            isProvisioner: false,
            isBursar: false,
            // Affix roles (can compound)
            isStylist: false
        };
        
        if (authToken) {
            // Authenticated check - use status endpoints
            try {
                const [cheerfulResponse, guardianResponse, greeterResponse, mapperResponse, cogitarianResponse, provisionerResponse, bursarResponse, dreamstylerResponse] = await Promise.allSettled([
                    fetch('/api/work/cheerful/status', {
                        headers: { 'Authorization': `Bearer ${authToken}` }
                    }),
                    fetch('/api/work/guardian/status', {
                        headers: { 'Authorization': `Bearer ${authToken}` }
                    }),
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
                    fetch('/api/work/bursar/status', {
                        headers: { 'Authorization': `Bearer ${authToken}` }
                    }),
                    fetch('/api/work/dreamstyler/status', {
                        headers: { 'Authorization': `Bearer ${authToken}` }
                    })
                ]);
                
                // Process cheerful status (affix - prefix "Cheerful")
                if (cheerfulResponse.status === 'fulfilled' && cheerfulResponse.value.ok) {
                    const data = await cheerfulResponse.value.json();
                    result.isCheerful = data.is_worker || false;
                }
                
                // Process guardian status (exclusive work role)
                if (guardianResponse.status === 'fulfilled' && guardianResponse.value.ok) {
                    const data = await guardianResponse.value.json();
                    result.isGuardian = data.is_worker || false;
                }
                
                // Process greeter status (exclusive work role)
                if (greeterResponse.status === 'fulfilled' && greeterResponse.value.ok) {
                    const data = await greeterResponse.value.json();
                    result.isGreeter = data.is_worker || false;
                }
                
                // Process mapper status (exclusive work role)
                if (mapperResponse.status === 'fulfilled' && mapperResponse.value.ok) {
                    const data = await mapperResponse.value.json();
                    result.isMapper = data.is_worker || false;
                }
                
                // Process cogitarian status (exclusive work role)
                if (cogitarianResponse.status === 'fulfilled' && cogitarianResponse.value.ok) {
                    const data = await cogitarianResponse.value.json();
                    result.isCogitarian = data.is_worker || false;
                }
                
                // Process provisioner status (exclusive work role)
                if (provisionerResponse.status === 'fulfilled' && provisionerResponse.value.ok) {
                    const data = await provisionerResponse.value.json();
                    result.isProvisioner = data.is_worker || false;
                }
                
                // Process bursar status (exclusive work role)
                if (bursarResponse.status === 'fulfilled' && bursarResponse.value.ok) {
                    const data = await bursarResponse.value.json();
                    result.isBursar = data.is_worker || false;
                }
                
                // Process dreamstyler status (affix - suffix "Stylist")
                if (dreamstylerResponse.status === 'fulfilled' && dreamstylerResponse.value.ok) {
                    const data = await dreamstylerResponse.value.json();
                    result.isStylist = data.is_worker || false;
                }
            } catch (error) {
                console.warn('Failed to check worker status (authenticated):', error);
            }
        } else {
            // Public check - use info endpoints and check if DID is in workers list
            try {
                const [cheerfulResponse, guardianResponse, greeterResponse, mapperResponse, cogitarianResponse, provisionerResponse, bursarResponse, dreamstylerResponse] = await Promise.allSettled([
                    fetch('/api/work/cheerful/info'),
                    fetch('/api/work/guardian/info'),
                    fetch('/api/work/greeter/info'),
                    fetch('/api/work/mapper/info'),
                    fetch('/api/work/cogitarian/info'),
                    fetch('/api/work/provisioner/info'),
                    fetch('/api/work/bursar/info'),
                    fetch('/api/work/dreamstyler/info')
                ]);
                
                // Check cheerful (affix - prefix "Cheerful")
                if (cheerfulResponse.status === 'fulfilled' && cheerfulResponse.value.ok) {
                    const data = await cheerfulResponse.value.json();
                    const workers = data.workers || [];
                    result.isCheerful = workers.some(w => w.did === did);
                }
                
                // Check guardian (exclusive work role)
                if (guardianResponse.status === 'fulfilled' && guardianResponse.value.ok) {
                    const data = await guardianResponse.value.json();
                    const workers = data.workers || [];
                    result.isGuardian = workers.some(w => w.did === did);
                }
                
                // Check greeter (exclusive work role)
                if (greeterResponse.status === 'fulfilled' && greeterResponse.value.ok) {
                    const data = await greeterResponse.value.json();
                    const workers = data.workers || [];
                    result.isGreeter = workers.some(w => w.did === did);
                }
                
                // Check mapper (exclusive work role)
                if (mapperResponse.status === 'fulfilled' && mapperResponse.value.ok) {
                    const data = await mapperResponse.value.json();
                    const workers = data.workers || [];
                    result.isMapper = workers.some(w => w.did === did);
                }
                
                // Check cogitarian (exclusive work role)
                if (cogitarianResponse.status === 'fulfilled' && cogitarianResponse.value.ok) {
                    const data = await cogitarianResponse.value.json();
                    const workers = data.workers || [];
                    result.isCogitarian = workers.some(w => w.did === did);
                }
                
                // Check provisioner (exclusive work role)
                if (provisionerResponse.status === 'fulfilled' && provisionerResponse.value.ok) {
                    const data = await provisionerResponse.value.json();
                    const workers = data.workers || [];
                    result.isProvisioner = workers.some(w => w.did === did);
                }
                
                // Check bursar (exclusive work role)
                if (bursarResponse.status === 'fulfilled' && bursarResponse.value.ok) {
                    const data = await bursarResponse.value.json();
                    const workers = data.workers || [];
                    result.isBursar = workers.some(w => w.did === did);
                }
                
                // Check dreamstyler (affix - suffix "Stylist")
                if (dreamstylerResponse.status === 'fulfilled' && dreamstylerResponse.value.ok) {
                    const data = await dreamstylerResponse.value.json();
                    const workers = data.workers || [];
                    result.isStylist = workers.some(w => w.did === did);
                }
            } catch (error) {
                console.warn('Failed to check worker status (public):', error);
            }
        }
        
        return result;
    }
    
    /**
     * Check stewardship status (Ward/Charge of a Guardian)
     * @private
     */
    static async _checkStewardshipStatus(did, authToken) {
        const result = {
            isWard: false,
            isCharge: false,
            guardianDid: null
        };
        
        try {
            // Use the guardian my-rules endpoint if authenticated
            if (authToken) {
                const response = await fetch('/api/guardian/my-rules', {
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.has_guardian && data.guardian_did) {
                        result.guardianDid = data.guardian_did;
                        // filter_mode: 'whitelist' = ward, 'blacklist' = charge
                        result.isWard = data.filter_mode === 'whitelist';
                        result.isCharge = data.filter_mode === 'blacklist';
                    }
                }
            } else {
                // Public check - need to check if DID appears in any stewardship
                const response = await fetch(`/api/guardian/stewardship-check?did=${encodeURIComponent(did)}`);
                if (response.ok) {
                    const data = await response.json();
                    result.isWard = data.is_ward || false;
                    result.isCharge = data.is_charge || false;
                    result.guardianDid = data.guardian_did || null;
                }
            }
        } catch (error) {
            console.warn('Failed to check stewardship status:', error);
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
            // Exclusive work roles
            isGuardian: false,
            isGreeter: false,
            isMapper: false,
            isCogitarian: false,
            isProvisioner: false,
            isBursar: false,
            // Affix roles
            isCheerful: false,
            isStylist: false,
            // Stewardship
            isWard: false,
            isCharge: false,
            guardianDid: null,
            // Character
            isCharacter: false,
            characterLevel: null,
            canAutoLore: false,
            canAutoCanon: false
        };
    }
    
    /**
     * Get the status label for a user (synchronous, requires pre-fetched data)
     * Follows the new designation hierarchy:
     * - Singular overrides (Keeper)
     * - Exclusive work roles (Guardian, Greeter, etc.)
     * - Affix roles compound with base (Cheerful prefix, Stylist suffix)
     * - Ward/Charge replace Dreamer (not Dreamweaver/Resident)
     * 
     * @param {Object} user - User object with status data
     * @returns {string} Status label
     */
    static getStatusLabel(user) {
        if (!user) return 'Dreamer';
        
        // Singular override - Keeper
        if (user.isKeeper) {
            return 'Keeper of Reverie House';
        }
        
        // Check for exclusive work roles (priority order)
        let hasExclusiveRole = false;
        let exclusiveRole = null;
        
        if (user.isGuardian) {
            exclusiveRole = 'Guardian';
            hasExclusiveRole = true;
        } else if (user.isGreeter) {
            exclusiveRole = 'Greeter of Reveries';
            hasExclusiveRole = true;
        } else if (user.isMapper) {
            exclusiveRole = 'Spectrum Mapper';
            hasExclusiveRole = true;
        } else if (user.isCogitarian) {
            exclusiveRole = 'Cogitarian';
            hasExclusiveRole = true;
        } else if (user.isProvisioner) {
            exclusiveRole = 'Provisioner';
            hasExclusiveRole = true;
        } else if (user.isBursar) {
            exclusiveRole = 'Bursar';
            hasExclusiveRole = true;
        }
        
        // Build designation components
        const parts = [];
        
        // Character prefix
        if (user.characterLevel) {
            const prefixes = {
                'known': 'Known',
                'well-known': 'Well-Known',
                'revered': 'Revered'
            };
            const prefix = prefixes[user.characterLevel];
            if (prefix) parts.push(prefix);
        }
        
        // Cheerful prefix affix (compounds with base identity or work role)
        if (user.isCheerful) {
            parts.push('Cheerful');
        }
        
        // Determine base identity
        let baseIdentity = 'Dreamer';
        let isResident = false;
        let isDreamweaver = false;
        let isWard = false;
        let isCharge = false;
        
        if (user.pdsHost === 'reverie.house' || user.server === 'reverie.house') {
            baseIdentity = 'Resident';
            isResident = true;
        } else if (user.handle?.endsWith('.reverie.house')) {
            baseIdentity = 'Dreamweaver';
            isDreamweaver = true;
        } else {
            // Ward/Charge replace Dreamer only
            if (user.isWard) {
                baseIdentity = 'Ward';
                isWard = true;
            } else if (user.isCharge) {
                baseIdentity = 'Charge';
                isCharge = true;
            }
        }
        
        // Patronage prefix (for Dreamweaver, Ward, Charge)
        // Patronage suffix (for Resident, Dreamer)
        let patronagePrefix = null;
        let patronageSuffix = null;
        
        if (user.characterLevel) {
            // Use character tier as patronage prefix for Ward/Charge/Dreamweaver
            const prefixes = {
                'known': 'Reading',
                'well-known': 'Weaving', 
                'revered': 'Altruist'
            };
            patronagePrefix = prefixes[user.characterLevel];
        }
        
        // For work roles with Resident
        if (hasExclusiveRole) {
            if (isResident) {
                parts.push('Resident');
            }
            parts.push(exclusiveRole);
        } else if (isDreamweaver || isWard || isCharge) {
            // These use PREFIX patronage: "[Character] [Patronage] [Base]"
            if (patronagePrefix && !isResident) {
                parts.push(patronagePrefix);
            }
            parts.push(baseIdentity);
        } else {
            // Resident and Dreamer use SUFFIX patronage: "[Character] [Base] [Patronage]"
            parts.push(baseIdentity);
        }
        
        // Stylist affix (suffix) - only on base identities, not on work roles
        if (user.isStylist && !hasExclusiveRole) {
            parts.push('Stylist');
        }
        
        return parts.join(' ');
    }
    
    /**
     * Get a more detailed status object
     * @param {Object} user - User object
     * @returns {Object} Status object with label, tier, and description
     */
    static getDetailedStatus(user) {
        const label = this.getStatusLabel(user);
        
        // Known status mappings
        const statusMap = {
            'Keeper of Reverie House': {
                label: 'Keeper of Reverie House',
                tier: 'keeper',
                description: 'Loremaster of Reverie House, guardian of the world\'s canon and lore'
            },
            'Guardian': {
                label: 'Guardian',
                tier: 'worker',
                description: 'Steward protecting wards and charges in the wild mindscape'
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
            'Cogitarian': {
                label: 'Cogitarian',
                tier: 'worker',
                description: 'Active worker fostering thoughtful discourse in Reverie House'
            },
            'Provisioner': {
                label: 'Provisioner',
                tier: 'worker',
                description: 'Active worker providing for those in need at Reverie House'
            },
            'Bursar': {
                label: 'Bursar',
                tier: 'worker',
                description: 'Active worker managing the treasury of Reverie House'
            },
            'Ward': {
                label: 'Ward',
                tier: 'stewardship',
                description: 'Under protective stewardship of a Guardian (whitelist filtering)'
            },
            'Charge': {
                label: 'Charge',
                tier: 'stewardship',
                description: 'Under light stewardship of a Guardian (blacklist filtering)'
            },
            'Resident': {
                label: 'Resident',
                tier: 'resident',
                description: 'PDS hosted on reverie.house'
            },
            'Dreamweaver': {
                label: 'Dreamweaver',
                tier: 'dreamweaver',
                description: 'Handle registered under reverie.house domain'
            },
            'Dreamer': {
                label: 'Dreamer',
                tier: 'visitor',
                description: 'Member of the ATProtocol network'
            }
        };
        
        // Check for exact match first
        if (statusMap[label]) {
            return statusMap[label];
        }
        
        // Dynamic matching for compound designations
        // Determine tier based on components
        let tier = 'visitor';
        let description = 'Member of the ATProtocol network';
        
        if (label.includes('Keeper')) {
            tier = 'keeper';
            description = 'Loremaster of Reverie House';
        } else if (label.includes('Guardian') || label.includes('Greeter') || 
                   label.includes('Mapper') || label.includes('Cogitarian') ||
                   label.includes('Provisioner') || label.includes('Bursar')) {
            tier = 'worker';
            description = 'Active worker at Reverie House';
        } else if (label.includes('Resident')) {
            tier = 'resident';
            description = 'PDS hosted on reverie.house';
        } else if (label.includes('Dreamweaver')) {
            tier = 'dreamweaver';
            description = 'Handle registered under reverie.house domain';
        } else if (label.includes('Ward')) {
            tier = 'stewardship';
            description = 'Under protective stewardship of a Guardian';
        } else if (label.includes('Charge')) {
            tier = 'stewardship';
            description = 'Under light stewardship of a Guardian';
        }
        
        // Add context for affixes
        if (label.includes('Cheerful')) {
            description += ' • Member of The Cheerful';
        }
        if (label.includes('Stylist')) {
            description += ' • Crafting visual aesthetics';
        }
        if (label.includes('Known') || label.includes('Well-Known') || label.includes('Revered')) {
            description += ' • Registered character on lore.farm';
        }
        
        return { label, tier, description };
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
     * @param {boolean} [options.capitalize] - Capitalize the label (unused - labels are already capitalized)
     * @param {boolean} [options.article] - Include article (a/an)
     * @returns {string} Formatted status
     */
    static formatStatus(user, options = {}) {
        let label = this.getStatusLabel(user);
        
        // Labels are now always properly capitalized by getStatusLabel
        
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
