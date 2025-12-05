/**
 * Simple Conversation Tree Example
 * 
 * This is a minimal example showing how to create and use a conversation tree.
 */

// Define a simple greeting conversation
const SimpleGreetingTree = {
    name: 'simple_greeting',
    rootNode: 'start',
    
    nodes: {
        // Starting node
        start: {
            type: 'choice',
            dialogue: {
                speaker: 'Guide',
                avatar: '/souvenirs/dream/strange/icon.png',
                text: 'Hello! How are you today?'
            },
            choices: [
                {
                    id: 'good',
                    text: 'GOOD!',
                    setVariables: { mood: 'positive' },
                    target: 'response_good'
                },
                {
                    id: 'bad',
                    text: 'NOT GREAT',
                    secondary: true,
                    setVariables: { mood: 'negative' },
                    target: 'response_bad'
                }
            ]
        },
        
        // Positive response path
        response_good: {
            type: 'sequence',
            dialogue: [
                {
                    speaker: 'Guide',
                    avatar: '/souvenirs/dream/strange/icon.png',
                    text: "That's wonderful to hear!"
                },
                {
                    speaker: 'Guide',
                    avatar: '/souvenirs/dream/strange/icon.png',
                    text: 'Would you like to explore?'
                }
            ],
            next: 'offer_explore'
        },
        
        // Negative response path
        response_bad: {
            type: 'sequence',
            dialogue: [
                {
                    speaker: 'Guide',
                    avatar: '/souvenirs/dream/strange/icon.png',
                    text: "I'm sorry to hear that."
                },
                {
                    speaker: 'Guide',
                    avatar: '/souvenirs/dream/strange/icon.png',
                    text: 'Maybe this place can help lift your spirits?'
                }
            ],
            next: 'offer_explore'
        },
        
        // Common continue point
        offer_explore: {
            type: 'choice',
            dialogue: {
                speaker: 'Guide',
                avatar: '/souvenirs/dream/strange/icon.png',
                text: 'What would you like to do?'
            },
            choices: [
                {
                    text: 'EXPLORE',
                    target: 'farewell'
                },
                {
                    text: 'STAY HERE',
                    secondary: true,
                    onSelect: async (tree) => {
                        // Just end the conversation
                        tree.end();
                    },
                    target: null
                }
            ]
        },
        
        // Farewell
        farewell: {
            type: 'choice',
            dialogue: {
                speaker: 'Guide',
                avatar: '/souvenirs/dream/strange/icon.png',
                text: 'Enjoy your journey!'
            },
            choices: [
                {
                    text: 'THANKS!',
                    onSelect: async (tree) => {
                        tree.end();
                    },
                    target: null
                }
            ]
        }
    }
};

// How to use:
// 
// 1. Include the ConversationTree script:
//    <script src="/js/core/conversation-tree.js"></script>
//
// 2. Include the Dialogue widget:
//    <script src="/js/widgets/dialogue.js"></script>
//
// 3. Initialize and start:
//    
//    const dialogue = new Dialogue({
//        typewriterSpeed: 30,
//        onComplete: () => console.log('Done!')
//    });
//    dialogue.init();
//    
//    const tree = new ConversationTree({
//        dialogueWidget: dialogue
//    });
//    
//    tree.registerTree('greeting', SimpleGreetingTree);
//    tree.start();

// Export for use
window.SimpleGreetingTree = SimpleGreetingTree;

console.log('✅ [simple-example.js] Simple greeting tree loaded');
