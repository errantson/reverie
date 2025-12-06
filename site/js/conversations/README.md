# Conversation Tree System

A flexible, modular system for managing branching dialogue trees with conditional logic, state management, and dynamic content generation.

## Overview

The Conversation Tree system replaces hardcoded dialogue sequences with declarative tree definitions that support:

- **Conditional branching** - Show different paths based on user state, flags, or variables
- **State management** - Track variables, flags, and conversation history
- **Dynamic content** - Generate dialogue text based on context and external data
- **Reusable components** - Define subtrees and branches that can be used in multiple places
- **Event hooks** - React to node changes, choices, and state updates
- **Save/load** - Persist conversation state to localStorage

## Architecture

### Core Components

1. **ConversationTree** (`js/core/conversation-tree.js`) - Main manager class
2. **Tree Definitions** (`js/conversations/*.js`) - Declarative tree structures
3. **Dialogue Widget** - Visual component for displaying dialogue (existing)
4. **Context Providers** - Functions that fetch dynamic data

## Quick Start

### 1. Create a Tree Definition

```javascript
const MyConversationTree = {
    name: 'my_conversation',
    rootNode: 'start',
    
    // Optional context providers
    contextProviders: {
        async userData(tree) {
            const session = window.oauthManager?.getSession();
            return {
                userName: session?.displayName || 'friend',
                isLoggedIn: !!session
            };
        }
    },
    
    nodes: {
        // Simple dialogue node
        start: {
            type: 'choice',
            dialogue: {
                speaker: 'guide',
                avatar: '/path/to/avatar.png',
                text: 'Hello, {{userName}}! Welcome!'
            },
            choices: [
                {
                    id: 'option_a',
                    text: 'TELL ME MORE',
                    target: 'next_node'
                },
                {
                    id: 'option_b',
                    text: 'LEAVE',
                    onSelect: async (tree) => tree.end()
                }
            ]
        },
        
        next_node: {
            type: 'sequence',
            dialogue: [
                {
                    speaker: 'guide',
                    avatar: '/path/to/avatar.png',
                    text: 'Let me explain...'
                }
            ],
            next: 'end'
        },
        
        end: {
            type: 'choice',
            dialogue: {
                speaker: 'guide',
                avatar: '/path/to/avatar.png',
                text: 'Farewell!'
            },
            choices: [
                {
                    text: 'GOODBYE',
                    onSelect: async (tree) => tree.end()
                }
            ]
        }
    }
};
```

### 2. Initialize and Start

```javascript
// Initialize conversation tree
const conversationTree = new ConversationTree({
    dialogueWidget: dialogueWidgetInstance,
    onTreeComplete: () => {
        console.log('Conversation completed!');
    }
});

// Register tree definition
conversationTree.registerTree('my_conversation', MyConversationTree);

// Start conversation
await conversationTree.start();
```

## Node Types

### `sequence`
Multiple dialogue entries shown in order.

```javascript
{
    type: 'sequence',
    dialogue: [
        {
            speaker: 'npc',
            avatar: '/avatar.png',
            text: 'First message.'
        },
        {
            speaker: 'npc',
            avatar: '/avatar.png',
            text: 'Second message.'
        }
    ],
    next: 'next_node_id'  // Optional auto-continue
}
```

### `choice`
Single dialogue with user choices.

```javascript
{
    type: 'choice',
    dialogue: {
        speaker: 'npc',
        avatar: '/avatar.png',
        text: 'What will you do?'
    },
    choices: [
        {
            id: 'choice_a',
            text: 'OPTION A',
            target: 'node_a'
        },
        {
            id: 'choice_b',
            text: 'OPTION B',
            secondary: true,
            target: 'node_b'
        }
    ],
    rotatingText: ['OPTION B', 'OR THIS', 'OR THAT']  // Optional
}
```

### `redirect`
Immediately redirects to another node (useful for routing).

```javascript
{
    type: 'redirect',
    target: 'destination_node'
    // Or conditional:
    // target: (tree) => tree.hasFlag('logged_in') ? 'logged_in_node' : 'guest_node'
}
```

## Conditional Logic

### Condition Objects

```javascript
// Simple flag check
condition: 'user_logged_in'

// Variable comparison
condition: {
    variable: 'user_level',
    greaterThan: 5
}

// Logical operators
condition: {
    and: [
        { flag: 'completed_intro' },
        { variable: 'score', greaterThan: 10 }
    ]
}

condition: {
    or: [
        { flag: 'admin' },
        { flag: 'moderator' }
    ]
}

condition: {
    not: { flag: 'banned' }
}

// Function condition
condition: (tree) => {
    return tree.getVariable('points') > 100;
}
```

### Available Operators

- `equals` - Variable equals value
- `notEquals` - Variable not equals value
- `greaterThan` - Variable > value
- `lessThan` - Variable < value
- `contains` - String contains substring
- `flag` - Flag is set
- `visited` - Node has been visited
- `and` - All conditions true
- `or` - Any condition true
- `not` - Negate condition

## Variables and State

### Setting Variables

```javascript
// In choice callback
{
    text: 'SELECT THIS',
    setVariables: {
        choice_made: 'option_a',
        timestamp: Date.now()
    },
    target: 'next_node'
}

// Programmatically
tree.setVariable('player_name', 'Alice');
tree.setFlag('tutorial_complete');
```

### Using Variables

```javascript
// In dialogue text (variable interpolation)
dialogue: {
    text: 'Hello, {{player_name}}!'
}

// In conditions
condition: {
    variable: 'player_level',
    greaterThan: 5
}

// In dynamic content
dialogue: (tree, context) => {
    const name = tree.getVariable('player_name') || 'stranger';
    return {
        speaker: 'npc',
        text: `Welcome back, ${name}!`
    };
}
```

## Context Providers

Context providers fetch dynamic data before displaying a node.

```javascript
contextProviders: {
    // User session data
    async userSession(tree) {
        const session = window.oauthManager?.getSession();
        return {
            isLoggedIn: !!session,
            userName: session?.displayName || 'guest'
        };
    },
    
    // Database query
    async playerStats(tree) {
        const response = await fetch('/api/player/stats');
        const data = await response.json();
        return {
            level: data.level,
            score: data.score
        };
    }
}

// Use in node
{
    type: 'choice',
    contextProviders: ['userSession', 'playerStats'],
    dialogue: {
        text: 'Level {{level}} - Score: {{score}}'
    }
}
```

## Dynamic Content

### Dynamic Text

```javascript
dialogue: {
    speaker: 'npc',
    text: (tree, context) => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning!';
        if (hour < 18) return 'Good afternoon!';
        return 'Good evening!';
    }
}
```

### Conditional Variants

```javascript
dialogue: {
    speaker: 'npc',
    text: 'Default greeting',
    variants: [
        {
            condition: { flag: 'vip' },
            text: 'Welcome back, VIP!'
        },
        {
            condition: { variable: 'visits', greaterThan: 10 },
            text: 'Nice to see a regular!'
        }
    ]
}
```

## Choice Options

### Basic Choice

```javascript
{
    id: 'unique_id',           // Optional identifier
    text: 'BUTTON TEXT',        // Display text
    target: 'next_node',        // Target node ID
    secondary: false,           // Visual styling
    rotating: false,            // Enable text rotation
    fastRotate: false           // Faster rotation
}
```

### Conditional Choice

```javascript
{
    text: 'ADMIN PANEL',
    condition: { flag: 'is_admin' },
    target: 'admin_node'
}
```

### Choice with Callback

```javascript
{
    text: 'OPEN MODAL',
    onSelect: async (tree) => {
        // Custom logic
        const result = await showModal();
        tree.setVariable('modal_result', result);
    },
    target: 'next_node'
}
```

### Choice with Variable Setting

```javascript
{
    text: 'ACCEPT QUEST',
    setVariables: {
        quest_active: true,
        quest_id: 'quest_001'
    },
    setFlags: ['quest_started'],
    target: 'quest_node'
}
```

### Conditional Targets

```javascript
{
    text: 'PROCEED',
    targets: [
        {
            condition: { flag: 'advanced_mode' },
            target: 'advanced_path'
        },
        {
            condition: { flag: 'beginner' },
            target: 'tutorial_path'
        }
    ],
    fallback: 'default_path'
}
```

## Event Hooks

```javascript
const tree = new ConversationTree({
    dialogueWidget: widget,
    
    // Node navigation
    onNodeEnter: async (nodeId, previousNodeId) => {
        console.log(`Entered node: ${nodeId}`);
    },
    
    onNodeExit: async (currentNodeId, nextNodeId) => {
        console.log(`Exiting node: ${currentNodeId}`);
    },
    
    // User actions
    onChoiceMade: async (choice, nodeId) => {
        console.log(`Choice: ${choice.text}`);
    },
    
    // State changes
    onVariableChanged: (name, newValue, oldValue) => {
        console.log(`${name}: ${oldValue} -> ${newValue}`);
    },
    
    // Completion
    onTreeComplete: (tree) => {
        console.log('Conversation complete');
    },
    
    onTreeCancelled: (tree) => {
        console.log('Conversation cancelled');
    }
});
```

## Save/Load State

```javascript
// Save to localStorage
tree.saveToStorage('my_conversation_state');

// Load from localStorage
tree.loadFromStorage('my_conversation_state');

// Manual save/load
const state = tree.saveState();
localStorage.setItem('state', JSON.stringify(state));

const savedState = JSON.parse(localStorage.getItem('state'));
tree.loadState(savedState);

// State includes:
// - Current node ID
// - Variables
// - Flags
// - History
// - Choice history
```

## Integration with Existing Widgets

### BlueskyPoster Example

```javascript
{
    type: 'choice',
    onEnter: async (tree) => {
        const poster = new window.BlueskyPoster();
        
        poster.promptAndPost(threadUri, {
            promptText: "Share your thoughts",
            onSuccess: async (text, result) => {
                tree.setVariable('posted_text', text);
                await tree.gotoNode('post_success');
            },
            onCancel: async () => {
                await tree.gotoNode('post_cancelled');
            }
        });
    },
    dialogue: {
        text: 'Share with the community...'
    },
    choices: []  // Handled by widget
}
```

### Directory Example

```javascript
{
    type: 'choice',
    onEnter: async (tree) => {
        const directory = new window.Directory();
        
        directory.show({
            onSelect: (destination) => {
                tree.end();
                window.location.href = destination;
            },
            onClose: () => {
                tree.end();
            }
        });
    },
    dialogue: {
        text: 'Opening directory...'
    },
    choices: []
}
```

## Best Practices

### 1. Modular Design

Break complex conversations into reusable subtrees:

```javascript
// Shared nodes across multiple trees
const CommonNodes = {
    farewell: {
        type: 'choice',
        dialogue: {
            text: 'Goodbye!'
        },
        choices: [
            {
                text: 'FAREWELL',
                onSelect: (tree) => tree.end()
            }
        ]
    }
};

// Include in multiple trees
Object.assign(MyTree.nodes, CommonNodes);
```

### 2. Clear Node IDs

Use descriptive, hierarchical node IDs:

```javascript
// Good
'intro_welcome'
'quest_start_dragon'
'shop_buy_weapon'

// Avoid
'node1'
'temp'
'a'
```

### 3. Context Over Variables

Use context providers for external data:

```javascript
// Good - fresh data
contextProviders: {
    async stats(tree) {
        return await fetchStats();
    }
}

// Avoid - stale data
onEnter: async (tree) => {
    const stats = await fetchStats();
    tree.setVariable('stats', stats);
}
```

### 4. Meaningful Flags

Use flags for important state milestones:

```javascript
setFlags: [
    'tutorial_completed',
    'first_quest_accepted',
    'met_vendor_alice'
]
```

### 5. Graceful Fallbacks

Always provide fallback options:

```javascript
{
    targets: [
        { condition: { flag: 'path_a' }, target: 'node_a' },
        { condition: { flag: 'path_b' }, target: 'node_b' }
    ],
    fallback: 'default_node'  // Important!
}
```

## Migration Guide

### From Hardcoded to Tree-Based

**Before (hardcoded):**

```javascript
handleYesResponse() {
    const dialogue = [
        { speaker: 'npc', text: 'Great!' },
        { speaker: 'npc', text: 'Let me help you.' }
    ];
    
    this.dialogueWidget.start(dialogue);
}

handleNoResponse() {
    const dialogue = [
        { speaker: 'npc', text: 'No problem.' }
    ];
    
    this.dialogueWidget.start(dialogue);
}
```

**After (tree-based):**

```javascript
{
    initial_question: {
        type: 'choice',
        dialogue: {
            speaker: 'npc',
            text: 'Can I help you?'
        },
        choices: [
            {
                text: 'YES',
                target: 'yes_path'
            },
            {
                text: 'NO',
                target: 'no_path'
            }
        ]
    },
    
    yes_path: {
        type: 'sequence',
        dialogue: [
            { speaker: 'npc', text: 'Great!' },
            { speaker: 'npc', text: 'Let me help you.' }
        ],
        next: 'help_menu'
    },
    
    no_path: {
        type: 'sequence',
        dialogue: [
            { speaker: 'npc', text: 'No problem.' }
        ],
        next: 'farewell'
    }
}
```

## Advanced Examples

### Multi-path Quest System

```javascript
{
    quest_start: {
        type: 'choice',
        contextProviders: ['playerStats'],
        dialogue: {
            text: 'A dragon threatens the village!'
        },
        choices: [
            {
                text: 'FIGHT',
                condition: { variable: 'combat_level', greaterThan: 10 },
                target: 'combat_path'
            },
            {
                text: 'NEGOTIATE',
                condition: { variable: 'charisma', greaterThan: 15 },
                target: 'diplomacy_path'
            },
            {
                text: 'RUN AWAY',
                secondary: true,
                target: 'coward_path'
            }
        ]
    }
}
```

### Dynamic NPC Relationship

```javascript
contextProviders: {
    async npcRelationship(tree) {
        const visits = tree.getVariable('npc_visits') || 0;
        const helpedBefore = tree.hasFlag('helped_npc');
        
        return {
            relationshipLevel: helpedBefore ? 'friend' : visits > 5 ? 'acquaintance' : 'stranger'
        };
    }
}

// Use in dialogue
{
    dialogue: {
        text: (tree, context) => {
            switch (context.relationshipLevel) {
                case 'friend': return 'Welcome back, friend!';
                case 'acquaintance': return 'Oh, hello again.';
                default: return 'Who are you?';
            }
        }
    }
}
```

### Tutorial System

```javascript
{
    tutorial_check: {
        type: 'redirect',
        target: (tree) => {
            return tree.hasFlag('tutorial_complete') 
                ? 'main_menu' 
                : 'tutorial_start';
        }
    },
    
    tutorial_start: {
        type: 'sequence',
        dialogue: [
            { text: 'Welcome to the tutorial!' },
            { text: 'Let me show you around...' }
        ],
        next: 'tutorial_controls'
    },
    
    tutorial_controls: {
        type: 'choice',
        dialogue: {
            text: 'Try moving around. Ready?'
        },
        choices: [
            {
                text: 'READY',
                setFlags: ['tutorial_complete'],
                target: 'main_menu'
            }
        ]
    }
}
```

## Troubleshooting

### Node not found
**Problem:** `❌ [ConversationTree] Node not found: xyz`

**Solution:** Ensure node ID is registered:
```javascript
conversationTree.registerNode('xyz', { /* definition */ });
```

### Condition always fails
**Problem:** Choice never appears

**Solution:** Check condition logic:
```javascript
// Debug condition
console.log('Flag set?', tree.hasFlag('my_flag'));
console.log('Variable:', tree.getVariable('my_var'));
```

### Infinite loop
**Problem:** Conversation keeps returning to same node

**Solution:** Ensure targets are correct:
```javascript
// Avoid circular references without exit
{
    node_a: { target: 'node_b' },
    node_b: { target: 'node_a' }  // ❌ Infinite loop!
}
```

### Variables not updating
**Problem:** Changes don't persist

**Solution:** Use setVariable() or setVariables:
```javascript
// Correct
tree.setVariable('score', 100);

// Or in choice
{
    setVariables: { score: 100 }
}
```

## API Reference

See inline documentation in `js/core/conversation-tree.js` for complete API details.

### Key Methods

- `registerTree(name, definition)` - Register a tree
- `start(nodeId, initialVars)` - Start conversation
- `gotoNode(nodeId)` - Navigate to node
- `setVariable(name, value)` - Set variable
- `getVariable(name, default)` - Get variable
- `setFlag(name)` - Set flag
- `hasFlag(name)` - Check flag
- `hasVisited(nodeId)` - Check history
- `end()` - End conversation
- `saveState()` / `loadState(state)` - Serialize state

## Contributing

When extending the system:

1. Keep node definitions declarative
2. Use context providers for async operations
3. Document custom condition types
4. Test with edge cases (missing data, network errors)
5. Follow naming conventions

## Examples

See `js/conversations/homepage-welcome.js` for a complete, production-ready example migrating the homepage dialogue system.
