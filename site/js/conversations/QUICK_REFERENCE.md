# ConversationTree Quick Reference

## Node Types

```javascript
// Sequence - Multiple messages
{
    type: 'sequence',
    dialogue: [
        { speaker: 'npc', avatar: '/a.png', text: 'First' },
        { speaker: 'npc', avatar: '/a.png', text: 'Second' }
    ],
    next: 'next_node'
}

// Choice - User selects option
{
    type: 'choice',
    dialogue: { speaker: 'npc', avatar: '/a.png', text: 'Choose?' },
    choices: [
        { text: 'OPTION A', target: 'node_a' },
        { text: 'OPTION B', secondary: true, target: 'node_b' }
    ],
    rotatingText: ['OPTION B', 'OR THIS']
}

// Redirect - Immediate jump
{
    type: 'redirect',
    target: 'destination'
    // Or: target: (tree) => tree.hasFlag('x') ? 'a' : 'b'
}
```

## Conditions

```javascript
// Simple
condition: 'flag_name'
condition: (tree) => tree.getVariable('x') > 5

// Comparisons
condition: { variable: 'level', greaterThan: 10 }
condition: { variable: 'name', equals: 'Alice' }
condition: { variable: 'status', notEquals: 'banned' }
condition: { variable: 'message', contains: 'hello' }

// Flags & History
condition: { flag: 'tutorial_complete' }
condition: { visited: 'intro_node' }

// Logical
condition: { and: [{ flag: 'a' }, { flag: 'b' }] }
condition: { or: [{ flag: 'admin' }, { flag: 'mod' }] }
condition: { not: { flag: 'banned' } }
```

## Variables

```javascript
// Set in choice
{
    text: 'PICK ME',
    setVariables: { choice: 'a', score: 100 },
    setFlags: ['chose_a'],
    target: 'next'
}

// Set in code
tree.setVariable('name', 'Alice');
tree.setFlag('tutorial_done');

// Get
const name = tree.getVariable('name', 'default');
const hasDone = tree.hasFlag('tutorial_done');

// Use in text
dialogue: { text: 'Hello, {{name}}!' }
```

## Context Providers

```javascript
contextProviders: {
    async userData(tree) {
        const session = window.oauthManager?.getSession();
        return {
            userName: session?.displayName || 'guest',
            isLoggedIn: !!session
        };
    }
}

// Use in node
{
    type: 'choice',
    contextProviders: ['userData'],
    dialogue: { text: 'Hello, {{userName}}!' }
}
```

## Dynamic Content

```javascript
// Function dialogue
dialogue: (tree, context) => {
    const hour = new Date().getHours();
    return {
        speaker: 'npc',
        text: hour < 12 ? 'Good morning!' : 'Good evening!'
    };
}

// Variants
dialogue: {
    text: 'Default',
    variants: [
        { condition: { flag: 'vip' }, text: 'VIP greeting!' },
        { condition: { variable: 'level', greaterThan: 10 }, text: 'High level!' }
    ]
}
```

## Choice Options

```javascript
{
    id: 'unique_id',              // Optional
    text: 'BUTTON TEXT',           // Required
    target: 'next_node',           // Node to go to
    secondary: true,               // Visual style
    rotating: true,                // Text rotation
    fastRotate: true,              // Faster rotation
    condition: { flag: 'x' },      // Show if true
    
    // Callbacks
    onSelect: async (tree) => {
        // Custom logic
        await doSomething();
    },
    
    // State changes
    setVariables: { x: 1, y: 2 },
    setFlags: ['flag_a', 'flag_b'],
    
    // Conditional targets
    targets: [
        { condition: { flag: 'a' }, target: 'node_a' },
        { condition: { flag: 'b' }, target: 'node_b' }
    ],
    fallback: 'default_node'
}
```

## Event Hooks

```javascript
new ConversationTree({
    dialogueWidget: widget,
    
    onNodeEnter: async (nodeId, prevNodeId) => {
        console.log(`Entered: ${nodeId}`);
    },
    
    onNodeExit: async (currentId, nextId) => {
        console.log(`Exiting: ${currentId}`);
    },
    
    onChoiceMade: async (choice, nodeId) => {
        console.log(`Choice: ${choice.text}`);
    },
    
    onVariableChanged: (name, newVal, oldVal) => {
        console.log(`${name}: ${oldVal} → ${newVal}`);
    },
    
    onTreeComplete: (tree) => {
        console.log('Done!');
    },
    
    onTreeCancelled: (tree) => {
        console.log('Cancelled!');
    }
});
```

## Common Patterns

### Route by login status
```javascript
{
    type: 'redirect',
    contextProviders: ['userSession'],
    target: (tree) => {
        return tree.getVariable('isLoggedIn') ? 'logged_in' : 'guest';
    }
}
```

### Widget integration
```javascript
{
    onEnter: async (tree) => {
        const widget = new Widget();
        widget.show({
            onSuccess: async (data) => {
                tree.setVariable('result', data);
                await tree.gotoNode('success');
            },
            onCancel: async () => {
                await tree.gotoNode('cancelled');
            }
        });
    },
    dialogue: { text: 'Opening widget...' },
    choices: []
}
```

### Central hub pattern
```javascript
central_hub: {
    type: 'choice',
    dialogue: { text: 'What would you like to do?' },
    choices: [
        { text: 'OPTION A', target: 'feature_a' },
        { text: 'OPTION B', target: 'feature_b' },
        { text: 'LEAVE', onSelect: (t) => t.end() }
    ]
}

// All feature paths return to hub
feature_a: {
    // ... feature flow ...
    next: 'central_hub'  // Return to hub
}
```

### Conditional paths
```javascript
{
    text: 'PROCEED',
    targets: [
        { condition: { flag: 'expert' }, target: 'expert_path' },
        { condition: { flag: 'beginner' }, target: 'tutorial' }
    ],
    fallback: 'normal_path'
}
```

## API Quick Reference

```javascript
// Tree management
tree.registerTree(name, definition)
tree.start(nodeId?, initialVars?)
tree.gotoNode(nodeId)
tree.end()
tree.cancel()

// State
tree.setVariable(name, value)
tree.getVariable(name, default?)
tree.hasVariable(name)
tree.setFlag(name)
tree.unsetFlag(name)
tree.hasFlag(name)

// History
tree.hasVisited(nodeId)
tree.getPreviousNode()
tree.goBack()  // if allowBacktrack enabled

// Persistence
tree.saveState()
tree.loadState(state)
tree.saveToStorage(key)
tree.loadFromStorage(key)

// Context
tree.registerContextProvider(name, asyncFn)
```

## Debugging

```javascript
// In browser console
const tree = window.homepageScene?.conversationTree;

// Inspect state
console.log('Current node:', tree.currentNodeId);
console.log('Variables:', Object.fromEntries(tree.variables));
console.log('Flags:', Array.from(tree.flags));
console.log('History:', tree.history);

// Navigate manually
tree.gotoNode('node_id');

// Test conditions
console.log('Flag?', tree.hasFlag('my_flag'));
console.log('Var?', tree.getVariable('my_var'));

// Check nodes
console.log('Nodes:', Array.from(tree.nodes.keys()));
```

## File Structure

```
js/
├── core/
│   └── conversation-tree.js         # Core manager
├── conversations/
│   ├── README.md                    # Full docs
│   ├── INTEGRATION.md               # How to integrate
│   ├── QUICK_REFERENCE.md           # This file
│   ├── simple-example.js            # Minimal example
│   └── homepage-welcome.js          # Full example
└── widgets/
    ├── dialogue.js                  # Display component
    └── homepage.js                  # Uses the tree
```

## Loading Order

```html
<!-- 1. Dialogue widget -->
<script src="/js/widgets/dialogue.js"></script>

<!-- 2. ConversationTree core -->
<script src="/js/core/conversation-tree.js"></script>

<!-- 3. Tree definitions -->
<script src="/js/conversations/homepage-welcome.js"></script>

<!-- 4. Your code that uses it -->
<script src="/js/widgets/homepage.js"></script>
```

## Minimal Working Example

```javascript
// Define tree
const MyTree = {
    name: 'example',
    rootNode: 'start',
    nodes: {
        start: {
            type: 'choice',
            dialogue: {
                speaker: 'Guide',
                avatar: '/icon.png',
                text: 'Hello! Ready?'
            },
            choices: [
                { text: 'YES', target: 'yes_path' },
                { text: 'NO', onSelect: (t) => t.end() }
            ]
        },
        yes_path: {
            type: 'choice',
            dialogue: { speaker: 'Guide', text: 'Great!' },
            choices: [
                { text: 'DONE', onSelect: (t) => t.end() }
            ]
        }
    }
};

// Initialize
const dialogue = new Dialogue();
dialogue.init();

const tree = new ConversationTree({ dialogueWidget: dialogue });
tree.registerTree('example', MyTree);
tree.start();
```

---

**See full documentation in `/js/conversations/README.md`**
