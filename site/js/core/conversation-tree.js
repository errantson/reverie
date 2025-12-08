/**
 * Conversation Tree Manager
 * 
 * A flexible system for managing branching dialogue trees with:
 * - Conditional logic and state tracking
 * - Variable interpolation
 * - Reusable subtrees and branches
 * - Dynamic content generation
 * - Event hooks and callbacks
 * - Save/load state support
 */

class ConversationTree {
    constructor(options = {}) {
        // Core components
        this.dialogueWidget = options.dialogueWidget || null;
        this.nodes = new Map(); // Node ID -> Node Definition
        this.currentNodeId = null;
        this.rootNodeId = options.rootNode || 'root';
        
        // State management
        this.variables = new Map(); // Variable name -> value
        this.flags = new Set(); // Boolean flags
        this.history = []; // Array of visited node IDs
        this.choiceHistory = []; // Array of {nodeId, choiceId, timestamp}
        
        // Event hooks
        this.hooks = {
            onNodeEnter: options.onNodeEnter || null,
            onNodeExit: options.onNodeExit || null,
            onChoiceMade: options.onChoiceMade || null,
            onVariableChanged: options.onVariableChanged || null,
            onTreeComplete: options.onTreeComplete || null,
            onTreeCancelled: options.onTreeCancelled || null
        };
        
        // Configuration
        this.enableHistory = options.enableHistory !== false;
        this.maxHistoryLength = options.maxHistoryLength || 100;
        this.allowBacktrack = options.allowBacktrack || false;
        
        // External context providers
        this.contextProviders = new Map(); // name -> async function
        
        // Registered tree definitions
        this.trees = new Map(); // Tree name -> Tree definition
    }
    
    /**
     * Register a conversation tree definition
     * @param {string} name - Unique tree name
     * @param {Object} treeDefinition - Tree structure
     */
    registerTree(name, treeDefinition) {
        this.trees.set(name, treeDefinition);
        
        // Register all nodes from this tree
        if (treeDefinition.nodes) {
            Object.entries(treeDefinition.nodes).forEach(([nodeId, nodeDef]) => {
                this.registerNode(nodeId, nodeDef);
            });
        }
        
        // Set root if specified
        if (treeDefinition.rootNode) {
            this.rootNodeId = treeDefinition.rootNode;
        }
        
        console.log(`✅ [ConversationTree] Registered tree: ${name}`);
    }
    
    /**
     * Register a single node definition
     * @param {string} nodeId - Unique node identifier
     * @param {Object} nodeDef - Node definition
     */
    registerNode(nodeId, nodeDef) {
        this.nodes.set(nodeId, {
            id: nodeId,
            ...nodeDef
        });
    }
    
    /**
     * Register a context provider for dynamic content
     * @param {string} name - Provider name
     * @param {Function} provider - Async function that returns context data
     */
    registerContextProvider(name, provider) {
        this.contextProviders.set(name, provider);
    }
    
    /**
     * Start or restart the conversation tree
     * @param {string} startNodeId - Optional starting node (defaults to root)
     * @param {Object} initialVariables - Optional initial variable values
     */
    async start(startNodeId = null, initialVariables = {}) {
        // Reset state
        this.currentNodeId = null;
        this.history = [];
        this.choiceHistory = [];
        
        // Set initial variables
        Object.entries(initialVariables).forEach(([key, value]) => {
            this.setVariable(key, value);
        });
        
        // Navigate to starting node
        const nodeId = startNodeId || this.rootNodeId;
        await this.gotoNode(nodeId);
    }
    
    /**
     * Navigate to a specific node
     * @param {string} nodeId - Target node ID
     */
    async gotoNode(nodeId) {
        console.log(`🔀 [ConversationTree] Navigating to node: ${nodeId}`);
        
        const node = this.nodes.get(nodeId);
        if (!node) {
            console.error(`❌ [ConversationTree] Node not found: ${nodeId}`);
            return;
        }
        
        // Exit current node
        if (this.currentNodeId && this.hooks.onNodeExit) {
            await this.hooks.onNodeExit(this.currentNodeId, nodeId);
        }
        
        // Update state
        const previousNodeId = this.currentNodeId;
        this.currentNodeId = nodeId;
        
        // Add to history
        if (this.enableHistory) {
            this.history.push(nodeId);
            if (this.history.length > this.maxHistoryLength) {
                this.history.shift();
            }
        }
        
        // Check entry conditions
        if (node.condition && !this.evaluateCondition(node.condition)) {
            console.warn(`⚠️ [ConversationTree] Node condition failed: ${nodeId}`);
            // Try fallback node if specified
            if (node.fallback) {
                return this.gotoNode(node.fallback);
            }
            return;
        }
        
        // Execute entry action
        if (node.onEnter) {
            await node.onEnter(this);
        }
        
        // Fire hook
        if (this.hooks.onNodeEnter) {
            await this.hooks.onNodeEnter(nodeId, previousNodeId);
        }
        
        // Display the node
        await this.displayNode(node);
    }
    
    /**
     * Display a node using the dialogue widget
     * @param {Object} node - Node definition
     */
    async displayNode(node) {
        if (!this.dialogueWidget) {
            console.error('❌ [ConversationTree] No dialogue widget configured');
            return;
        }
        
        // Gather context if needed
        const context = await this.gatherContext(node);
        
        // Build dialogue sequence
        const dialogueSequence = await this.buildDialogueSequence(node, context);
        
        // Show dialogue
        this.dialogueWidget.start(dialogueSequence);
    }
    
    /**
     * Gather dynamic context from providers
     * @param {Object} node - Node definition
     * @returns {Object} Context object
     */
    async gatherContext(node) {
        const context = {
            variables: Object.fromEntries(this.variables),
            flags: Array.from(this.flags)
        };
        
        // Call context providers if specified
        if (node.contextProviders) {
            for (const providerName of node.contextProviders) {
                const provider = this.contextProviders.get(providerName);
                if (provider) {
                    const providerContext = await provider(this);
                    Object.assign(context, providerContext);
                }
            }
        }
        
        return context;
    }
    
    /**
     * Build dialogue sequence from node definition
     * @param {Object} node - Node definition
     * @param {Object} context - Context data
     * @returns {Array} Dialogue sequence
     */
    async buildDialogueSequence(node, context) {
        const sequence = [];
        
        // Handle different node types
        if (node.type === 'sequence') {
            // Multiple dialogue entries in sequence
            for (const entry of node.dialogue) {
                sequence.push(await this.buildDialogueEntry(entry, context));
            }
        } else if (node.type === 'choice') {
            // Single dialogue with choices
            const entry = await this.buildDialogueEntry(node.dialogue, context);
            
            // Add choices
            entry.buttons = await this.buildChoices(node.choices, context);
            
            // Add rotating text if specified
            if (node.rotatingText) {
                entry.rotatingText = this.interpolateArray(node.rotatingText, context);
            }
            
            sequence.push(entry);
        } else if (node.type === 'redirect') {
            // Immediate redirect to another node
            await this.gotoNode(node.target);
            return [];
        } else {
            // Default: single dialogue entry
            sequence.push(await this.buildDialogueEntry(node.dialogue, context));
            
            // Auto-continue to next node if specified
            if (node.next) {
                sequence[sequence.length - 1].buttons = [{
                    text: node.continueText || 'CONTINUE',
                    callback: () => this.gotoNode(node.next)
                }];
            }
        }
        
        return sequence;
    }
    
    /**
     * Build a single dialogue entry
     * @param {Object|Function} dialogue - Dialogue definition or generator function
     * @param {Object} context - Context data
     * @returns {Object} Dialogue entry
     */
    async buildDialogueEntry(dialogue, context) {
        // If dialogue is a function, call it to get the entry
        if (typeof dialogue === 'function') {
            dialogue = await dialogue(this, context);
        }
        
        // Interpolate variables in text
        const entry = {
            speaker: dialogue.speaker,
            avatar: dialogue.avatar,
            text: this.interpolate(dialogue.text, context)
        };
        
        // Handle conditional variants
        if (dialogue.variants) {
            for (const variant of dialogue.variants) {
                if (this.evaluateCondition(variant.condition)) {
                    entry.text = this.interpolate(variant.text, context);
                    break;
                }
            }
        }
        
        return entry;
    }
    
    /**
     * Build choices from node definition
     * @param {Array} choices - Choice definitions
     * @param {Object} context - Context data
     * @returns {Array} Button definitions
     */
    async buildChoices(choices, context) {
        const buttons = [];
        
        for (const choice of choices) {
            // Check if choice is available
            if (choice.condition && !this.evaluateCondition(choice.condition)) {
                continue;
            }
            
            // Build button
            const button = {
                text: this.interpolate(choice.text, context),
                secondary: choice.secondary || false,
                rotating: choice.rotating || false,
                fastRotate: choice.fastRotate || false,
                callback: () => this.makeChoice(choice)
            };
            
            buttons.push(button);
        }
        
        return buttons;
    }
    
    /**
     * Handle a choice being made
     * @param {Object} choice - Choice definition
     */
    async makeChoice(choice) {
        console.log(`✅ [ConversationTree] Choice made: ${choice.id || choice.text}`);
        
        // Record choice in history
        this.choiceHistory.push({
            nodeId: this.currentNodeId,
            choiceId: choice.id || choice.text,
            timestamp: Date.now()
        });
        
        // Execute choice action
        if (choice.onSelect) {
            await choice.onSelect(this);
        }
        
        // Set variables if specified
        if (choice.setVariables) {
            Object.entries(choice.setVariables).forEach(([key, value]) => {
                this.setVariable(key, value);
            });
        }
        
        // Set flags if specified
        if (choice.setFlags) {
            choice.setFlags.forEach(flag => this.setFlag(flag));
        }
        
        // Fire hook
        if (this.hooks.onChoiceMade) {
            await this.hooks.onChoiceMade(choice, this.currentNodeId);
        }
        
        // Navigate to target node
        if (choice.target) {
            await this.gotoNode(choice.target);
        } else if (choice.targets) {
            // Conditional targets
            for (const targetDef of choice.targets) {
                if (this.evaluateCondition(targetDef.condition)) {
                    await this.gotoNode(targetDef.target);
                    return;
                }
            }
            // No condition matched - use fallback
            if (choice.fallback) {
                await this.gotoNode(choice.fallback);
            }
        } else {
            console.warn('⚠️ [ConversationTree] Choice has no target');
        }
    }
    
    /**
     * Evaluate a condition expression
     * @param {Object|Function|string} condition - Condition definition
     * @returns {boolean} Condition result
     */
    evaluateCondition(condition) {
        // Function condition
        if (typeof condition === 'function') {
            return condition(this);
        }
        
        // String condition (variable or flag name)
        if (typeof condition === 'string') {
            return this.hasFlag(condition) || this.getVariable(condition);
        }
        
        // Object condition with operators
        if (typeof condition === 'object') {
            // AND operator
            if (condition.and) {
                return condition.and.every(c => this.evaluateCondition(c));
            }
            
            // OR operator
            if (condition.or) {
                return condition.or.some(c => this.evaluateCondition(c));
            }
            
            // NOT operator
            if (condition.not) {
                return !this.evaluateCondition(condition.not);
            }
            
            // Variable comparison
            if (condition.variable) {
                const value = this.getVariable(condition.variable);
                
                if (condition.equals !== undefined) {
                    return value === condition.equals;
                }
                if (condition.notEquals !== undefined) {
                    return value !== condition.notEquals;
                }
                if (condition.greaterThan !== undefined) {
                    return value > condition.greaterThan;
                }
                if (condition.lessThan !== undefined) {
                    return value < condition.lessThan;
                }
                if (condition.contains !== undefined) {
                    return String(value).includes(condition.contains);
                }
            }
            
            // Flag check
            if (condition.flag) {
                return this.hasFlag(condition.flag);
            }
            
            // History check (has visited node)
            if (condition.visited) {
                return this.hasVisited(condition.visited);
            }
        }
        
        return false;
    }
    
    /**
     * Interpolate variables in a string
     * @param {string} text - Template string
     * @param {Object} context - Context data
     * @returns {string} Interpolated string
     */
    interpolate(text, context = {}) {
        if (!text) return text;
        
        // Replace {{variable}} with values from context or variables
        return text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
            if (context[varName] !== undefined) {
                return context[varName];
            }
            if (this.variables.has(varName)) {
                return this.variables.get(varName);
            }
            return match; // Keep original if not found
        });
    }
    
    /**
     * Interpolate variables in array of strings
     * @param {Array} array - Array of template strings
     * @param {Object} context - Context data
     * @returns {Array} Interpolated strings
     */
    interpolateArray(array, context = {}) {
        return array.map(text => this.interpolate(text, context));
    }
    
    /**
     * Set a variable value
     * @param {string} name - Variable name
     * @param {*} value - Variable value
     */
    setVariable(name, value) {
        const oldValue = this.variables.get(name);
        this.variables.set(name, value);
        
        if (this.hooks.onVariableChanged) {
            this.hooks.onVariableChanged(name, value, oldValue);
        }
    }
    
    /**
     * Get a variable value
     * @param {string} name - Variable name
     * @param {*} defaultValue - Default if not found
     * @returns {*} Variable value
     */
    getVariable(name, defaultValue = null) {
        return this.variables.get(name) || defaultValue;
    }
    
    /**
     * Check if variable exists
     * @param {string} name - Variable name
     * @returns {boolean}
     */
    hasVariable(name) {
        return this.variables.has(name);
    }
    
    /**
     * Set a boolean flag
     * @param {string} name - Flag name
     */
    setFlag(name) {
        this.flags.add(name);
    }
    
    /**
     * Unset a boolean flag
     * @param {string} name - Flag name
     */
    unsetFlag(name) {
        this.flags.delete(name);
    }
    
    /**
     * Check if a flag is set
     * @param {string} name - Flag name
     * @returns {boolean}
     */
    hasFlag(name) {
        return this.flags.has(name);
    }
    
    /**
     * Check if a node has been visited
     * @param {string} nodeId - Node ID
     * @returns {boolean}
     */
    hasVisited(nodeId) {
        return this.history.includes(nodeId);
    }
    
    /**
     * Get the last visited node ID
     * @returns {string|null}
     */
    getPreviousNode() {
        if (this.history.length < 2) return null;
        return this.history[this.history.length - 2];
    }
    
    /**
     * Navigate back to previous node (if enabled)
     */
    async goBack() {
        if (!this.allowBacktrack) {
            console.warn('⚠️ [ConversationTree] Backtracking not enabled');
            return;
        }
        
        const previousNode = this.getPreviousNode();
        if (previousNode) {
            // Remove current node from history
            this.history.pop();
            await this.gotoNode(previousNode);
        }
    }
    
    /**
     * End the conversation tree
     */
    end() {
        if (this.hooks.onTreeComplete) {
            this.hooks.onTreeComplete(this);
        }
        
        if (this.dialogueWidget) {
            this.dialogueWidget.end();
        }
    }
    
    /**
     * Cancel the conversation tree
     */
    cancel() {
        if (this.hooks.onTreeCancelled) {
            this.hooks.onTreeCancelled(this);
        }
        
        if (this.dialogueWidget) {
            this.dialogueWidget.end();
        }
    }
    
    /**
     * Save conversation state
     * @returns {Object} Serialized state
     */
    saveState() {
        return {
            currentNodeId: this.currentNodeId,
            variables: Object.fromEntries(this.variables),
            flags: Array.from(this.flags),
            history: [...this.history],
            choiceHistory: [...this.choiceHistory]
        };
    }
    
    /**
     * Load conversation state
     * @param {Object} state - Saved state
     */
    loadState(state) {
        this.currentNodeId = state.currentNodeId;
        this.variables = new Map(Object.entries(state.variables || {}));
        this.flags = new Set(state.flags || []);
        this.history = state.history || [];
        this.choiceHistory = state.choiceHistory || [];
    }
    
    /**
     * Export state to localStorage
     * @param {string} key - Storage key
     */
    saveToStorage(key) {
        const state = this.saveState();
        localStorage.setItem(key, JSON.stringify(state));
    }
    
    /**
     * Import state from localStorage
     * @param {string} key - Storage key
     * @returns {boolean} Success
     */
    loadFromStorage(key) {
        const data = localStorage.getItem(key);
        if (data) {
            try {
                const state = JSON.parse(data);
                this.loadState(state);
                return true;
            } catch (error) {
                console.error('❌ [ConversationTree] Failed to load state:', error);
            }
        }
        return false;
    }
}

// Export for use in other scripts
window.ConversationTree = ConversationTree;

console.log('✅ [conversation-tree.js] ConversationTree system loaded');
