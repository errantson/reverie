/**
 * Homepage Welcome Conversation Tree
 * 
 * This is an example migration of the homepage welcome dialogue
 * using the ConversationTree system.
 */

const HomepageWelcomeTree = {
    name: 'homepage_welcome',
    rootNode: 'welcome_start',
    
    // Context providers - fetch dynamic data
    contextProviders: {
        // Fetch user session data
        async userSession(tree) {
            const session = window.oauthManager?.getSession();
            return {
                isLoggedIn: !!session,
                userDID: session?.did || null,
                userName: session?.displayName || session?.handle || 'dreamer',
                userHandle: session?.handle || null
            };
        },
        
        // Fetch dreamer data
        async dreamerData(tree) {
            const session = window.oauthManager?.getSession();
            if (!session?.did) return {};
            
            try {
                const response = await fetch('/api/dreamers');
                if (!response.ok) return {};
                
                const dreamers = await response.json();
                const dreamer = dreamers.find(d => d.did === session.did);
                
                return {
                    octant: dreamer?.octant || null,
                    hasLorePrivs: dreamer?.canon_labeler || false,
                    phanera: dreamer?.phanera || null
                };
            } catch (error) {
                console.error('Failed to fetch dreamer data:', error);
                return {};
            }
        },
        
        // Check if user is a greeter
        async greeterStatus(tree) {
            try {
                const token = localStorage.getItem('oauth_token');
                if (!token) return { isGreeter: false };
                
                const response = await fetch('/api/work/greeter/status', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (!response.ok) return { isGreeter: false };
                
                const data = await response.json();
                return { isGreeter: data.is_worker || false };
            } catch (error) {
                return { isGreeter: false };
            }
        },
        
        // Fetch newcomer count for greeters
        async newcomerCount(tree) {
            if (!tree.getVariable('isGreeter')) return { newcomerCount: 0 };
            
            try {
                const response = await fetch('/api/dreamers/stats/newcomers-today');
                if (!response.ok) return { newcomerCount: 0 };
                
                const data = await response.json();
                return { newcomerCount: data.count || 0 };
            } catch (error) {
                return { newcomerCount: 0 };
            }
        }
    },
    
    // Node definitions
    nodes: {
        /**
         * Starting node - route based on login status
         */
        welcome_start: {
            type: 'redirect',
            contextProviders: ['userSession'],
            onEnter: async (tree) => {
                const isLoggedIn = tree.getVariable('isLoggedIn');
                console.log('🏠 Welcome! User logged in:', isLoggedIn);
            },
            target: (tree) => {
                return tree.getVariable('isLoggedIn') ? 'returning_user' : 'new_user';
            }
        },
        
        /**
         * New user welcome
         */
        new_user: {
            type: 'choice',
            dialogue: {
                speaker: 'errantson',
                avatar: '/souvenirs/dream/strange/icon.png',
                text: 'Welcome to Reverie House, dreamer.\nMy name is errantson.\nHave you been here before?'
            },
            choices: [
                {
                    id: 'yes_been_here',
                    text: 'YES, I HAVE',
                    target: 'claim_returning'
                },
                {
                    id: 'not_sure',
                    text: "I DON'T KNOW",
                    secondary: true,
                    rotating: true,
                    target: 'unsure_path'
                }
            ],
            rotatingText: ["I DON'T KNOW", "I'M NOT SURE", "WHERE?", "MMM HUH?"]
        },
        
        /**
         * User claims to be returning
         */
        claim_returning: {
            type: 'sequence',
            dialogue: [
                {
                    speaker: 'errantson',
                    avatar: '/souvenirs/dream/strange/icon.png',
                    text: 'Oh, I must have forgotten!\nApologies, for my memory...'
                },
                {
                    speaker: 'errantson',
                    avatar: '/souvenirs/dream/strange/icon.png',
                    text: 'Let me see if I recognize you.'
                }
            ],
            next: 'prompt_login'
        },
        
        /**
         * Prompt for login
         */
        prompt_login: {
            type: 'choice',
            dialogue: {
                speaker: 'errantson',
                avatar: '/souvenirs/dream/strange/icon.png',
                text: 'Show me who you are.'
            },
            choices: [
                {
                    id: 'login_now',
                    text: 'CONTINUE',
                    onSelect: async (tree) => {
                        // Trigger login flow
                        sessionStorage.setItem('homepage_login_context', 'recognition');
                        sessionStorage.setItem('oauth_return_to', '/');
                        
                        const drawerBtn = document.getElementById('drawerAvatarBtn');
                        if (drawerBtn) {
                            drawerBtn.click();
                        } else if (window.spectrumDrawer) {
                            window.spectrumDrawer.open();
                        }
                        
                        // Listen for login success
                        window.addEventListener('oauth:login', async () => {
                            sessionStorage.removeItem('homepage_login_context');
                            await tree.gotoNode('recognition_success');
                        }, { once: true });
                        
                        // Listen for cancellation
                        window.addEventListener('oauth:cancel', async () => {
                            sessionStorage.removeItem('homepage_login_context');
                            await tree.gotoNode('central_spine');
                        }, { once: true });
                    },
                    target: null // Handled by event listeners
                }
            ]
        },
        
        /**
         * Recognition after successful login
         */
        recognition_success: {
            type: 'sequence',
            contextProviders: ['userSession'],
            dialogue: [
                {
                    speaker: 'errantson',
                    avatar: '/souvenirs/dream/strange/icon.png',
                    text: (tree, context) => {
                        const closingLines = [
                            "It's you again.",
                            "Glad to see you.",
                            "I remember now.",
                            "It's good you're back."
                        ];
                        const randomClosing = closingLines[Math.floor(Math.random() * closingLines.length)];
                        return `Ah, yes.\n{{userName}}!\n${randomClosing}`;
                    }
                },
                {
                    speaker: 'errantson',
                    avatar: '/souvenirs/dream/strange/icon.png',
                    text: "Would you like to introduce yourself\nto the others?"
                }
            ],
            next: 'offer_introduction'
        },
        
        /**
         * Offer introduction posting
         */
        offer_introduction: {
            type: 'choice',
            dialogue: {
                speaker: 'errantson',
                avatar: '/souvenirs/dream/strange/icon.png',
                text: 'Share your name with the others?'
            },
            choices: [
                {
                    id: 'post_introduction',
                    text: 'YES, PLEASE',
                    target: 'post_name_intro'
                },
                {
                    id: 'skip_introduction',
                    text: 'NO, THANKS',
                    target: 'central_spine'
                }
            ]
        },
        
        /**
         * Post introduction (opens BlueskyPoster)
         */
        post_name_intro: {
            type: 'choice',
            onEnter: async (tree) => {
                // Show BlueskyPoster widget
                const showPoster = () => {
                    const bskyPoster = window.homepageScene?.bskyPoster || 
                                      (window.BlueskyPoster ? new window.BlueskyPoster() : null);
                    
                    if (!bskyPoster) {
                        setTimeout(showPoster, 100);
                        return;
                    }
                    
                    bskyPoster.promptAndPost(
                        'at://did:plc:yauphjufk7phkwurn266ybx2/app.bsky.feed.post/3lljjzcydwc25',
                        {
                            promptText: "Introduce yourself",
                            descriptionText: "Share your name in the thread below.",
                            placeholder: "Your name...",
                            maxLength: 50,
                            onSuccess: async (name, result) => {
                                tree.setVariable('postedName', name);
                                await tree.gotoNode('thank_for_name');
                            },
                            onCancel: async () => {
                                await tree.gotoNode('central_spine');
                            }
                        }
                    );
                };
                
                showPoster();
            },
            dialogue: {
                speaker: 'errantson',
                avatar: '/souvenirs/dream/strange/icon.png',
                text: 'Share your name...'
            },
            choices: [] // Handled by widget
        },
        
        /**
         * Thank user for posting name
         */
        thank_for_name: {
            type: 'choice',
            dialogue: {
                speaker: 'errantson',
                avatar: '/souvenirs/dream/strange/icon.png',
                text: `Ah, {{postedName}}.\nI'll remember that.`
            },
            choices: [
                {
                    text: 'THANK YOU',
                    target: 'central_spine'
                }
            ]
        },
        
        /**
         * Unsure path - first time or forgot
         */
        unsure_path: {
            type: 'sequence',
            dialogue: [
                {
                    speaker: 'errantson',
                    avatar: '/souvenirs/dream/strange/icon.png',
                    text: "Your first time? Or, maybe not...\nMost have a hard time remembering.\nI certainly do."
                },
                {
                    speaker: 'errantson',
                    avatar: '/souvenirs/dream/strange/icon.png',
                    text: '\nWhat do they call you between dreams?'
                }
            ],
            next: 'ask_name'
        },
        
        /**
         * Ask for name
         */
        ask_name: {
            type: 'choice',
            dialogue: {
                speaker: 'errantson',
                avatar: '/souvenirs/dream/strange/icon.png',
                text: 'What is your name?'
            },
            choices: [
                {
                    id: 'share_name',
                    text: 'MY NAME?',
                    target: 'post_name_new'
                },
                {
                    id: 'no_name',
                    text: "I DON'T KNOW",
                    secondary: true,
                    rotating: true,
                    target: 'really_unsure'
                }
            ],
            rotatingText: ["I DON'T KNOW", "I'M NOT SURE", "I WON'T SAY", "I CAN'T SAY"]
        },
        
        /**
         * Post name (new user)
         */
        post_name_new: {
            type: 'choice',
            onEnter: async (tree) => {
                // Same as post_name_intro but for new users
                const showPoster = () => {
                    const bskyPoster = window.homepageScene?.bskyPoster || 
                                      (window.BlueskyPoster ? new window.BlueskyPoster() : null);
                    
                    if (!bskyPoster) {
                        setTimeout(showPoster, 100);
                        return;
                    }
                    
                    bskyPoster.promptAndPost(
                        'at://did:plc:yauphjufk7phkwurn266ybx2/app.bsky.feed.post/3lljjzcydwc25',
                        {
                            promptText: "What do they call you?",
                            descriptionText: "Share your name in the thread below, and I'll remember you.",
                            placeholder: "Your name...",
                            maxLength: 50,
                            onSuccess: async (name, result) => {
                                tree.setVariable('postedName', name);
                                await tree.gotoNode('thank_for_name_new');
                            },
                            onCancel: async () => {
                                await tree.gotoNode('central_spine');
                            }
                        }
                    );
                };
                
                showPoster();
            },
            dialogue: {
                speaker: 'errantson',
                avatar: '/souvenirs/dream/strange/icon.png',
                text: 'Tell me your name...'
            },
            choices: []
        },
        
        /**
         * Thank for name (new user variant)
         */
        thank_for_name_new: {
            type: 'sequence',
            dialogue: [
                {
                    speaker: 'errantson',
                    avatar: '/souvenirs/dream/strange/icon.png',
                    text: `Ah, {{postedName}}.\nI'll remember that.`
                },
                {
                    speaker: 'errantson',
                    avatar: '/souvenirs/dream/strange/icon.png',
                    text: "Welcome to Reverie House."
                }
            ],
            next: 'central_spine'
        },
        
        /**
         * Really unsure - skip name
         */
        really_unsure: {
            type: 'sequence',
            dialogue: [
                {
                    speaker: 'errantson',
                    avatar: '/souvenirs/dream/strange/icon.png',
                    text: "That's alright, dreamer.\nNames don't matter much.\nYou can still call this your home."
                }
            ],
            next: 'central_spine'
        },
        
        /**
         * Returning user welcome
         */
        returning_user: {
            type: 'sequence',
            contextProviders: ['userSession', 'dreamerData', 'greeterStatus', 'newcomerCount'],
            onEnter: async (tree) => {
                // Store context in variables for use in dialogue
                const userName = tree.getVariable('userName');
                const isGreeter = tree.getVariable('isGreeter');
                const newcomerCount = tree.getVariable('newcomerCount');
                const octant = tree.getVariable('octant');
                
                console.log(`👋 Welcome back: ${userName}, Greeter: ${isGreeter}, Newcomers: ${newcomerCount}`);
            },
            dialogue: [
                {
                    speaker: 'errantson',
                    avatar: '/souvenirs/dream/strange/icon.png',
                    text: (tree, context) => {
                        const isGreeter = tree.getVariable('isGreeter');
                        const newcomerCount = tree.getVariable('newcomerCount') || 0;
                        
                        if (isGreeter) {
                            if (newcomerCount === 0) {
                                return `Hey {{userName}}! Welcome home.\nThanks for being our greeter.\nLooks like no newcomers today.`;
                            } else {
                                return `Hey {{userName}}! Welcome home.\nThanks for being our greeter.\nWe've got ${newcomerCount} newcomer${newcomerCount === 1 ? '' : 's'} today!`;
                            }
                        }
                        
                        return `Hello, {{userName}}.\nWelcome home!`;
                    }
                }
            ],
            next: 'returning_questions'
        },
        
        /**
         * Ask returning user what they want to do
         */
        returning_questions: {
            type: 'choice',
            contextProviders: ['dreamerData', 'greeterStatus', 'newcomerCount'],
            dialogue: {
                speaker: 'errantson',
                avatar: '/souvenirs/dream/strange/icon.png',
                text: (tree, context) => {
                    const octant = tree.getVariable('octant');
                    
                    if (octant) {
                        return `You seem ${octant} today.\n\nWhat news of our wild mindscape?`;
                    }
                    
                    return "What news of our wild mindscape?\n\nAny interesting dreams?";
                }
            },
            choices: [
                {
                    id: 'share_story',
                    text: 'SHARE STORY',
                    target: 'share_lore_modal'
                },
                {
                    id: 'no_story',
                    text: "I DON'T KNOW",
                    secondary: true,
                    rotating: true,
                    target: 'no_story_today'
                },
                // Conditional choice for greeters with newcomers
                {
                    id: 'view_newcomers',
                    text: "LET'S SEE",
                    condition: (tree) => {
                        return tree.getVariable('isGreeter') && tree.getVariable('newcomerCount') > 0;
                    },
                    onSelect: async (tree) => {
                        window.open('https://bsky.app/profile/reverie.house/post/3lljjzcydwc25', '_blank');
                        tree.end();
                    },
                    target: null
                }
            ],
            rotatingText: ["I DON'T KNOW", "NOTHING YET", "NOT TODAY", "JUST LOOKING"]
        },
        
        /**
         * Share lore modal
         */
        share_lore_modal: {
            type: 'choice',
            onEnter: async (tree) => {
                const showShareLore = () => {
                    const shareLore = window.homepageScene?.shareLoreWidget || 
                                     (window.ShareLore ? new window.ShareLore() : null);
                    
                    if (!shareLore) {
                        setTimeout(showShareLore, 100);
                        return;
                    }
                    
                    shareLore.show();
                    
                    // Listen for success
                    window.addEventListener('sharelore:success', async (event) => {
                        tree.setVariable('sharedStory', event.detail);
                        await tree.gotoNode('story_shared');
                    }, { once: true });
                    
                    // Listen for cancel
                    window.addEventListener('sharelore:cancel', async () => {
                        await tree.gotoNode('central_spine');
                    }, { once: true });
                };
                
                showShareLore();
            },
            dialogue: {
                speaker: 'errantson',
                avatar: '/souvenirs/dream/strange/icon.png',
                text: 'Share your story...'
            },
            choices: []
        },
        
        /**
         * Story shared successfully
         */
        story_shared: {
            type: 'choice',
            contextProviders: ['dreamerData'],
            dialogue: {
                speaker: 'errantson',
                avatar: '/souvenirs/dream/strange/icon.png',
                text: (tree, context) => {
                    const thankYouResponses = [
                        "Wonderful. Your voice adds to our tapestry.",
                        "Excellent. The collective dream grows richer.",
                        "Beautiful. Thank you for sharing.",
                        "Marvelous. Your story is now part of the House."
                    ];
                    return thankYouResponses[Math.floor(Math.random() * thankYouResponses.length)];
                }
            },
            choices: [
                {
                    id: 'offer_tagging',
                    text: 'TAG FOR LORE.FARM',
                    condition: (tree) => tree.getVariable('hasLorePrivs'),
                    target: 'lore_tagging'
                },
                {
                    id: 'skip_tagging',
                    text: 'CONTINUE',
                    target: 'central_spine'
                }
            ]
        },
        
        /**
         * No story today
         */
        no_story_today: {
            type: 'choice',
            contextProviders: ['dreamerData'],
            dialogue: {
                speaker: 'errantson',
                avatar: '/souvenirs/dream/strange/icon.png',
                text: (tree, context) => {
                    const hasLorePrivs = tree.getVariable('hasLorePrivs');
                    
                    if (hasLorePrivs) {
                        return "That's alright.\nTake your time.\n\nAs one of the canon keepers,\nyou know where to find the archives.";
                    }
                    
                    return "That's alright.\nTake your time.";
                }
            },
            choices: [
                {
                    text: 'SHOW ME AROUND',
                    target: 'show_directory'
                }
            ]
        },
        
        /**
         * Central spine - main hub after cancellations
         */
        central_spine: {
            type: 'choice',
            dialogue: {
                speaker: 'errantson',
                avatar: '/souvenirs/dream/strange/icon.png',
                text: "Were you looking for someone?\nIs there anything you need?"
            },
            choices: [
                {
                    id: 'need_help',
                    text: 'I NEED...',
                    rotating: true,
                    target: 'show_directory'
                },
                {
                    id: 'are_you_real',
                    text: "ARE YOU REAL?",
                    secondary: true,
                    target: 'reality_question'
                }
            ],
            rotatingText: ['I WANT...', 'I NEED...']
        },
        
        /**
         * Reality question
         */
        reality_question: {
            type: 'sequence',
            dialogue: [
                {
                    speaker: 'errantson',
                    avatar: '/souvenirs/dream/strange/icon.png',
                    text: "Yes. I am a real person.\nThese are my real words.\nI left them here for you."
                },
                {
                    speaker: 'errantson',
                    avatar: '/souvenirs/dream/strange/icon.png',
                    text: "Are you real?"
                }
            ],
            next: 'reality_affirmation'
        },
        
        /**
         * Reality affirmation
         */
        reality_affirmation: {
            type: 'choice',
            dialogue: {
                speaker: 'errantson',
                avatar: '/souvenirs/dream/strange/icon.png',
                text: 'Are you real?'
            },
            choices: [
                {
                    text: 'PRETTY SURE',
                    secondary: true,
                    rotating: true,
                    fastRotate: true,
                    target: 'shared_reality'
                }
            ],
            rotatingText: ['PRETTY SURE', 'I THINK SO', 'LIKELY', 'YES?', 'PROBABLY', 'I SUPPOSE']
        },
        
        /**
         * Shared reality
         */
        shared_reality: {
            type: 'choice',
            dialogue: {
                speaker: 'errantson',
                avatar: '/souvenirs/dream/strange/icon.png',
                text: "We make what's real.\nThen, it lives between us.\n\nI trust we want the same things.\nWould you like to stay here forever?"
            },
            choices: [
                {
                    text: 'FOREVER?',
                    target: 'forever_question'
                }
            ]
        },
        
        /**
         * Forever question
         */
        forever_question: {
            type: 'choice',
            dialogue: {
                speaker: 'errantson',
                avatar: '/souvenirs/dream/strange/icon.png',
                text: "At least until Reverie House is destroyed.\nThat much, we can promise.\n\nWe can find you a place here.\nSomewhere to call your own.\nWould you like that?"
            },
            choices: [
                {
                    text: 'YES, PLEASE',
                    target: 'offer_account'
                },
                {
                    text: 'NOT YET',
                    secondary: true,
                    target: 'not_ready_account'
                }
            ]
        },
        
        /**
         * Offer account creation
         */
        offer_account: {
            type: 'choice',
            onEnter: async (tree) => {
                // Show CreateDreamer widget
                const showCreator = () => {
                    const creator = window.homepageScene?.createDreamerWidget || 
                                   (window.CreateDreamer ? new window.CreateDreamer() : null);
                    
                    if (!creator) {
                        setTimeout(showCreator, 100);
                        return;
                    }
                    
                    creator.show({
                        onSuccess: async (accountData) => {
                            tree.setVariable('accountUsername', accountData.username);
                            await tree.gotoNode('account_created');
                        },
                        onCancel: async () => {
                            await tree.gotoNode('not_ready_account');
                        }
                    });
                };
                
                showCreator();
            },
            dialogue: {
                speaker: 'errantson',
                avatar: '/souvenirs/dream/strange/icon.png',
                text: 'Creating your account...'
            },
            choices: []
        },
        
        /**
         * Account created successfully
         */
        account_created: {
            type: 'choice',
            dialogue: {
                speaker: 'errantson',
                avatar: '/souvenirs/dream/strange/icon.png',
                text: (tree, context) => {
                    const username = tree.getVariable('accountUsername');
                    const displayName = username.charAt(0).toUpperCase() + username.slice(1);
                    return `${displayName} of Reverie House!\nIt has a nice ring to it.\nWelcome home. Let's get you settled.`;
                }
            },
            choices: [
                {
                    text: "SHOW ME AROUND",
                    target: 'show_directory'
                }
            ]
        },
        
        /**
         * Not ready for account
         */
        not_ready_account: {
            type: 'choice',
            dialogue: {
                speaker: 'errantson',
                avatar: '/souvenirs/dream/strange/icon.png',
                text: "That's alright.\nYou don't need it anyway.\nThis place is yours already.\n\nWould you like to look around?"
            },
            choices: [
                {
                    text: 'SHOW ME AROUND',
                    target: 'show_directory'
                },
                {
                    text: "I'LL EXPLORE",
                    onSelect: async (tree) => tree.end(),
                    target: null
                }
            ]
        },
        
        /**
         * Show directory
         */
        show_directory: {
            type: 'choice',
            onEnter: async (tree) => {
                tree.end(); // End dialogue first
                
                const showDir = () => {
                    const directory = window.homepageScene?.directoryWidget || 
                                     (window.Directory ? new window.Directory() : null);
                    
                    if (!directory) {
                        setTimeout(showDir, 100);
                        return;
                    }
                    
                    directory.show({
                        onSelect: (destination) => {
                            // Show farewell
                            const farewell = [
                                {
                                    speaker: 'errantson',
                                    avatar: '/souvenirs/dream/strange/icon.png',
                                    text: "I'll see you around, dreamer."
                                }
                            ];
                            
                            if (tree.dialogueWidget) {
                                tree.dialogueWidget.start(farewell);
                                setTimeout(() => {
                                    tree.dialogueWidget.end();
                                    window.location.href = destination;
                                }, 2500);
                            } else {
                                window.location.href = destination;
                            }
                        },
                        onClose: () => {
                            // Just leave them on the page
                        }
                    });
                };
                
                showDir();
            },
            dialogue: {
                speaker: 'errantson',
                avatar: '/souvenirs/dream/strange/icon.png',
                text: 'Opening directory...'
            },
            choices: []
        },
        
        /**
         * Lore tagging (placeholder)
         */
        lore_tagging: {
            type: 'choice',
            dialogue: {
                speaker: 'errantson',
                avatar: '/souvenirs/dream/strange/icon.png',
                text: "The lore.farm tagging interface\nwill open soon.\n\nFor now, you can tag it manually."
            },
            choices: [
                {
                    text: 'CONTINUE',
                    target: 'show_directory'
                }
            ]
        }
    }
};

// Register the tree when loaded
if (window.ConversationTree) {
    window.HomepageWelcomeTree = HomepageWelcomeTree;
    console.log('✅ [homepage-welcome.js] Conversation tree definition loaded');
} else {
    console.warn('⚠️ [homepage-welcome.js] ConversationTree not yet loaded');
}
