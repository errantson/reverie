/**
 * Heraldry System - Visual Identity for Foreign PDS Servers
 * 
 * Maps PDS server domains to their visual identity (colors, icons, labels)
 * Provides utility functions for getting heraldry based on server URL or handle
 */

console.log('🛡️ Loading heraldry.js...');

class HeraldrySystem {
    constructor() {
        // Known PDS server configurations
        this.registry = {
            'reverie.house': {
                id: 'reverie',
                name: 'Reverie House',
                fullName: 'Resident Dreamweaver',
                icon: '/assets/icon.png',
                color: '#87408d',
                colorSecondary: '#6a2f70',
                description: 'Home of dreams',
                className: 'heraldry-reverie'
            },
            'bsky.network': {
                id: 'bluesky',
                name: 'Bluesky',
                fullName: 'Awakened Dreamweaver',
                icon: '/assets/bluesky.png',
                color: '#4299e1',
                colorSecondary: '#2b6cb0',
                description: 'The Bluesky network',
                className: 'heraldry-bluesky'
            },
            'northsky.social': {
                id: 'northsky',
                name: 'Northsky',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/northsky.png',
                color: '#C084FC',
                colorSecondary: '#A855F7',
                description: 'Purple-pink horizons',
                className: 'heraldry-northsky'
            },
            'blacksky.app': {
                id: 'blacksky',
                name: 'Blacksky',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/blacksky.png',
                color: '#1a1a1a',
                colorSecondary: '#000000',
                description: 'Dark mysterious realm',
                className: 'heraldry-blacksky'
            },
            'pds.witchcraft.systems': {
                id: 'witchcraft',
                name: 'Witchcraft',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/witchcraft-systems.png',
                color: '#8b3a9c',
                colorSecondary: '#6b2875',
                description: 'Mystical purple domains',
                className: 'heraldry-witchcraft'
            },
            'selfhosted.social': {
                id: 'selfhosted',
                name: 'Selfhosted',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/selfhosted.png',
                color: '#2d7a4f',
                colorSecondary: '#1e5a37',
                description: 'Independent green servers',
                className: 'heraldry-selfhosted'
            },
            'pds.chaos.observer': {
                id: 'chaos',
                name: 'Chaos',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/chaos.png',
                color: '#e85d04',
                colorSecondary: '#9d0208',
                description: 'Entropy and disorder',
                className: 'heraldry-chaos'
            },
            'chaos.observer': {
                id: 'chaos',
                name: 'Chaos',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/chaos.png',
                color: '#e85d04',
                colorSecondary: '#9d0208',
                description: 'Entropy and disorder',
                className: 'heraldry-chaos'
            },
            
            // ===================================================================
            // Discovered PDS Servers (June 2025 Network Scan)
            // ===================================================================
            
            'greysky.social': {
                id: 'greysky',
                name: 'Graysky',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/graysky.png',
                color: '#374151',
                colorSecondary: '#1F2937',
                description: 'Deep grey aesthetic',
                className: 'heraldry-greysky'
            },
            'zio.blue': {
                id: 'zio',
                name: 'Zio',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/zio.png',
                color: '#F41146',
                colorSecondary: '#C40A37',
                description: 'Red skies realm',
                className: 'heraldry-zio'
            },
            'afternooncurry.com': {
                id: 'afternooncurry',
                name: 'Afternoon Curry',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/afternooncurry.png',
                color: '#FF8C00',
                colorSecondary: '#FF7500',
                description: 'Warm spiced domains',
                className: 'heraldry-afternooncurry'
            },
            'at.arles.us': {
                id: 'arles',
                name: 'Arles',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/arles.png',
                color: '#00A9FF',
                colorSecondary: '#0087CC',
                description: 'Sunlit territories',
                className: 'heraldry-arles'
            },
            'pds.atpota.to': {
                id: 'atpotato',
                name: 'AT Potato',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/atpota.png',
                color: '#8B6F47',
                colorSecondary: '#6B5636',
                description: 'Root vegetable networks',
                className: 'heraldry-atpotato'
            },
            'pds.cauda.cloud': {
                id: 'cauda',
                name: 'Cauda Cloud',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/cauda.png',
                color: '#A0522D',
                colorSecondary: '#8B4513',
                description: 'Tail-end cloudscapes',
                className: 'heraldry-cauda'
            },
            'pds.commonscomputer.com': {
                id: 'commonscomputer',
                name: 'Commons Computer',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/commonscomputer.png',
                color: '#10b981',
                colorSecondary: '#059669',
                description: 'Shared computing collective',
                className: 'heraldry-commonscomputer'
            },
            'pds.dholms.xyz': {
                id: 'dholms',
                name: 'DHolms',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/dholms.png',
                color: '#F4A460',
                colorSecondary: '#CD853F',
                description: 'Experimental protocol labs',
                className: 'heraldry-dholms'
            },
            'pds.numergent.com': {
                id: 'numergent',
                name: 'Numergent',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/numergent.png',
                color: '#0891b2',
                colorSecondary: '#0e7490',
                description: 'Numerical emergence',
                className: 'heraldry-numergent'
            },
            'pds.quimian.com': {
                id: 'quimian',
                name: 'Quimian',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/quimian.png',
                color: '#20B2AA',
                colorSecondary: '#008080',
                description: 'Blue digital gardens',
                className: 'heraldry-quimian'
            },
            'pds.robocracy.org': {
                id: 'robocracy',
                name: 'Robocracy',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/robocracy.png',
                color: '#9CA3AF',
                colorSecondary: '#6B7280',
                description: 'Automated governance',
                className: 'heraldry-robocracy'
            },
            'pds.shreyanjain.net': {
                id: 'shreyanjain',
                name: 'Shreyan Jain',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/shreyanjain.png',
                color: '#a3eddb',
                colorSecondary: '#7dd4c4',
                description: 'Personal server realm',
                className: 'heraldry-shreyanjain'
            },
            'boobee.blue': {
                id: 'boobee',
                name: 'Boobee',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/boobee.png',
                color: '#90EE90',
                colorSecondary: '#7CFC00',
                description: 'Light blue domains',
                className: 'heraldry-boobee'
            },

            // ===================================================================
            // January 2026 Network Expansion - Top 30 External PDS Servers
            // Data source: clearsky.app/pds (2026-01-04)
            // ===================================================================

            // ---------------------------------------------------------------
            // TIER 1: Major Community Servers (1,000+ users)
            // ---------------------------------------------------------------

            /**
             * keik.info / kleismic.com (3,754 users)
             * 
             * Japanese social experiment platform - the world's first "physical tweet" 
             * microblog where typing is shared in real-time. Users see each other's 
             * keystrokes as they happen, creating a dystopian transparency where 
             * "the more you try to lie, the more your true feelings are exposed."
             * 
             * Relevance: Novel social mechanics exploring authentic expression.
             * Could inspire "dream-in-progress" features showing thoughts forming.
             */
            'keik.info': {
                id: 'keik',
                name: 'Keik',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/keik.png',
                color: '#1a1a2e',
                colorSecondary: '#16162a',
                description: 'Physical whispers realm - typing shown live',
                className: 'heraldry-keik'
            },

            /**
             * gems.xyz / thegems.app (3,629 users)
             * 
             * Art and photography-focused Bluesky client with the motto 
             * "Real people. Real conversations. Social media you control."
             * Emphasizes visual content and authentic community building.
             * 
             * Relevance: Art-focused community aligns with Reverie's aesthetic
             * sensibilities and creative dreamweaver population.
             */
            'gems.xyz': {
                id: 'gems',
                name: 'Gems',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/gems.png',
                color: '#6C63FF',
                colorSecondary: '#5A52E0',
                description: 'Crystalline galleries of art and photography',
                className: 'heraldry-gems'
            },

            /**
             * pds.sprk.so / sprk.so (2,754 users)
             * 
             * "Spark" - ATProto client emphasizing user sovereignty with the
             * motto "Take back your timeline." Featured in Forbes and TechCrunch
             * for their approach to user-controlled social media.
             * 
             * Relevance: User empowerment philosophy directly matches 
             * Reverie's ethos of dreamweaver autonomy and data ownership.
             */
            'pds.sprk.so': {
                id: 'spark',
                name: 'Spark',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/spark.png',
                color: '#FF6B35',
                colorSecondary: '#E85A2A',
                description: 'Ignited timelines - user sovereignty advocates',
                className: 'heraldry-spark'
            },
            'sprk.so': {
                id: 'spark',
                name: 'Spark',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/spark.png',
                color: '#FF6B35',
                colorSecondary: '#E85A2A',
                description: 'Ignited timelines - user sovereignty advocates',
                className: 'heraldry-spark'
            },

            /**
             * tngl.sh / tangled.org (2,693 users)
             * 
             * "Tangled" - Decentralized Git hosting on ATProto. "Tightly-knit 
             * social coding" with lightweight repo hosting, round-based pull 
             * requests, stacked PRs via Jujutsu, and CI pipelines via spindles.
             * Based in Finland (Tangled Labs Oy).
             * 
             * Relevance: Developer-focused platform where code collaboration
             * meets social networking. Represents the builder/craftsperson archetype.
             */
            'tngl.sh': {
                id: 'tangled',
                name: 'Tangled',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/tangled.png',
                color: '#7C3AED',
                colorSecondary: '#6D28D9',
                description: 'Woven code threads - social Git hosting',
                className: 'heraldry-tangled'
            },
            'tangled.org': {
                id: 'tangled',
                name: 'Tangled',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/tangled.png',
                color: '#7C3AED',
                colorSecondary: '#6D28D9',
                description: 'Woven code threads - social Git hosting',
                className: 'heraldry-tangled'
            },

            /**
             * x.mt.social (1,095 users)
             * 
             * Matrix (Synapse) server providing federated communications.
             * Part of the broader Matrix ecosystem for encrypted, decentralized
             * messaging and collaboration.
             * 
             * Relevance: Federated identity crossover - users bridging
             * between Matrix and ATProto represent multi-protocol citizens.
             */
            'x.mt.social': {
                id: 'matrix',
                name: 'Matrix Social',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/matrix.png',
                color: '#0DBD8B',
                colorSecondary: '#0A9B73',
                description: 'Federated communications bridge',
                className: 'heraldry-matrix'
            },

            /**
             * at.app.wafrn.net / wafrn.net (1,030 users)
             * 
             * WAFRN - "The social network that respects you." Tumblr-inspired
             * federated social platform that bridges both Fediverse (Mastodon)
             * and Bluesky. Features aurora borealis branding and mobile apps.
             * 
             * Relevance: Multi-protocol bridging respects user choice.
             * Their privacy-first approach aligns with Reverie values.
             */
            'at.app.wafrn.net': {
                id: 'wafrn',
                name: 'WAFRN',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/wafrn.png',
                color: '#4ECDC4',
                colorSecondary: '#3DBDB4',
                description: 'Aurora bridge - Tumblr meets federation',
                className: 'heraldry-wafrn'
            },
            'wafrn.net': {
                id: 'wafrn',
                name: 'WAFRN',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/wafrn.png',
                color: '#4ECDC4',
                colorSecondary: '#3DBDB4',
                description: 'Aurora bridge - Tumblr meets federation',
                className: 'heraldry-wafrn'
            },

            /**
             * pds.bsky.yinzcloud.net (1,023 users)
             * 
             * Pittsburgh-based community cloud. "Yinzer" is Pittsburgh slang
             * for locals (from "you ones" → "yinz"). Represents regional
             * identity and community-owned infrastructure.
             * 
             * Relevance: Regional community identity - locals building
             * their own digital home, similar to Reverie's philosophy.
             */
            'pds.bsky.yinzcloud.net': {
                id: 'yinzcloud',
                name: 'Yinzcloud',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/default.png',
                color: '#FFB81C',
                colorSecondary: '#E5A519',
                description: 'Pittsburgh steel city community',
                className: 'heraldry-yinzcloud'
            },

            /**
             * skystack.xyz (1,013 users)
             * 
             * Standard ATProto PDS hosting service providing infrastructure
             * for users wanting their own PDS without self-hosting complexity.
             * 
             * Relevance: Infrastructure provider enabling decentralization
             * by lowering barriers to PDS ownership.
             */
            'skystack.xyz': {
                id: 'skystack',
                name: 'Skystack',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/default.png',
                color: '#3B82F6',
                colorSecondary: '#2563EB',
                description: 'Stacked clouds infrastructure',
                className: 'heraldry-skystack'
            },

            // ---------------------------------------------------------------
            // TIER 2: Growing Communities (200-1,000 users)
            // ---------------------------------------------------------------

            /**
             * bsky.aenead.net (861 users)
             * 
             * Personal services hub offering comprehensive self-hosted digital
             * life: mail (Zoho), files (Seafile), photos (Immich), passwords
             * (Bitwarden), tasks (Vikunja), media (Jellyfin), and more.
             * 
             * Relevance: Model for integrated self-hosted digital sovereignty.
             */
            'bsky.aenead.net': {
                id: 'aenead',
                name: 'Aenead',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/default.png',
                color: '#8B5CF6',
                colorSecondary: '#7C3AED',
                description: 'Digital life sovereign - self-hosted everything',
                className: 'heraldry-aenead'
            },

            /**
             * si46.homes (737 users)
             * 
             * Standard PDS with mysterious alphanumeric naming. The "46" may
             * reference element 46 (Palladium) or have community significance.
             * 
             * Relevance: Part of the growing constellation of personal PDS servers.
             */
            'si46.homes': {
                id: 'si46',
                name: 'SI46',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/default.png',
                color: '#64748B',
                colorSecondary: '#475569',
                description: 'Element 46 territories',
                className: 'heraldry-si46'
            },

            /**
             * bs.k4zka.online (731 users)
             * 
             * Eastern European PDS server. The naming suggests Central/Eastern
             * European origin, contributing to ATProto's geographic diversity.
             * 
             * Relevance: International reach of the ATProto network.
             */
            'bs.k4zka.online': {
                id: 'k4zka',
                name: 'K4ZKA',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/default.png',
                color: '#EF4444',
                colorSecondary: '#DC2626',
                description: 'Eastern territories',
                className: 'heraldry-k4zka'
            },

            /**
             * node.nobody.network (668 users)
             * 
             * Privacy-focused PDS with evocative "nobody" branding. The name
             * suggests anonymity-valuing community or Odysseus reference
             * ("My name is Nobody").
             * 
             * Relevance: Privacy-conscious users who value pseudonymity.
             */
            'node.nobody.network': {
                id: 'nobody',
                name: 'Nobody Network',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/default.png',
                color: '#1F2937',
                colorSecondary: '#111827',
                description: 'Anonymous sanctuaries - privacy first',
                className: 'heraldry-nobody'
            },

            /**
             * bsky.global (222 users)
             * 
             * Global Bluesky client instance, likely serving international
             * users or those wanting a "global" identity namespace.
             * 
             * Relevance: International accessibility layer.
             */
            'bsky.global': {
                id: 'bskyglobal',
                name: 'Bluesky Global',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/default.png',
                color: '#0EA5E9',
                colorSecondary: '#0284C7',
                description: 'Worldwide blue horizons',
                className: 'heraldry-bskyglobal'
            },

            /**
             * cannect.space (187 users)
             * 
             * Connection-themed PDS. The name suggests community building
             * and interpersonal connections as core values.
             * 
             * Relevance: Community-focused infrastructure.
             */
            'cannect.space': {
                id: 'cannect',
                name: 'Cannect',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/default.png',
                color: '#10B981',
                colorSecondary: '#059669',
                description: 'Connection constellation',
                className: 'heraldry-cannect'
            },

            /**
             * surf.social (186 users)
             * 
             * "Surf All Socials" - Cross-platform social aggregator combining
             * Bluesky, Mastodon, Threads, Flipboard, YouTube into unified feeds.
             * Create custom feeds mixing sources, hashtags, and profiles.
             * 
             * Relevance: Multi-platform integration philosophy. Users can
             * create curated experiences across the social web.
             */
            'surf.social': {
                id: 'surf',
                name: 'Surf',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/default.png',
                color: '#06B6D4',
                colorSecondary: '#0891B2',
                description: 'Wave riders - surf all socials',
                className: 'heraldry-surf'
            },

            /**
             * marta.fail (168 users)
             * 
             * Atlanta MARTA (Metropolitan Atlanta Rapid Transit Authority) 
             * transit alerts republished to Bluesky! Civic infrastructure 
             * meets social media - cancelled trips, delays, service updates.
             * Creative civic use of ATProto.
             * 
             * Relevance: Demonstrates ATProto versatility beyond personal social.
             * Real-time public infrastructure information as social feeds.
             */
            'marta.fail': {
                id: 'marta',
                name: 'MARTA Fail',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/marta.png',
                color: '#EF4444',
                colorSecondary: '#DC2626',
                description: 'Transit consciousness - Atlanta rail alerts',
                className: 'heraldry-marta'
            },

            // ---------------------------------------------------------------
            // TIER 3: Notable Niche Servers (50-200 users)
            // ---------------------------------------------------------------

            /**
             * pds.catbird.blue (96 users)
             * 
             * Bird-themed PDS. Catbirds are songbirds known for mimicry,
             * fitting for a social media platform.
             * 
             * Relevance: Whimsical naming in the ATProto ecosystem.
             */
            'pds.catbird.blue': {
                id: 'catbird',
                name: 'Catbird',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/default.png',
                color: '#60A5FA',
                colorSecondary: '#3B82F6',
                description: 'Songbird sanctuary',
                className: 'heraldry-catbird'
            },

            /**
             * pds.snek.cc (95 users)
             * 
             * Major ATProto ecosystem infrastructure hub running on NixOS.
             * Services include: Constellation (graph database), Relay (firehose),
             * Lycan (feed generator), QuickDID, Spacedust (analytics), UFOs,
             * Slingshot (PDS launcher), plus Tangled Git services.
             * 
             * Relevance: Core infrastructure provider enabling ATProto ecosystem.
             */
            'pds.snek.cc': {
                id: 'snek',
                name: 'Snek',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/default.png',
                color: '#22C55E',
                colorSecondary: '#16A34A',
                description: 'Infrastructure serpent - ecosystem backbone',
                className: 'heraldry-snek'
            },
            'snek.cc': {
                id: 'snek',
                name: 'Snek',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/default.png',
                color: '#22C55E',
                colorSecondary: '#16A34A',
                description: 'Infrastructure serpent - ecosystem backbone',
                className: 'heraldry-snek'
            },

            /**
             * roomy.chat / roomy.space (65 users)
             * 
             * "Digital gardening platform for communities." Create Spaces
             * for curating knowledge and conversations. Currently in alpha.
             * 
             * Relevance: Community-building tools complementing social features.
             * "Flourish in Spaces" resonates with Reverie's dreamer communities.
             */
            'roomy.chat': {
                id: 'roomy',
                name: 'Roomy',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/default.png',
                color: '#A855F7',
                colorSecondary: '#9333EA',
                description: 'Digital gardens - community spaces',
                className: 'heraldry-roomy'
            },
            'roomy.space': {
                id: 'roomy',
                name: 'Roomy',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/default.png',
                color: '#A855F7',
                colorSecondary: '#9333EA',
                description: 'Digital gardens - community spaces',
                className: 'heraldry-roomy'
            },

            /**
             * mpi-bluesky-pds.mpi-sws.org (57 users)
             * 
             * Max Planck Institute for Software Systems - prestigious German
             * research institution studying efficient, dependable, secure
             * computing systems. Academic research meets social protocols.
             * 
             * Relevance: Academic legitimacy and research interest in ATProto.
             */
            'mpi-bluesky-pds.mpi-sws.org': {
                id: 'mpisws',
                name: 'MPI-SWS',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/default.png',
                color: '#1E40AF',
                colorSecondary: '#1E3A8A',
                description: 'Academic towers - Max Planck research',
                className: 'heraldry-mpisws'
            },

            /**
             * pds1.podping.at (57 users)
             * 
             * Podcasting infrastructure on ATProto. Podping is a notification
             * system for podcast updates, replacing inefficient RSS polling.
             * 
             * Relevance: Podcasting community adopting ATProto for infrastructure.
             */
            'pds1.podping.at': {
                id: 'podping',
                name: 'Podping',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/default.png',
                color: '#F97316',
                colorSecondary: '#EA580C',
                description: 'Podcast pulse - audio notification network',
                className: 'heraldry-podping'
            },

            /**
             * pds.tribesocial.me (57 users)
             * 
             * "Tribe" - Ethiopian tech community platform with themed groups
             * like "Engineers on Break", "Prompt Society", "Persuasion Nation".
             * Building localized community on ATProto infrastructure.
             * 
             * Relevance: Regional/cultural community building on global protocol.
             */
            'pds.tribesocial.me': {
                id: 'tribe',
                name: 'Tribe',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/default.png',
                color: '#059669',
                colorSecondary: '#047857',
                description: 'Ethiopian tech tribes - community circles',
                className: 'heraldry-tribe'
            },

            /**
             * shinigami.cyou (52 users)
             * 
             * Death Note/anime-themed PDS. Shinigami are death gods in
             * Japanese mythology, popularized by Death Note manga/anime.
             * 
             * Relevance: Anime/otaku community presence on ATProto.
             */
            'shinigami.cyou': {
                id: 'shinigami',
                name: 'Shinigami',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/default.png',
                color: '#7C2D12',
                colorSecondary: '#6B2710',
                description: 'Death god domains - anime realm',
                className: 'heraldry-shinigami'
            },

            /**
             * ocho.app (46 users)
             * 
             * Standard PDS. "Ocho" means eight in Spanish, possibly
             * referencing infinity (∞) rotated or the number itself.
             * 
             * Relevance: International naming, Spanish-speaking community.
             */
            'ocho.app': {
                id: 'ocho',
                name: 'Ocho',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/default.png',
                color: '#F59E0B',
                colorSecondary: '#D97706',
                description: 'Infinity loops - figure eight',
                className: 'heraldry-ocho'
            },

            /**
             * radixians.org (45 users)
             * 
             * Possibly related to Radix (DeFi/blockchain) or mathematical
             * radix (number base). Community of technical/crypto enthusiasts.
             * 
             * Relevance: Crypto/tech community intersection with ATProto.
             */
            'radixians.org': {
                id: 'radixians',
                name: 'Radixians',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/default.png',
                color: '#DC2626',
                colorSecondary: '#B91C1C',
                description: 'Root number theorists',
                className: 'heraldry-radixians'
            },

            /**
             * reme.social (42 users)
             * 
             * Rust-based ATProto frontend. Technical implementation
             * showcasing systems programming in the ATProto ecosystem.
             * 
             * Relevance: Rust developer community presence.
             */
            'reme.social': {
                id: 'reme',
                name: 'Reme',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/default.png',
                color: '#78350F',
                colorSecondary: '#6B2F0D',
                description: 'Rust-forged social',
                className: 'heraldry-reme'
            },

            /**
             * wndr.chat (42 users)
             * 
             * Collaborative sci-fi starship roleplay! Features "ship time" 
             * timestamps (e.g., "t:L/383.49.3"), characters like @ship, @chef,
             * @prikow, @hhollywood. Living narrative with atmospheric pressure
             * alerts, shift changes, crew interactions.
             * 
             * Relevance: PERFECT thematic fit for Reverie! A living dream
             * narrative where users collaboratively inhabit a starship.
             * Demonstrates ATProto as worldbuilding infrastructure.
             */
            'wndr.chat': {
                id: 'wndr',
                name: 'WNDR',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/default.png',
                color: '#1E3A5F',
                colorSecondary: '#0F2942',
                description: 'Starship transmissions - collaborative narrative',
                className: 'heraldry-wndr'
            },

            // ---------------------------------------------------------------
            // TIER 4: Special Interest (<50 users, notable communities)
            // ---------------------------------------------------------------

            /**
             * pds.tgirl.cloud (24 users)
             * 
             * Trans community PDS running on NixOS. Invite-only with
             * 22 members including developers and community builders.
             * Domains like .tgirl.beauty for handles.
             * 
             * Relevance: LGBTQ+ community infrastructure and safe spaces.
             */
            'pds.tgirl.cloud': {
                id: 'tgirl',
                name: 'TGirl Cloud',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/default.png',
                color: '#F472B6',
                colorSecondary: '#EC4899',
                description: 'Trans community cloudspace',
                className: 'heraldry-tgirl'
            },

            /**
             * evil.gay (17 users)
             * 
             * LGBTQ+ themed PDS with playful, irreverent naming.
             * Part of the queer internet's presence on ATProto.
             * 
             * Relevance: Queer community representation and humor.
             */
            'evil.gay': {
                id: 'evilgay',
                name: 'Evil Gay',
                fullName: 'Honoured Guest',
                icon: '/assets/heraldry/default.png',
                color: '#9333EA',
                colorSecondary: '#7C3AED',
                description: 'Chaotic queer energy',
                className: 'heraldry-evilgay'
            }
        };

        // Default heraldry for unknown servers
        this.defaultHeraldry = {
            id: 'default',
            name: 'Guest',
            fullName: 'Honoured Guest',
            icon: '/assets/wild_mindscape.png',
            color: '#2d3748',
            colorSecondary: '#1a202c',
            description: 'Unknown realm',
            className: 'heraldry-default'
        };

        console.log(`🛡️ Heraldry registry loaded with ${Object.keys(this.registry).length} known servers`);
    }

    /**
     * Get heraldry for a DID by resolving its PDS from DID document
     * @param {string} did - User DID
     * @returns {Promise<Object>} Heraldry configuration
     */
    async getByDID(did) {
        if (!did) return this.defaultHeraldry;
        
        try {
            // Fetch DID document from PLC directory
            const response = await fetch(`https://plc.directory/${did}`);
            if (!response.ok) return this.defaultHeraldry;
            
            const didDoc = await response.json();
            const service = didDoc.service?.find(s => s.id === '#atproto_pds');
            const serviceEndpoint = service?.serviceEndpoint;
            
            if (serviceEndpoint) {
                return this.getByServer(serviceEndpoint);
            }
        } catch (error) {
            console.warn('🛡️ Failed to resolve PDS from DID:', did, error);
        }
        
        return this.defaultHeraldry;
    }

    /**
     * Get heraldry for a PDS server URL
     * @param {string} serverUrl - Full PDS URL (e.g., "https://pds.chaos.observer")
     * @returns {Object} Heraldry configuration
     */
    getByServer(serverUrl) {
        if (!serverUrl) return this.defaultHeraldry;
        
        console.log(`🛡️ getByServer called with: ${serverUrl}`);
        
        // Extract domain from URL
        try {
            const url = new URL(serverUrl);
            const hostname = url.hostname;
            
            // Check registry for exact match
            if (this.registry[hostname]) {
                console.log(`🛡️ Exact match found for ${hostname}:`, this.registry[hostname].name);
                return this.registry[hostname];
            }
            
            // Check for partial matches (e.g., pds.chaos.observer matches chaos.observer)
            const parts = hostname.split('.');
            for (let i = 0; i < parts.length - 1; i++) {
                const subdomain = parts.slice(i).join('.');
                if (this.registry[subdomain]) {
                    console.log(`🛡️ Subdomain match found for ${subdomain}:`, this.registry[subdomain].name);
                    return this.registry[subdomain];
                }
            }
        } catch (error) {
            console.warn('🛡️ Invalid server URL:', serverUrl);
        }
        
        console.log(`🛡️ No match found for ${serverUrl}, using default`);
        return this.defaultHeraldry;
    }

    /**
     * Get heraldry for a handle
     * @param {string} handle - User handle (e.g., "chaos.observer")
     * @returns {Object} Heraldry configuration
     */
    getByHandle(handle) {
        if (!handle) return this.defaultHeraldry;
        
        // Extract domain from handle
        const parts = handle.split('.');
        if (parts.length < 2) return this.defaultHeraldry;
        
        // Check for full handle match
        if (this.registry[handle]) {
            return this.registry[handle];
        }
        
        // Check for domain match (last 2 parts usually)
        const domain = parts.slice(-2).join('.');
        if (this.registry[domain]) {
            return this.registry[domain];
        }
        
        // Check for any subdomain match
        for (let i = 0; i < parts.length - 1; i++) {
            const subdomain = parts.slice(i).join('.');
            if (this.registry[subdomain]) {
                return this.registry[subdomain];
            }
        }
        
        return this.defaultHeraldry;
    }

    /**
     * Get heraldry for a dreamer object
     * @param {Object} dreamer - Dreamer object with server property
     * @returns {Object} Heraldry configuration
     */
    getByDreamer(dreamer) {
        if (!dreamer) return this.defaultHeraldry;
        
        // Try server URL first
        if (dreamer.server) {
            const heraldry = this.getByServer(dreamer.server);
            if (heraldry.id !== 'default') return heraldry;
        }
        
        // Fallback to handle
        if (dreamer.handle) {
            return this.getByHandle(dreamer.handle);
        }
        
        return this.defaultHeraldry;
    }

    /**
     * Register a new server heraldry
     * @param {string} domain - Server domain
     * @param {Object} config - Heraldry configuration
     */
    register(domain, config) {
        this.registry[domain] = {
            id: config.id || domain.replace(/\./g, '_'),
            name: config.name || domain,
            fullName: config.fullName || domain,
            icon: config.pngn || this.defaultHeraldry.pngn,
            color: config.color || this.defaultHeraldry.color,
            colorSecondary: config.colorSecondary || config.color || this.defaultHeraldry.colorSecondary,
            description: config.description || '',
            className: config.className || `heraldry-${config.id || domain.replace(/\./g, '_')}`
        };
        console.log(`🛡️ Registered heraldry for ${domain}`);
    }

    /**
     * Get all registered servers
     * @returns {Array} Array of server configurations
     */
    getAllServers() {
        return Object.keys(this.registry).map(domain => ({
            domain,
            ...this.registry[domain]
        }));
    }

    /**
     * Check if a server is registered
     * @param {string} serverUrl - Server URL or domain
     * @returns {boolean}
     */
    isKnown(serverUrl) {
        const heraldry = this.getByServer(serverUrl);
        return heraldry.id !== 'default';
    }
}

// Create global instance
window.heraldrySystem = new HeraldrySystem();

console.log('✅ Heraldry system initialized');
