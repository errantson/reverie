# Integration Guide: Using ConversationTree in Homepage

This guide shows how to integrate the new ConversationTree system into homepage.js.

## Current State

Homepage.js currently uses hardcoded methods like:
- `handleYesResponse()`
- `handleUnsureResponse()`
- `startNewUserDialogue()`
- `startReturningUserDialogue()`

These methods directly create dialogue arrays and call `this.dialogueWidget.start()`.

## Migration Steps

### Option 1: Full Migration (Recommended for new features)

Replace hardcoded dialogue methods with the tree system.

**Step 1: Load the scripts**

Add to your HTML (index.html):

```html
<!-- Load ConversationTree system -->
<script src="/js/core/conversation-tree.js"></script>
<script src="/js/conversations/homepage-welcome.js"></script>
```

**Step 2: Initialize in HomepageScene**

In `homepage.js` constructor:

```javascript
class HomepageScene {
    constructor() {
        // ... existing code ...
        
        // Initialize conversation tree
        this.conversationTree = null;
        
        // ... existing code ...
    }
}
```

**Step 3: Replace startDialogueExperience**

```javascript
startDialogueExperience() {
    // Don't start if already started
    if (this.experienceStarted) return;
    
    this.experienceStarted = true;
    
    // Initialize dialogue widget if not already done
    if (!this.dialogueWidget && window.Dialogue) {
        this.dialogueWidget = new window.Dialogue({
            typewriterSpeed: 40,
            onComplete: () => {
                console.log('Dialogue completed');
            }
        });
        this.dialogueWidget.init();
    }
    
    if (!this.dialogueWidget) {
        console.warn('Dialogue widget not available');
        return;
    }
    
    // Initialize conversation tree
    if (!this.conversationTree && window.ConversationTree) {
        this.conversationTree = new window.ConversationTree({
            dialogueWidget: this.dialogueWidget,
            onTreeComplete: () => {
                console.log('✅ Conversation tree completed');
            },
            onTreeCancelled: () => {
                console.log('⏭️ Conversation tree cancelled');
            }
        });
        
        // Register the homepage welcome tree
        if (window.HomepageWelcomeTree) {
            this.conversationTree.registerTree('welcome', window.HomepageWelcomeTree);
        }
    }
    
    if (!this.conversationTree) {
        console.warn('ConversationTree not available');
        return;
    }
    
    // Start the conversation
    this.conversationTree.start();
}
```

**Step 4: Remove old methods** (optional)

Once the tree is working, you can remove:
- `startNewUserDialogue()`
- `startReturningUserDialogue()`
- `handleYesResponse()`
- `handleUnsureResponse()`
- All other `handle*` methods

Keep these methods for now:
- Widget initialization methods (for BlueskyPoster, Directory, ShareLore, etc.)
- The tree nodes will call them via `window.homepageScene.*`

### Option 2: Gradual Migration (Safer)

Keep existing code and add tree support alongside.

**Step 1: Add tree as alternative path**

```javascript
startDialogueExperience() {
    // Check if tree system is available
    const useTreeSystem = window.ConversationTree && window.HomepageWelcomeTree;
    
    if (useTreeSystem) {
        // Use new tree system
        this.startTreeBasedDialogue();
    } else {
        // Fall back to existing system
        this.startLegacyDialogue();
    }
}

startTreeBasedDialogue() {
    // Initialize tree (as shown in Option 1)
    if (!this.conversationTree) {
        this.conversationTree = new window.ConversationTree({
            dialogueWidget: this.dialogueWidget
        });
        this.conversationTree.registerTree('welcome', window.HomepageWelcomeTree);
    }
    this.conversationTree.start();
}

startLegacyDialogue() {
    // Existing code
    const session = window.oauthManager?.getSession();
    if (session) {
        this.startReturningUserDialogue(session);
    } else {
        this.startNewUserDialogue();
    }
}
```

## Testing

### Test Scenario 1: New User Flow

1. Clear cookies/localStorage
2. Visit homepage
3. Click background or wait for dialogue
4. Choose "I DON'T KNOW"
5. Choose "MY NAME?"
6. Post name in modal
7. Verify "Ah, [name]. I'll remember that."

### Test Scenario 2: Returning User Flow

1. Log in with existing account
2. Visit homepage
3. Verify personalized greeting
4. Test "SHARE STORY" → ShareLore modal
5. Test "I DON'T KNOW" → central spine

### Test Scenario 3: Reality Question Path

1. Start dialogue
2. Choose "I DON'T KNOW"
3. Choose "I DON'T KNOW" (skip name)
4. Choose "ARE YOU REAL?"
5. Navigate through philosophical exchange
6. Choose "YES, PLEASE" for account
7. Create account

## Debugging

### Enable verbose logging

In browser console:

```javascript
// Check if tree is loaded
console.log('Tree available:', !!window.ConversationTree);
console.log('Definition available:', !!window.HomepageWelcomeTree);

// Access tree instance
const tree = window.homepageScene?.conversationTree;
console.log('Current node:', tree?.currentNodeId);
console.log('Variables:', Object.fromEntries(tree?.variables || []));
console.log('Flags:', Array.from(tree?.flags || []));
console.log('History:', tree?.history);

// Manually navigate
tree?.gotoNode('central_spine');
```

### Common issues

**Issue: "Node not found"**
- Check node ID spelling in tree definition
- Ensure tree is registered before starting

**Issue: Context not loading**
- Check network tab for API errors
- Verify context provider is registered
- Check async/await in provider functions

**Issue: Choices not appearing**
- Check condition evaluation
- Verify target node exists
- Check browser console for errors

## Best Practices

### 1. Keep widget integration in HomepageScene

Don't move widget logic into tree nodes. Instead:

```javascript
// Good - HomepageScene method
showDirectoryWidget() {
    if (!this.directoryWidget) {
        this.directoryWidget = new window.Directory();
    }
    this.directoryWidget.show({
        onSelect: (dest) => {
            // Handle selection
        }
    });
}

// Tree node calls it
{
    onEnter: async (tree) => {
        window.homepageScene.showDirectoryWidget();
    }
}
```

### 2. Use context providers for state

Fetch fresh data in context providers:

```javascript
contextProviders: {
    async userInfo(tree) {
        const session = window.oauthManager?.getSession();
        return {
            userName: session?.displayName || 'dreamer',
            isLoggedIn: !!session
        };
    }
}
```

### 3. Handle widget callbacks properly

Listen for widget events in onEnter:

```javascript
{
    onEnter: async (tree) => {
        const widget = window.homepageScene.shareLoreWidget;
        widget.show();
        
        window.addEventListener('sharelore:success', async (e) => {
            tree.setVariable('story', e.detail);
            await tree.gotoNode('story_posted');
        }, { once: true });
        
        window.addEventListener('sharelore:cancel', async () => {
            await tree.gotoNode('central_spine');
        }, { once: true });
    }
}
```

### 4. Provide fallbacks

Always have a fallback node:

```javascript
{
    targets: [
        { condition: { flag: 'path_a' }, target: 'node_a' },
        { condition: { flag: 'path_b' }, target: 'node_b' }
    ],
    fallback: 'central_spine'  // Important!
}
```

## Performance Considerations

### Lazy load trees

Only load tree definitions when needed:

```javascript
async loadWelcomeTree() {
    if (!window.HomepageWelcomeTree) {
        await import('/js/conversations/homepage-welcome.js');
    }
    return window.HomepageWelcomeTree;
}
```

### Cache context

Don't re-fetch static data:

```javascript
contextProviders: {
    async dreamerData(tree) {
        // Check if already fetched
        if (tree.getVariable('dreamer_fetched')) {
            return {};
        }
        
        const data = await fetchDreamerData();
        tree.setFlag('dreamer_fetched');
        return data;
    }
}
```

### Limit history size

Configure history limits:

```javascript
new ConversationTree({
    dialogueWidget: widget,
    maxHistoryLength: 50  // Don't track too many nodes
});
```

## Rollback Plan

If issues arise, you can quickly rollback:

1. Remove tree script tags from HTML
2. Change `startDialogueExperience()` to call `startLegacyDialogue()`
3. Keep old methods intact until tree is proven stable

## Next Steps

1. Test thoroughly in development
2. Monitor console for errors
3. Gather user feedback
4. Iterate on tree design
5. Create additional trees for other features

## Support

For questions or issues:
- Check the README in `/js/conversations/`
- Review the example in `simple-example.js`
- Examine the full tree in `homepage-welcome.js`
- Check browser console for debugging info
