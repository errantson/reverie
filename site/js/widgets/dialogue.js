/**
 * Dialogue Widget
 * 
 * Creates RPG-style text dialogue boxes that appear and can be clicked through.
 */

/**
 * Global Dialogue Manager
 * Prevents multiple dialogues from running simultaneously
 */
window.DialogueManager = {
    activeDialogue: null,
    isBlocked: false,
    
    /**
     * Request to start a dialogue
     * @param {Dialogue} dialogue - The dialogue widget instance
     * @returns {boolean} True if allowed to start, false if blocked
     */
    requestStart(dialogue) {
        if (this.isBlocked && this.activeDialogue !== dialogue) {
            console.warn('⚠️ [DialogueManager] Dialogue blocked - another dialogue is active');
            return false;
        }
        
        this.activeDialogue = dialogue;
        this.isBlocked = true;
        console.log('✅ [DialogueManager] Dialogue started');
        return true;
    },
    
    /**
     * Release the dialogue lock
     */
    release() {
        this.activeDialogue = null;
        this.isBlocked = false;
        console.log('✅ [DialogueManager] Dialogue released');
    },
    
    /**
     * Hide any active dialogue (for use by higher-priority modals like login)
     */
    hideActive() {
        if (this.activeDialogue) {
            console.log('🔐 [DialogueManager] Hiding active dialogue for login');
            this.activeDialogue.end();
        }
    }
};

class Dialogue {
    constructor(options = {}) {
        this.container = null;
        this.dialogueBox = null;
        this.textElement = null;
        this.continueIndicator = null;
        this.avatarElement = null;
        this.nameElement = null;
        this.buttonsContainer = null;
        this.currentDialogue = [];
        this.currentDialogueKey = null; // Track which dialogue is currently loaded
        this.currentIndex = 0;
        this.isTyping = false;
        this.typewriterSpeed = options.typewriterSpeed || 30; // ms per character
        this.onComplete = options.onComplete || null;
        this.onStart = options.onStart || null;
        this.skipTypewriter = false; // Allow instant text display on click
        this.currentTypingTimeout = null;
        this.rotatingTextInterval = null;
        this.callbackContext = options.callbackContext || null; // Context object for button callbacks
        this.dialogueCache = new Map(); // Cache loaded dialogues
    }

    /**
     * 🔒 SECURE: Load dialogue via gatekeep endpoint (server-side condition evaluation)
     * This is the recommended way to load dialogues - keys are never exposed to client.
     * 
     * @param {Object} context - Context for dialogue selection
     * @param {string} context.page_context - Page identifier (homepage, spectrum, dreamers, work)
     * @param {Object} context.user_state - User state for condition matching
     * @param {string} context.trigger - What triggered the dialogue (page_load, first_visit, etc)
     * @returns {Promise<Array>} Array of dialogue objects
     */
    async loadDialogueSecure(context) {
        const cacheKey = JSON.stringify(context);
        
        // Check cache first
        if (this.dialogueCache.has(cacheKey)) {
            console.log(`🔒 [dialogue.js] Using cached secure dialogue`);
            return this.dialogueCache.get(cacheKey);
        }
        
        try {
            console.log(`🔒 [dialogue.js] Loading dialogue via gatekeep:`, context);
            const response = await fetch('/api/dialogues/gatekeep', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(context)
            });
            
            if (response.status === 404) {
                console.log(`ℹ️ [dialogue.js] No matching dialogue found for context`);
                return null; // No dialogue matches this context
            }
            
            if (!response.ok) {
                throw new Error(`Failed to load dialogue: ${response.status}`);
            }
            
            const data = await response.json();
            const messages = data.dialogue;
            
            // Transform database format to dialogue widget format
            const dialogue = messages.map(msg => {
                const obj = {
                    speaker: msg.speaker,
                    avatar: msg.avatar,
                    text: msg.text,
                    align: msg.align || 'left'
                };
                
                // Parse buttons if present
                if (msg.buttons_json) {
                    try {
                        obj.buttons = JSON.parse(msg.buttons_json);
                    } catch (e) {
                        console.error('Failed to parse buttons JSON:', e);
                    }
                }
                
                return obj;
            });
            
            // Cache the result
            this.dialogueCache.set(cacheKey, dialogue);
            console.log(`✅ [dialogue.js] Loaded ${dialogue.length} messages via gatekeep`);
            
            return dialogue;
        } catch (error) {
            console.error(`❌ [dialogue.js] Failed to load dialogue via gatekeep:`, error);
            return null;
        }
    }

    /**
     * Load dialogue sequence from database by key (WHITELISTED SYSTEM DIALOGUES ONLY)
     * 
     * ⚠️ USAGE LIMITED: This method only works for whitelisted system dialogues (errors, etc.).
     * For page/quest/context dialogues, use loadDialogueSecure() instead.
     * 
     * @param {string} key - Dialogue key (e.g., 'system:error:404')
     * @returns {Promise<Array>} Array of dialogue objects
     */
    async loadDialogue(key) {
        // Check cache first
        if (this.dialogueCache.has(key)) {
            console.log(`💬 [dialogue.js] Using cached dialogue: ${key}`);
            return this.dialogueCache.get(key);
        }
        
        try {
            console.log(`💬 [dialogue.js] Loading dialogue from API: ${key}`);
            const response = await fetch(`/api/dialogues/${encodeURIComponent(key)}`);
            
            if (response.status === 403) {
                console.error(`🚫 [dialogue.js] Access forbidden to dialogue key: ${key}`);
                console.error(`   This dialogue requires gatekeep. Use loadDialogueSecure() instead.`);
                throw new Error('Access forbidden - dialogue not whitelisted');
            }
            
            if (!response.ok) {
                throw new Error(`Failed to load dialogue: ${response.status}`);
            }
            
            const messages = await response.json();
            
            // Transform database format to dialogue widget format
            const dialogue = messages.map(msg => {
                const obj = {
                    speaker: msg.speaker,
                    avatar: msg.avatar,
                    text: msg.text,
                    align: msg.align || 'left'
                };
                
                // Parse buttons if present
                if (msg.buttons_json) {
                    try {
                        obj.buttons = JSON.parse(msg.buttons_json);
                    } catch (e) {
                        console.error('Failed to parse buttons JSON:', e);
                    }
                }
                
                return obj;
            });
            
            // Cache the result
            this.dialogueCache.set(key, dialogue);
            console.log(`✅ [dialogue.js] Loaded ${dialogue.length} messages for key: ${key}`);
            
            return dialogue;
        } catch (error) {
            console.error(`❌ [dialogue.js] Failed to load dialogue ${key}:`, error);
            // Return fallback dialogue
            return [{
                speaker: 'errantson',
                avatar: '/souvenirs/dream/strange/icon.png',
                text: 'The words I left here\nseem to have scattered.\n\nPlease try again.',
                buttons: [
                    { text: 'OKAY', callback: 'end' }
                ]
            }];
        }
    }
    
    /**
     * 🔒 SECURE: Start a dialogue using server-side gatekeeping
     * This is the recommended way to trigger dialogues.
     * 
     * @param {Object} context - Context for dialogue selection
     * @param {string} context.page_context - Page identifier
     * @param {Object} context.user_state - User state
     * @param {string} context.trigger - What triggered the dialogue
     * @param {Object} callbackContext - Context object for resolving callbacks
     * @returns {Promise<boolean>} True if dialogue started, false if none matched
     */
    async startSecure(context, callbackContext = null) {
        console.log(`🔒 [startSecure] Requesting dialogue with context:`, context);
        
        if (callbackContext) {
            this.callbackContext = callbackContext;
        }
        
        const dialogue = await this.loadDialogueSecure(context);
        
        if (!dialogue || dialogue.length === 0) {
            console.log(`ℹ️ [startSecure] No dialogue matched for context`);
            return false;
        }
        
        console.log(`✅ [startSecure] Starting dialogue with ${dialogue.length} messages`);
        this.start(dialogue);
        return true;
    }
    
    /**
     * Start dialogue from database key (FOR WHITELISTED SYSTEM DIALOGUES)
     * For dynamic/contextual dialogues, use startSecure() instead.
     * 
     * @param {string} key - Dialogue key to load and start
     * @param {Object} callbackContext - Context object for resolving callbacks
     */
    async startFromKey(key, callbackContext = null) {
        console.log(`🔑 [startFromKey] Starting dialogue: ${key}`);
        
        if (callbackContext) {
            this.callbackContext = callbackContext;
        }
        
        const dialogue = await this.loadDialogue(key);
        console.log(`📦 [startFromKey] Loaded dialogue:`, dialogue);
        console.log(`📊 [startFromKey] Dialogue length: ${dialogue ? dialogue.length : 0}`);
        
        if (!dialogue || dialogue.length === 0) {
            console.error(`❌ [startFromKey] Empty or null dialogue for key: ${key}`);
            return;
        }
        
        this.start(dialogue);
    }

    /**
     * Start dialogue from pre-loaded data (for gatekeep responses)
     * @param {Object} dialogueData - Dialogue data object with messages array
     * @param {Object} callbackContext - Context object for resolving callbacks
     */
    async startFromData(dialogueData, callbackContext = null) {
        console.log(`📦 [startFromData] Starting dialogue from data:`, dialogueData.key);
        console.log(`📦 [startFromData] Full dialogueData:`, JSON.stringify(dialogueData, null, 2));
        console.log(`📦 [startFromData] Messages count:`, dialogueData.messages?.length);
        console.log(`📦 [startFromData] First message:`, dialogueData.messages?.[0]);
        
        if (callbackContext) {
            this.callbackContext = callbackContext;
        }
        
        if (!dialogueData || !dialogueData.messages || dialogueData.messages.length === 0) {
            console.error(`❌ [startFromData] Invalid dialogue data:`, dialogueData);
            return;
        }
        
        // Get user context for variable replacement
        const userContext = dialogueData.userContext || {};
        console.log(`👤 [startFromData] User context:`, userContext);
        
        // Helper function to interpolate both {variable} and {{variable}} placeholders
        const interpolate = (text) => {
            if (!text) return text;
            const original = text;
            // Replace {{variable}} (double braces)
            text = text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
                return userContext[varName] !== undefined ? userContext[varName] : match;
            });
            // Replace {variable} (single braces)
            text = text.replace(/\{(\w+)\}/g, (match, varName) => {
                return userContext[varName] !== undefined ? userContext[varName] : match;
            });
            if (original !== text) {
                console.log(`🔄 [interpolate] "${original}" → "${text}"`);
            }
            return text;
        };
        
        // Convert gatekeep message format to dialogue format
        const dialogue = dialogueData.messages.map((msg, idx) => {
            console.log(`🔄 [startFromData] Processing message ${idx}:`, msg);
            
            // Handle buttons - they may be in buttons_json (string) or buttons (array) format
            let buttons = null;
            if (msg.buttons_json) {
                // buttons_json is a string that needs parsing
                console.log(`🔘 [startFromData] Message ${idx} has buttons_json (string)`);
                const parsedButtons = JSON.parse(msg.buttons_json);
                buttons = parsedButtons.map(btn => ({
                    ...btn,
                    text: interpolate(btn.text)
                }));
            } else if (msg.buttons) {
                // buttons is already an array
                console.log(`🔘 [startFromData] Message ${idx} has buttons (array):`, msg.buttons);
                buttons = msg.buttons.map(btn => ({
                    ...btn,
                    text: interpolate(btn.text)
                }));
            }
            
            const result = {
                speaker: msg.speaker,
                avatar: msg.avatar,
                text: interpolate(msg.text), // Interpolate text with user context
                align: msg.align || 'left',
                buttons: buttons,
                context: msg.context || ''
            };
            
            console.log(`✅ [startFromData] Processed message ${idx}:`, result);
            return result;
        });
        
        console.log(`📊 [startFromData] Converted ${dialogue.length} messages`);
        this.start(dialogue);
    }

    /**
     * Initialize the dialogue system
     */
    init() {
        this.createDialogueUI();
        return this;
    }

    /**
     * Create the dialogue UI elements
     */
    createDialogueUI() {
        // Main container
        this.container = document.createElement('div');
        this.container.className = 'dialogue-container';
        this.container.style.display = 'none'; // Hidden by default
        this.container.style.zIndex = '10002'; // Above test shadowbox (10000)
        
        // Dialogue box
        this.dialogueBox = document.createElement('div');
        this.dialogueBox.className = 'dialogue-box';
        
        // Header with avatar and name
        const header = document.createElement('div');
        header.className = 'dialogue-header';
        
        this.avatarElement = document.createElement('img');
        this.avatarElement.className = 'dialogue-avatar';
        this.avatarElement.alt = 'Speaker';
        
        this.nameElement = document.createElement('div');
        this.nameElement.className = 'dialogue-name';
        
        // Close button
        const closeButton = document.createElement('button');
        closeButton.className = 'dialogue-close-btn';
        closeButton.innerHTML = '×';
        closeButton.setAttribute('aria-label', 'Close dialogue');
        closeButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent dialogue advance
            console.log('🎭 [dialogue.js] Close button clicked');
            this.end();
        });
        
        header.appendChild(this.avatarElement);
        header.appendChild(this.nameElement);
        header.appendChild(closeButton);
        
        // Text content
        this.textElement = document.createElement('div');
        this.textElement.className = 'dialogue-text';
        
        // Continue indicator
        this.continueIndicator = document.createElement('div');
        this.continueIndicator.className = 'dialogue-continue';
        this.continueIndicator.innerHTML = '▼';
        this.continueIndicator.style.display = 'none';
        
        // Buttons container
        this.buttonsContainer = document.createElement('div');
        this.buttonsContainer.className = 'dialogue-buttons';
        this.buttonsContainer.style.display = 'none';
        
        // Assemble dialogue box
        this.dialogueBox.appendChild(header);
        this.dialogueBox.appendChild(this.textElement);
        this.dialogueBox.appendChild(this.continueIndicator);
        this.dialogueBox.appendChild(this.buttonsContainer);
        
        // Assemble container
        this.container.appendChild(this.dialogueBox);
        
        // Add to page
        document.body.appendChild(this.container);
        
        // Note: Container background clicks do NOT close the dialogue
        // Users must use the X button or complete the dialogue
        
        // Set up click handler on dialogue box for advancing
        this.dialogueBox.addEventListener('click', () => this.handleClick());
    }

    /**
     * Start a dialogue sequence
     * @param {Array} dialogues - Array of dialogue objects {speaker, avatar, text, buttons, rotatingText}
     * @param {string} dialogueKey - Optional dialogue key for tracking same-dialogue jumps
     */
    start(dialogues, dialogueKey = null) {
        // Check if high-priority modals are visible (login, logout, account creation)
        const highPriorityModals = document.querySelectorAll('.login-overlay, .logout-overlay, .create-dreamer-overlay');
        const hasVisibleModal = Array.from(highPriorityModals).some(el => {
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.opacity !== '0' && el.offsetParent !== null;
        });
        
        if (hasVisibleModal) {
            console.log('🔐 [dialogue.js] Cannot start - high-priority modal is active');
            return;
        }
        
        // Check with DialogueManager
        if (!window.DialogueManager.requestStart(this)) {
            console.warn('⚠️ [dialogue.js] Cannot start - another dialogue is active');
            return;
        }
        
        this.currentDialogue = dialogues;
        this.currentDialogueKey = dialogueKey; // Track which dialogue is loaded
        this.currentIndex = 0;
        this.skipTypewriter = false;
        
        // Show container with fade-in
        this.container.style.display = 'flex';
        setTimeout(() => {
            this.container.classList.add('visible');
        }, 50);
        
        // Callback
        if (this.onStart) {
            this.onStart();
        }
        
        // Show first dialogue
        this.showNext();
    }

    /**
     * Show the next dialogue in sequence
     */
    showNext() {
        if (this.currentIndex >= this.currentDialogue.length) {
            this.end();
            return;
        }
        
        const dialogue = this.currentDialogue[this.currentIndex];
        
        // Update header
        if (dialogue.avatar) {
            this.avatarElement.src = dialogue.avatar;
            this.avatarElement.style.display = 'block';
        } else {
            this.avatarElement.style.display = 'none';
        }
        
        if (dialogue.speaker) {
            this.nameElement.textContent = dialogue.speaker;
            this.nameElement.style.display = 'block';
        } else {
            this.nameElement.style.display = 'none';
        }
        
        // Set text alignment from message data
        const align = dialogue.align || 'left';
        this.textElement.setAttribute('data-align', align);
        
        // Clear text and buttons
        this.textElement.textContent = '';
        this.continueIndicator.style.display = 'none';
        this.buttonsContainer.style.display = 'flex'; // Always show
        this.buttonsContainer.innerHTML = '';
        this.isTyping = true;
        this.skipTypewriter = false;
        
        // Stop any rotating text
        if (this.rotatingTextInterval) {
            clearInterval(this.rotatingTextInterval);
            this.rotatingTextInterval = null;
        }
        
        // Typewriter effect
        this.typeText(dialogue.text, dialogue.buttons, dialogue.rotatingText);
    }

    /**
     * Type text with typewriter effect
     * @param {string} text - Text to display (supports \n for line breaks, **bold**, __italic__)
     * @param {Array} buttons - Optional buttons to show after text
     * @param {Array} rotatingText - Optional array of texts to rotate through
     */
    typeText(text, buttons = null, rotatingText = null) {
        let charIndex = 0;
        
        // Process markdown-style formatting before display
        // **bold** -> <strong>bold</strong>
        // __italic__ -> <em>italic</em>
        let processedText = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/__(.*?)__/g, '<em>$1</em>');
        
        // Replace \n with <br> for display, but preserve blank lines
        // \n\n should become <br><br> to create a visual blank line
        const displayText = processedText.replace(/\n/g, '<br>');
        
        console.log('📝 [dialogue.js typeText] Original text:', JSON.stringify(text));
        console.log('📝 [dialogue.js typeText] Processed text (with formatting):', processedText);
        console.log('📝 [dialogue.js typeText] Display text (with <br>):', displayText);
        console.log('📝 [dialogue.js typeText] Has \\n:', text.includes('\n'));
        console.log('📝 [dialogue.js typeText] Has <br>:', displayText.includes('<br>'));
        
        const typeNextChar = () => {
            // Check if we should skip typewriter
            if (this.skipTypewriter) {
                this.textElement.innerHTML = displayText;
                console.log('⏭️ [typeNextChar SKIP] Set full innerHTML:', this.textElement.innerHTML);
                console.log('⏭️ [typeNextChar SKIP] Contains <br>:', this.textElement.innerHTML.includes('<br>'));
                this.finishTyping(buttons, rotatingText);
                return;
            }
            
            if (charIndex < processedText.length) {
                // Build the current HTML with proper line breaks
                let currentText = processedText.substring(0, charIndex + 1).replace(/\n/g, '<br>');
                this.textElement.innerHTML = currentText;
                console.log(`📝 [typeNextChar] charIndex=${charIndex}, innerHTML length=${this.textElement.innerHTML.length}, contains <br>=${this.textElement.innerHTML.includes('<br>')}`);
                charIndex++;
                
                this.currentTypingTimeout = setTimeout(typeNextChar, this.typewriterSpeed);
            } else {
                this.finishTyping(buttons, rotatingText);
            }
        };
        
        typeNextChar();
    }

    /**
     * Finish typing and show continue indicator or buttons
     * @param {Array} buttons - Optional buttons to show
     * @param {Array} rotatingText - Optional array of texts to rotate through
     */
    finishTyping(buttons = null, rotatingText = null) {
        this.isTyping = false;
        
        // Clear any pending timeout
        if (this.currentTypingTimeout) {
            clearTimeout(this.currentTypingTimeout);
            this.currentTypingTimeout = null;
        }
        
        // If buttons are provided, show them. Otherwise show continue text
        if (buttons && buttons.length > 0) {
            this.showButtons(buttons, rotatingText);
        } else {
            this.showContinueText();
        }
    }
    
    /**
     * Show "Continue..." text in the button area
     */
    showContinueText() {
        this.buttonsContainer.innerHTML = '';
        this.buttonsContainer.style.display = 'flex';
        this.buttonsContainer.style.justifyContent = 'flex-end';
        
        const continueText = document.createElement('div');
        continueText.className = 'dialogue-continue-text';
        continueText.innerHTML = 'Continue &nbsp;▶▶';
        
        this.buttonsContainer.appendChild(continueText);
    }
    
    /**
     * Show buttons for user choice
     * @param {Array} buttons - Array of button objects {text, callback, rotating}
     * @param {Array} rotatingText - Optional array of texts to rotate through for specific button
     */
    showButtons(buttons, rotatingText = null) {
        console.log(`🔘 [showButtons] Called with ${buttons?.length} buttons:`, buttons);
        this.buttonsContainer.innerHTML = '';
        this.buttonsContainer.style.display = 'flex';
        this.buttonsContainer.style.justifyContent = 'center';
        
        buttons.forEach((button, index) => {
            console.log(`🔘 [showButtons] Creating button ${index}:`, button);
            const btn = document.createElement('button');
            btn.className = button.secondary ? 'dialogue-btn secondary' : 'dialogue-btn';
            
            // Create a span for the text content to animate
            const textSpan = document.createElement('span');
            textSpan.className = 'btn-text';
            
            // Check if button text contains pipes (rotating text) - using | instead of , to allow commas in text
            const buttonTexts = button.text.split('|').map(t => t.trim()).filter(t => t);
            const hasRotatingText = buttonTexts.length > 1;
            
            if (hasRotatingText) {
                // Use comma-separated values for rotation
                textSpan.textContent = buttonTexts[0];
                btn.classList.add('rotating');
                
                // Calculate rotation interval based on rotationSpeed (1=fastest, 9=slowest)
                // Speed 1: 400ms, Speed 3: 1200ms, Speed 5: 2000ms, Speed 9: 4000ms
                const speed = button.rotationSpeed || 3;
                const rotationInterval = 400 + ((speed - 1) * 400);
                const animationDuration = rotationInterval / 3; // Animation is 1/3 of interval
                
                let rotationIndex = 0;
                
                // Store interval on the button element so we can clear it independently
                const buttonInterval = setInterval(() => {
                    // Fade out current text
                    textSpan.style.animation = `textFadeRotate ${animationDuration}ms ease-in-out`;
                    
                    // Change text at midpoint of animation
                    setTimeout(() => {
                        rotationIndex = (rotationIndex + 1) % buttonTexts.length;
                        textSpan.textContent = buttonTexts[rotationIndex];
                    }, animationDuration / 2);
                    
                    // Reset animation after complete
                    setTimeout(() => {
                        textSpan.style.animation = '';
                    }, animationDuration);
                    
                }, rotationInterval);
                
                // Store the interval on the button so we can clean it up
                btn._rotationInterval = buttonInterval;
            } else if (button.rotating && rotatingText && rotatingText.length > 0) {
                // Legacy: Use old rotating text array (deprecated)
                textSpan.textContent = button.text;
                btn.classList.add('rotating');
                
                const speed = button.rotationSpeed || 3;
                const rotationInterval = 400 + ((speed - 1) * 400);
                const animationDuration = rotationInterval / 3;
                
                let rotationIndex = index % rotatingText.length;
                
                const buttonInterval = setInterval(() => {
                    textSpan.style.animation = `textFadeRotate ${animationDuration}ms ease-in-out`;
                    
                    setTimeout(() => {
                        rotationIndex = (rotationIndex + 1) % rotatingText.length;
                        textSpan.textContent = rotatingText[rotationIndex];
                    }, animationDuration / 2);
                    
                    setTimeout(() => {
                        textSpan.style.animation = '';
                    }, animationDuration);
                    
                }, rotationInterval);
                
                btn._rotationInterval = buttonInterval;
            } else {
                // Static text
                textSpan.textContent = button.text;
            }
            
            btn.appendChild(textSpan);
            
            btn.addEventListener('click', (e) => {
                console.log('🔘 [dialogue.js] Button clicked:', button.text);
                console.log('   Button object:', button);
                
                e.stopPropagation(); // Don't trigger dialogue box click
                
                // Stop all rotating text intervals
                this.buttonsContainer.querySelectorAll('.dialogue-btn').forEach(btn => {
                    if (btn._rotationInterval) {
                        clearInterval(btn._rotationInterval);
                        btn._rotationInterval = null;
                    }
                });
                
                // Also stop the legacy interval if it exists
                if (this.rotatingTextInterval) {
                    console.log('⏹️ [dialogue.js] Stopping rotating text interval');
                    clearInterval(this.rotatingTextInterval);
                    this.rotatingTextInterval = null;
                }
                
                // Check if button has ANY action type
                if (button.callback || button.url || button.newtab || button.popup || button.drawer || button.goto) {
                    console.log('📞 [dialogue.js] Handling button action...');
                    try {
                        this.handleButtonAction(button);
                        console.log('✅ [dialogue.js] Action executed successfully');
                    } catch (error) {
                        console.error('❌ [dialogue.js] Error in action:', error);
                    }
                } else {
                    console.warn('⚠️ [dialogue.js] No action defined for button');
                }
            });
            
            this.buttonsContainer.appendChild(btn);
        });
    }

    /**
     * Handle button action - supports multiple action types
     * @param {Object} button - Button object with action properties
     */
    handleButtonAction(button) {
        // Priority order: newtab > url > popup > drawer > goto > callback
        
        // 1. New tab (open in background without focus)
        if (button.newtab) {
            console.log(`🔗 [dialogue.js] Opening in new tab (background): ${button.newtab}`);
            window.open(button.newtab, '_blank');
            // Don't end dialogue, let user continue
            return;
        }
        
        // 2. Direct URL navigation (current tab)
        if (button.url) {
            console.log(`🔗 [dialogue.js] Navigating to URL: ${button.url}`);
            this.end();
            window.location.href = button.url;
            return;
        }
        
        // 3. Popup/Modal (show Directory or other modals)
        if (button.popup) {
            console.log(`🪟 [dialogue.js] Opening popup: ${button.popup}`);
            
            // Pause the dialogue (hide but don't end)
            this.pause();
            
            // Handle Directory popup
            if (button.popup === 'directory') {
                console.log('📂 [dialogue.js] Opening Directory widget above shadowbox');
                
                // Get shadowbox reference from callback context
                const shadowbox = this.callbackContext?._shadowbox;
                
                // Load Directory widget if not already loaded
                const loadAndShowDirectory = () => {
                    console.log('📂 Checking window.Directory:', typeof window.Directory, window.Directory);
                    
                    if (window.Directory && typeof window.Directory === 'function') {
                        // Already loaded, show it
                        console.log('✅ Directory found, creating instance...');
                        try {
                            const directoryWidget = new window.Directory();
                            directoryWidget.show({
                                onSelect: (destination) => {
                                    console.log('✅ Directory selection:', destination);
                                    // End dialogue before navigating
                                    this.end();
                                    // Close shadowbox before navigating
                                    if (shadowbox) {
                                        shadowbox.close();
                                    }
                                    if (destination) {
                                        window.location.href = '/' + destination;
                                    }
                                },
                                onClose: () => {
                                    console.log('⏭️ Directory closed, resuming dialogue');
                                    // Resume dialogue when directory closes
                                    this.resume();
                                }
                            });
                        } catch (error) {
                            console.error('❌ Failed to instantiate Directory:', error);
                            console.log('🔄 Attempting to reload directory.js...');
                            // Force reload
                            delete window.Directory;
                            const script = document.createElement('script');
                            script.src = '/js/widgets/directory.js?t=' + Date.now();
                            script.onload = () => {
                                setTimeout(() => loadAndShowDirectory(), 100);
                            };
                            document.head.appendChild(script);
                        }
                    } else {
                        // Not loaded, load the script first
                        console.log('⏳ Loading Directory widget...');
                        const script = document.createElement('script');
                        script.src = '/js/widgets/directory.js';
                        script.onload = () => {
                            console.log('✅ Directory widget loaded, showing...');
                            const directoryWidget = new window.Directory();
                            directoryWidget.show({
                                onSelect: (destination) => {
                                    console.log('✅ Directory selection:', destination);
                                    // End dialogue before navigating
                                    this.end();
                                    // Close shadowbox before navigating
                                    if (shadowbox) {
                                        shadowbox.close();
                                    }
                                    if (destination) {
                                        window.location.href = '/' + destination;
                                    }
                                },
                                onClose: () => {
                                    console.log('⏭️ Directory closed, resuming dialogue');
                                    // Resume dialogue when directory closes
                                    this.resume();
                                }
                            });
                        };
                        script.onerror = () => {
                            console.error('❌ Failed to load Directory widget');
                            this.resume(); // Resume dialogue even if loading failed
                        };
                        document.head.appendChild(script);
                    }
                };
                loadAndShowDirectory();
            } 
            // Handle ShareLore popup
            else if (button.popup === 'sharelore') {
                const showShareLore = () => {
                    if (window.ShareLore) {
                        const shareLoreWidget = new window.ShareLore();
                        shareLoreWidget.show({
                            onClose: () => {
                                console.log('⏭️ ShareLore closed, resuming dialogue');
                                this.resume();
                            }
                        });
                    } else {
                        console.log('⏳ Waiting for ShareLore widget...');
                        setTimeout(showShareLore, 100);
                    }
                };
                showShareLore();
            }
            // Handle CreateDreamer popup
            else if (button.popup === 'createdreamer') {
                const showCreateDreamer = () => {
                    if (window.CreateDreamer) {
                        const createDreamerWidget = new window.CreateDreamer();
                        createDreamerWidget.show({
                            onSuccess: (session) => {
                                console.log('✅ Account created successfully:', session);
                                this.resume();
                            },
                            onCancel: () => {
                                console.log('⏭️ Account creation cancelled');
                                this.resume();
                            }
                        });
                    } else {
                        console.log('⏳ Waiting for CreateDreamer widget...');
                        setTimeout(showCreateDreamer, 100);
                    }
                };
                showCreateDreamer();
            }
            // Handle Spectrum Calculator popup
            else if (button.popup === 'spectrumcalculator') {
                const showSpectrumCalculator = () => {
                    if (window.spectrumCalculatorModal) {
                        console.log('🔢 Opening Spectrum Calculator modal from dialogue');
                        
                        // Store original close handler
                        const originalClose = window.spectrumCalculatorModal.close.bind(window.spectrumCalculatorModal);
                        
                        // Override close to resume dialogue
                        window.spectrumCalculatorModal.close = () => {
                            originalClose();
                            console.log('⏭️ Spectrum Calculator closed, resuming dialogue');
                            this.resume();
                            // Restore original close
                            window.spectrumCalculatorModal.close = originalClose;
                        };
                        
                        window.spectrumCalculatorModal.open();
                    } else {
                        console.log('⏳ Waiting for SpectrumCalculatorModal widget...');
                        setTimeout(showSpectrumCalculator, 100);
                    }
                };
                showSpectrumCalculator();
            }
            // Handle Spectrum Calculator Deluxe popup (with origin calculator and explainer)
            else if (button.popup === 'spectrumdeluxe') {
                const showSpectrumDeluxe = () => {
                    if (window.spectrumCalculatorModal) {
                        console.log('🔢✨ Opening Spectrum Calculator DELUXE from dialogue');
                        
                        // Store original close handler
                        const originalClose = window.spectrumCalculatorModal.close.bind(window.spectrumCalculatorModal);
                        
                        // Override close to resume dialogue
                        window.spectrumCalculatorModal.close = () => {
                            originalClose();
                            console.log('⏭️ Spectrum Calculator Deluxe closed, resuming dialogue');
                            this.resume();
                            // Restore original close
                            window.spectrumCalculatorModal.close = originalClose;
                        };
                        
                        window.spectrumCalculatorModal.open(false, true);  // showDeluxe=true
                    } else {
                        console.log('⏳ Waiting for SpectrumCalculatorModal widget...');
                        setTimeout(showSpectrumDeluxe, 100);
                    }
                };
                showSpectrumDeluxe();
            }
            // Handle Login popup
            else if (button.popup === 'login') {
                console.log('🪟 [dialogue.js] Opening login popup');
                this.pause();
                
                if (window.loginWidget && typeof window.loginWidget.showLoginPopup === 'function') {
                    window.loginWidget.showLoginPopup();
                } else {
                    console.warn('⚠️ Login widget not available');
                }
                
                // Resume after a delay as fallback
                setTimeout(() => {
                    console.log('⏭️ Login popup timeout, resuming dialogue');
                    this.resume();
                }, 5000);
            }
            // Handle Bluesky Explanation popup
            else if (button.popup === 'bskyexplain') {
                console.log('🪟 [dialogue.js] Opening bsky explanation popup');
                this.pause();
                
                const showBskyExplain = () => {
                    if (window.bskyExplainModal) {
                        console.log('📘 Opening Bluesky Explanation modal from dialogue');
                        
                        // Store original close handler
                        const originalClose = window.bskyExplainModal.close.bind(window.bskyExplainModal);
                        
                        // Override close to resume dialogue
                        window.bskyExplainModal.close = () => {
                            originalClose();
                            console.log('⏭️ Bluesky Explanation closed, resuming dialogue');
                            this.resume();
                            // Restore original close
                            window.bskyExplainModal.close = originalClose;
                        };
                        
                        window.bskyExplainModal.open();
                    } else {
                        console.log('⏳ Waiting for BskyExplainModal widget...');
                        setTimeout(showBskyExplain, 100);
                    }
                };
                showBskyExplain();
            }
            else {
                // Generic popup - pause and wait
                console.log('⏸️ [dialogue.js] Generic popup, dialogue paused');
                // Resume after a delay as fallback
                setTimeout(() => {
                    console.log('⏭️ Generic popup timeout, resuming dialogue');
                    this.resume();
                }, 5000);
            }
            return;
        }
        
        // 4. Drawer navigation (future implementation)
        if (button.drawer) {
            console.log(`📋 [dialogue.js] Opening drawer: ${button.drawer}`);
            this.end();
            // TODO: Implement drawer navigation
            // For now, just end dialogue
            return;
        }
        
        // 5. GOTO navigation (dialogue:index format)
        if (button.goto) {
            console.log(`🔀 [dialogue.js] Processing goto: ${button.goto}`);
            const gotoFn = this.resolveGotoCallback(button.goto);
            gotoFn();
            return;
        }
        
        // 6. Callback resolution (existing behavior)
        let callbackFn = button.callback;
        
        if (typeof callbackFn === 'string') {
            // Special built-in handlers
            if (callbackFn === 'end') {
                callbackFn = () => this.end();
            } else if (callbackFn === 'continue') {
                // Continue to next message in sequence
                callbackFn = () => {
                    this.currentIndex++;
                    this.showNext();
                };
            } else if (callbackFn.startsWith('goto')) {
                // Handle goto actions (e.g., 'gotoGettingStarted')
                callbackFn = this.resolveGotoCallback(callbackFn);
            } else if (this.callbackContext && typeof this.callbackContext[callbackFn] === 'function') {
                // Resolve from context object
                callbackFn = () => this.callbackContext[callbackFn](this);
            } else if (window.dialogueCallbacks && typeof window.dialogueCallbacks[callbackFn] === 'function') {
                // Resolve from global dialogueCallbacks registry
                console.log(`🌐 [dialogue.js] Resolving callback from global registry: ${callbackFn}`);
                callbackFn = () => window.dialogueCallbacks[callbackFn](this);
            } else {
                console.warn(`⚠️ [dialogue.js] Unknown callback: ${callbackFn}`);
                callbackFn = () => this.end();
            }
        }
        
        callbackFn();
    }

    /**
     * Resolve goto-style callbacks
     * Supports multiple formats:
     * - 'goto:5' - Jump to message index 5 in current dialogue (legacy)
     * - 'dialogue-key:5' - Jump to message index 5 in specified dialogue
     * - 'dialogue-key' - Load specified dialogue from beginning
     * - 'gotoSpectrum' - Navigate to page URL
     * @param {string} callbackName - Callback name or goto target
     * @returns {Function} Callback function
     */
    resolveGotoCallback(callbackName) {
        // Check if it contains a colon (dialogue:index or goto:index format)
        if (callbackName.includes(':')) {
            const parts = callbackName.split(':');
            
            // Legacy format: 'goto:5'
            if (parts[0] === 'goto' && parts.length === 2) {
                const targetIndex = parseInt(parts[1]);
                if (!isNaN(targetIndex) && targetIndex >= 0) {
                    return () => {
                        console.log(`🔀 [dialogue.js] Jumping to message index ${targetIndex}`);
                        this.currentIndex = targetIndex;
                        this.showNext();
                    };
                }
            }
            
            // New format: 'dialogue-key:index'
            if (parts.length >= 2) {
                const lastPart = parts[parts.length - 1];
                const targetIndex = parseInt(lastPart);
                
                // If last part is a number, it's a dialogue:index jump
                if (!isNaN(targetIndex) && targetIndex >= 0) {
                    const dialogueKey = parts.slice(0, -1).join(':');
                    return async () => {
                        console.log(`🔀 [dialogue.js] Jumping to ${dialogueKey} message ${targetIndex}`);
                        
                        // Check if we're already in this dialogue (avoid unnecessary reload)
                        if (this.currentDialogueKey === dialogueKey && this.currentDialogue.length > 0) {
                            console.log(`🔀 [dialogue.js] Already in ${dialogueKey}, jumping to index ${targetIndex}`);
                            if (targetIndex < this.currentDialogue.length) {
                                this.currentIndex = targetIndex;
                                this.showNext();
                            } else {
                                console.error(`❌ Message index ${targetIndex} out of range (max: ${this.currentDialogue.length - 1})`);
                                this.end();
                            }
                            return;
                        }
                        
                        // Need to load the dialogue
                        try {
                            const messages = await this.loadDialogue(dialogueKey);
                            if (messages && messages.length > targetIndex) {
                                this.currentDialogue = messages;
                                this.currentDialogueKey = dialogueKey;
                                this.currentIndex = targetIndex;
                                this.showNext();
                            } else {
                                console.error(`❌ Message index ${targetIndex} out of range for ${dialogueKey}`);
                                this.end();
                            }
                        } catch (error) {
                            console.error(`❌ Failed to load dialogue ${dialogueKey}:`, error);
                            this.end();
                        }
                    };
                }
            }
        }
        
        // Map common goto callbacks to URLs
        const gotoMap = {
            'gotoGettingStarted': '/getting-started',
            'gotoSpectrum': '/spectrum',
            'gotoSouvenirs': '/souvenirs',
            'gotoLibrary': '/library',
            'gotoDreamers': '/dreamviewer',
            'gotoStory': '/story',
            'gotoDatabase': '/database'
        };
        
        const url = gotoMap[callbackName];
        if (url) {
            return () => {
                this.end();
                window.location.href = url;
            };
        }
        
        // If no special format matched, treat as dialogue key to load from beginning
        if (callbackName && !callbackName.startsWith('goto')) {
            return async () => {
                console.log(`🔀 [dialogue.js] Loading dialogue: ${callbackName}`);
                try {
                    const messages = await this.loadDialogue(callbackName);
                    if (messages && messages.length > 0) {
                        this.currentDialogue = messages;
                        this.currentIndex = 0;
                        this.showNext();
                    } else {
                        console.error(`❌ Dialogue ${callbackName} has no messages`);
                        this.end();
                    }
                } catch (error) {
                    console.error(`❌ Failed to load dialogue ${callbackName}:`, error);
                    this.end();
                }
            };
        }
        
        console.warn(`⚠️ [dialogue.js] Unknown goto callback: ${callbackName}`);
        return () => this.end();
    }

    /**
     * Handle click on dialogue box
     */
    handleClick() {
        // Don't advance if actual choice buttons are showing
        const hasButtons = this.buttonsContainer.querySelector('.dialogue-btn');
        if (hasButtons) {
            return;
        }
        
        if (this.isTyping) {
            // Skip typewriter effect
            this.skipTypewriter = true;
        } else {
            // Move to next dialogue
            this.currentIndex++;
            this.showNext();
        }
    }

    /**
     * End dialogue sequence
     */
    end() {
        // Release the dialogue lock
        window.DialogueManager.release();
        
        // Fade out
        this.container.classList.remove('visible');
        
        setTimeout(() => {
            this.container.style.display = 'none';
            
            // Callback
            if (this.onComplete) {
                this.onComplete();
            }
        }, 300);
    }

    /**
     * Pause dialogue (hide but maintain state)
     */
    pause() {
        console.log('⏸️ [dialogue.js] Pausing dialogue');
        // Hide the dialogue container but don't release the lock
        this.container.classList.remove('visible');
        this.container.style.display = 'none';
    }

    /**
     * Resume dialogue (show and restore state)
     */
    resume() {
        console.log('▶️ [dialogue.js] Resuming dialogue');
        // Show the dialogue container again
        this.container.style.display = 'flex';
        // Small delay to allow display to take effect before adding visible class
        setTimeout(() => {
            this.container.classList.add('visible');
        }, 10);
    }

    /**
     * Add more dialogue to the sequence
     * @param {Array} dialogues - Additional dialogue objects
     */
    addDialogue(dialogues) {
        this.currentDialogue.push(...dialogues);
    }
    
    /**
     * Clean up
     */
    destroy() {
        if (this.currentTypingTimeout) {
            clearTimeout(this.currentTypingTimeout);
        }
        if (this.rotatingTextInterval) {
            clearInterval(this.rotatingTextInterval);
        }
        if (this.container && this.container.parentNode) {
            this.container.remove();
        }
    }
}

// Export class for use in other scripts (like Shadowbox)
window.Dialogue = Dialogue;

// Create global instance for direct use (inbox, etc.)
window.dialogue = new Dialogue({
    typewriterSpeed: 30
});

// Initialize the global instance
window.dialogue.init();

console.log('✅ [dialogue.js] Dialogue widget loaded');
