/**
 * Role Configurations
 * 
 * Centralized configuration for all workshop roles.
 * Used by rolesHeader.js, workSidebar.js, and individual role components.
 */

const RoleConfigs = {
    greeter: {
        title: 'Greeter of Reveries',
        shortTitle: 'Greeter',
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"></path>
            <path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"></path>
            <path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"></path>
            <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"></path>
        </svg>`,
        description: `Newcomers to <b>Reverie House</b> often need someone to show them the way, and a <b>Greeter</b> is usually the one to do it. It doesn't take much, but when someone new arrives they'll have <u><span id="you-link">you</span></u> to introduce and guide them.`,
        extendedDescription: `As <b>Greeter</b> you will automatically provide newcomers with their name, and offer them a friendly human hand to help them, should they need one.`,
        workerLabel: 'CURRENT GREETER:',
        buttonText: 'BECOME GREETER',
        replaceText: 'REPLACE GREETER',
        confirmTitle: 'Become Greeter of Reveries?',
        confirmMessage: 'As Greeter, you will automatically message new dreamers with a personalized welcome to Reverie House.',
        activationMessage: 'You are now the active greeter!',
        appPasswordName: 'Greeter of Reveries',
        passwordPurpose: 'for posting greetings',
        requiresAppPassword: true,
        multiWorker: false,
        showExamples: true,
        color: 'var(--role-greeter)',
        colorMedium: 'var(--role-greeter-medium)',
        colorDark: 'var(--role-greeter-dark)',
        colorLight: 'var(--role-greeter-light)'
    },
    
    mapper: {
        title: 'Spectrum Mapper',
        shortTitle: 'Mapper',
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
        </svg>`,
        description: `Every dream exists somewhere on a complex spectrum that can be measured. Knowing these coordinates can be incredibly helpful for dreamweavers looking to find (or avoid) particular reveries and nightmares.`,
        extendedDescription: `As <b>Spectrum Mapper</b> you will automatically reply the origin coordinates for all dreamers who reveal their beginnings within our wild mindscape.`,
        workerLabel: 'CURRENT MAPPER:',
        buttonText: 'BECOME MAPPER',
        replaceText: 'REPLACE MAPPER',
        confirmTitle: 'Become Spectrum Mapper?',
        confirmMessage: 'As Spectrum Mapper, you will automatically deduce and declare the starting coordinates of those who reveal their origins in our wild mindscape.',
        activationMessage: 'You are now Spectrum Mapper of Reverie House\nThank you for working!\nPlease stop if it feels like work.',
        appPasswordName: 'Spectrum Mapper',
        passwordPurpose: 'for posting origin declarations',
        requiresAppPassword: true,
        multiWorker: false,
        showExamples: true,
        color: 'var(--role-mapper)',
        colorMedium: 'var(--role-mapper-medium)',
        colorDark: 'var(--role-mapper-dark)',
        colorLight: 'var(--role-mapper-light)'
    },
    
    cogitarian: {
        title: 'Cogitarian (Prime)',
        shortTitle: 'Cogitarian',
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"></path>
            <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"></path>
        </svg>`,
        description: `Our <b>Cogitarian</b> is a humanizing authority who helps codify human elements within our shared technical foundation and help deter dehumanizations.`,
        extendedDescription: `You will work closely with the current <b>Keeper(s)</b> to take responsibility for defining the immutably human aspects of our environment, in effort to keep our wild mindscape a more dependable place for real <span onclick="window.wink && window.wink(event)" style="cursor: pointer;">dreamrs</span>.`,
        workerLabel: 'CURRENT COGITARIAN:',
        buttonText: 'BECOME COGITARIAN',
        replaceText: 'REPLACE COGITARIAN',
        confirmTitle: 'Become Cogitarian (Prime)?',
        confirmMessage: 'As Cogitarian, you will help foster thoughtful discourse in Reverie House.',
        activationMessage: 'You are now the active cogitarian!',
        appPasswordName: 'Cogitarian (Prime)',
        passwordPurpose: 'for fostering discourse',
        requiresAppPassword: true,
        multiWorker: false,
        showExamples: false,
        color: 'var(--role-cogitarian)',
        colorMedium: 'var(--role-cogitarian-medium)',
        colorDark: 'var(--role-cogitarian-dark)',
        colorLight: 'var(--role-cogitarian-light)'
    },
    
    provisioner: {
        title: 'Head of Pantry',
        shortTitle: 'Provisioner',
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"></path>
            <path d="M7 2v20"></path>
            <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"></path>
        </svg>`,
        description: `Provisioners are dreamweavers who understand that ease of rest in the waking world eases all manner of dreams across our wild mindscape.`,
        extendedDescription: `When another dreamer at <b>Reverie House</b> feels the real pangs of hunger, it is <b>Head of Pantry</b> who will remotely try to ease their burden with food.`,
        workerLabel: 'CURRENT PROVISIONER:',
        buttonText: 'BECOME PROVISIONER',
        replaceText: 'REPLACE PROVISIONER',
        confirmTitle: 'Become Head of Pantry?',
        confirmMessage: 'As Head of Pantry, you will help ease the hunger of dreamers in need.',
        activationMessage: 'You are now Head of Pantry\nThank you for working!\nPlease stop if it feels like work.',
        appPasswordName: 'Head of Pantry',
        passwordPurpose: 'for managing food assistance',
        requiresAppPassword: true,
        multiWorker: false,
        showExamples: false,
        color: 'var(--role-provisioner)',
        colorMedium: 'var(--role-provisioner-medium)',
        colorDark: 'var(--role-provisioner-dark)',
        colorLight: 'var(--role-provisioner-light)'
    },
    
    dreamstyler: {
        title: 'Dreamstylers',
        shortTitle: 'Dreamstyler',
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"></path>
            <path d="M20 3v4"></path>
            <path d="M22 5h-4"></path>
            <path d="M4 17v2"></path>
            <path d="M5 18H3"></path>
        </svg>`,
        description: `There is a wide difference between the aesthetics of dreams, and a highly visioned <b class="role-text-dreamstyler">Dreamstyler</b> is versatile enough to help shape the dreams of others.`,
        extendedDescription: `Because there are so many tastes, there are many types of <b class="role-text-dreamstyler">Dreamstyler</b> and <b class="role-text-dreamstyler">Reverie House</b> makes no distinction. Let yourself and talent be known to others, but maintain your own designs however you must.`,
        workerLabel: 'ACTIVE DREAMSTYLERS:',
        buttonText: 'BECOME DREAMSTYLER',
        replaceText: 'BECOME DREAMSTYLER',
        confirmTitle: 'Become Dreamstyler?',
        confirmMessage: 'As a <strong>Dreamstyler</strong>, other dreamweavers may entreat you for help shaping aesthetic elements of their dreams. Respond as you please, and use your own discretion when collaborating.<br><br>Contact help@reverie.house if necessary.',
        activationMessage: 'You are now a Dreamstyler\nThank you for working!\nPlease stop if it feels like work.',
        appPasswordName: 'Dreamstyler',
        passwordPurpose: 'for aesthetic work',
        requiresAppPassword: false,
        multiWorker: true,
        showExamples: false,
        color: 'var(--role-dreamstyler)',
        colorMedium: 'var(--role-dreamstyler-medium)',
        colorDark: 'var(--role-dreamstyler-dark)',
        colorLight: 'var(--role-dreamstyler-light)'
    },
    
    bursar: {
        title: 'Bursar of Schemes',
        shortTitle: 'Bursar',
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2"/>
            <path d="M12 8v8"/>
            <path d="M8 12h8"/>
            <circle cx="12" cy="12" r="2"/>
            <path d="M2 10h20"/>
        </svg>`,
        description: `Coordinating the use of scarce resources is a vital and indispensible role (according to the <b class="role-text-bursar">Bursar of Schemes</b>).`,
        extendedDescription: `This guardian of transparency works as the connective tissue between various patrons and the amazing dreams that need their support.`,
        workerLabel: 'CURRENT BURSAR:',
        buttonText: 'BECOME BURSAR',
        replaceText: 'REPLACE BURSAR',
        confirmTitle: 'Become Bursar of Schemes?',
        confirmMessage: 'As Bursar, you will maintain financial transparency and serve as the community\'s point of contact for treasury matters.',
        activationMessage: 'You are now Bursar of Schemes\nMay your stewardship be transparent and true.\nScheme openly!',
        appPasswordName: 'Bursar of Schemes',
        passwordPurpose: 'for treasury management',
        requiresAppPassword: true,
        multiWorker: false,
        showExamples: false,
        color: 'var(--role-bursar)',
        colorMedium: 'var(--role-bursar-medium)',
        colorDark: 'var(--role-bursar-dark)',
        colorLight: 'var(--role-bursar-light)'
    },
    
    cheerful: {
        title: 'The Cheerful',
        shortTitle: 'Cheerful',
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
        </svg>`,
        description: `Uplifting others is both a calling and a labour worthy of recognition. It can be challenging to maintain our positivity, so <b class="role-text-cheerful">The Cheerful</b> lend their optimism as a constant. With trust in community, they surrender themselves to wild support.`,
        extendedDescription: `Like buoyant sprites, <b class="role-text-cheerful">The Cheerful of Reverie House</b> are compelled beyond any will to give favor to their community, no matter how quiet their voice.`,
        workerLabel: 'THE CHEERFUL:',
        buttonText: 'JOIN THE CHEERFUL',
        replaceText: 'JOIN THE CHEERFUL',
        confirmTitle: 'Join The Cheerful?',
        confirmMessage: 'The Cheerful surrender their positivity to the collective, and trust the community\'s intention.<br><br>By taking this role, you authorize Reverie House to influence our wild mindscape with your inherent positivity.',
        activationMessage: 'You have joined The Cheerful\nYour positivity will ripple outward.\nA welcome mat that never sleeps.',
        appPasswordName: 'The Cheerful',
        passwordPurpose: 'for spreading positivity',
        requiresAppPassword: true,
        multiWorker: true,
        showExamples: false,
        color: 'var(--role-cheerful)',
        colorMedium: 'var(--role-cheerful-medium)',
        colorDark: 'var(--role-cheerful-dark)',
        colorLight: 'var(--role-cheerful-light)'
    },
    
    guardian: {
        title: 'Guardians',
        shortTitle: 'Guardian',
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        </svg>`,
        description: `<b class="role-text-guardian">Guardians</b> are trusted dreamweavers who steward the journeys of their <b class="role-text-guardian">Charges</b> and <b class="role-text-guardian">Wards</b> as they explore our wild mindscape together.`,
        extendedDescription: `Each <b class="role-text-guardian">Guardian</b> maintains their own curation to permit and deny presence for certain dreams and dreamweavers. <b class="role-text-guardian">Charges</b> may see everything but the barred, while <b class="role-text-guardian">Wards</b> may only see what is allowed.`,
        workerLabel: 'ACTIVE GUARDIANS:',
        buttonText: 'BECOME GUARDIAN',
        replaceText: 'BECOME GUARDIAN',
        confirmTitle: 'Become a Guardian?',
        confirmMessage: 'As <strong>Guardian</strong>, you are tasked with curating a whitelist and a blacklist of content and accounts.<br><br><strong>Charges</strong> and <strong>Wards</strong> who trust your judgment will subscribe to these lists and benefit from your stewardship.<br><br>All relationships and lists are public.',
        activationMessage: 'You are now a Guardian\nProtect those who seek your shelter.',
        appPasswordName: 'Guardian',
        passwordPurpose: 'for managing protection lists',
        requiresAppPassword: false,
        multiWorker: true,
        showExamples: false,
        color: 'var(--role-guardian)',
        colorMedium: 'var(--role-guardian-medium)',
        colorDark: 'var(--role-guardian-dark)',
        colorLight: 'var(--role-guardian-light)',
        hidden: false // Was hidden, now public
    }
};

// Ordered list of roles for tab display
RoleConfigs.orderedRoles = ['greeter', 'mapper', 'cogitarian', 'provisioner', 'bursar', 'dreamstyler', 'cheerful', 'guardian'];

// Multi-worker roles (can have multiple active workers)
RoleConfigs.multiWorkerRoles = ['dreamstyler', 'cheerful', 'guardian'];

// Get role by name, case-insensitive
RoleConfigs.getRole = function(roleName) {
    return this[roleName?.toLowerCase()] || null;
};

// Check if role is multi-worker
RoleConfigs.isMultiWorker = function(roleName) {
    const config = this.getRole(roleName);
    return config?.multiWorker === true;
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RoleConfigs;
}

// Make available globally
window.RoleConfigs = RoleConfigs;
