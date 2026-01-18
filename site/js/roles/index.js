/**
 * Work Roles Module Index
 * 
 * Main entry point for loading all role components.
 * This file initializes all role components when loaded.
 */

// Initialize all role components on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    // Wait for dependencies to be available
    const initializeRoles = () => {
        // Check if RoleConfigs is available
        if (typeof RoleConfigs === 'undefined') {
            console.log('⏳ Roles: Waiting for RoleConfigs...');
            setTimeout(initializeRoles, 100);
            return;
        }
        
        console.log('🎭 Roles: Initializing role components...');
        
        // Initialize work core first
        if (window.WorkCore && !window.workCore) {
            window.workCore = new WorkCore();
            window.workCore.init();
            console.log('✅ Roles: WorkCore initialized');
        }
        
        // Initialize sidebar
        if (window.WorkSidebar) {
            window.workSidebar = new WorkSidebar();
            window.workSidebar.init();
            console.log('✅ Roles: WorkSidebar initialized');
        }
        
        // Initialize roles header
        if (window.RolesHeader) {
            window.rolesHeader = new RolesHeader();
            window.rolesHeader.init();
            console.log('✅ Roles: RolesHeader initialized');
        }
        
        // Initialize individual role components
        if (window.GreeterRole) {
            window.greeterRole = new GreeterRole();
            window.greeterRole.init();
            console.log('✅ Roles: GreeterRole initialized');
        }
        
        if (window.MapperRole) {
            window.mapperRole = new MapperRole();
            window.mapperRole.init();
            console.log('✅ Roles: MapperRole initialized');
        }
        
        if (window.CogitarianRole) {
            window.cogitarianRole = new CogitarianRole();
            window.cogitarianRole.init();
            console.log('✅ Roles: CogitarianRole initialized');
        }
        
        if (window.ProvisionerRole) {
            window.provisionerRole = new ProvisionerRole();
            window.provisionerRole.init();
            console.log('✅ Roles: ProvisionerRole initialized');
        }
        
        if (window.DreamstylerRole) {
            window.dreamstylerRole = new DreamstylerRole();
            window.dreamstylerRole.init();
            console.log('✅ Roles: DreamstylerRole initialized');
        }
        
        if (window.BursarRole) {
            window.bursarRole = new BursarRole();
            window.bursarRole.init();
        }
        
        if (window.CheerfulRole) {
            window.cheerfulRole = new CheerfulRole();
            window.cheerfulRole.init();
        }
        
        if (window.GuardianRole) {
            window.guardianRole = new GuardianRole();
            window.guardianRole.init();
        }
        
        // Connect sidebar to workCore for status updates
        if (window.workSidebar && window.workCore) {
            window.addEventListener('work:status-updated', () => {
                window.workSidebar.setRoleStatuses(window.workCore.roleStatuses);
            });
            
            window.addEventListener('work:statuses-loaded', (event) => {
                window.workSidebar.setRoleStatuses(event.detail.statuses);
            });
        }
        
        // Dispatch initialization complete event
        window.dispatchEvent(new CustomEvent('roles:initialized'));
    };
    
    // Start initialization
    initializeRoles();
});

// Expose a function to manually trigger re-initialization if needed
window.reinitializeRoles = function() {
    console.log('🔄 Roles: Re-initializing components...');
    
    if (window.workCore) window.workCore.init();
    if (window.workSidebar) window.workSidebar.init();
    if (window.rolesHeader) window.rolesHeader.init();
    if (window.greeterRole) window.greeterRole.init();
    if (window.mapperRole) window.mapperRole.init();
    if (window.cogitarianRole) window.cogitarianRole.init();
    if (window.provisionerRole) window.provisionerRole.init();
    if (window.dreamstylerRole) window.dreamstylerRole.init();
    if (window.bursarRole) window.bursarRole.init();
    if (window.cheerfulRole) window.cheerfulRole.init();
    if (window.guardianRole) window.guardianRole.init();
    
    console.log('🔄 Roles: Re-initialization complete');
};
