/**
 * Number to word conversion utilities for Reverie House
 * Converts numerical values to their word equivalents for more natural display
 * JavaScript port of utils/num_nom.py
 */

const NUM_WORDS = {
    0: "zero", 1: "one", 2: "two", 3: "three", 4: "four", 5: "five",
    6: "six", 7: "seven", 8: "eight", 9: "nine", 10: "ten",
    11: "eleven", 12: "twelve", 13: "thirteen", 14: "fourteen", 15: "fifteen",
    16: "sixteen", 17: "seventeen", 18: "eighteen", 19: "nineteen", 20: "twenty",
    30: "thirty", 40: "forty", 50: "fifty", 60: "sixty", 70: "seventy",
    80: "eighty", 90: "ninety"
};

/**
 * Convert a number to its word equivalent
 * @param {number} num - The number to convert
 * @returns {string} - Word representation
 */
function numberToWord(num) {
    if (!Number.isInteger(num) || num < 0) return String(num);
    
    if (num in NUM_WORDS) {
        return NUM_WORDS[num];
    } else if (num < 100) {
        const tens = Math.floor(num / 10) * 10;
        const ones = num % 10;
        return `${NUM_WORDS[tens]}-${NUM_WORDS[ones]}`;
    } else if (num < 1000) {
        const hundreds = Math.floor(num / 100);
        const remainder = num % 100;
        if (remainder === 0) {
            return `${NUM_WORDS[hundreds]} hundred`;
        } else {
            return `${NUM_WORDS[hundreds]} hundred ${numberToWord(remainder)}`;
        }
    } else {
        return String(num);
    }
}

/**
 * Format time difference in natural language (num_nom style)
 * @param {Date|number|string} dateInput - Date, timestamp, or ISO string
 * @returns {string} - "arrived {num_nom description}"
 */
function formatArrivalTime(dateInput) {
    if (!dateInput) return 'arrival unknown';
    
    // Handle both Unix timestamps (seconds or milliseconds) and ISO date strings
    let date;
    if (typeof dateInput === 'number') {
        // Unix timestamp (seconds or milliseconds)
        date = new Date(dateInput > 10000000000 ? dateInput : dateInput * 1000);
    } else if (dateInput instanceof Date) {
        date = dateInput;
    } else {
        date = new Date(dateInput);
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) return 'arrival unknown';
    
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
        return 'arrived in the future'; // Time paradox!
    } else if (diffDays === 0) {
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        if (diffHours === 0) {
            const diffMinutes = Math.floor(diffMs / (1000 * 60));
            if (diffMinutes === 0) {
                return 'arrived just now';
            } else if (diffMinutes === 1) {
                return 'arrived one minute ago';
            } else {
                return `arrived ${numberToWord(diffMinutes)} minutes ago`;
            }
        } else if (diffHours === 1) {
            return 'arrived one hour ago';
        } else {
            return `arrived ${numberToWord(diffHours)} hours ago`;
        }
    } else if (diffDays === 1) {
        return 'arrived yesterday';
    } else if (diffDays < 7) {
        return `arrived ${numberToWord(diffDays)} days ago`;
    } else if (diffDays < 14) {
        return 'arrived one week ago';
    } else if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `arrived ${numberToWord(weeks)} weeks ago`;
    } else if (diffDays < 60) {
        return 'arrived one month ago';
    } else if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return `arrived ${numberToWord(months)} months ago`;
    } else if (diffDays < 730) {
        return 'arrived one year ago';
    } else {
        const years = Math.floor(diffDays / 365);
        return `arrived ${numberToWord(years)} years ago`;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        numberToWord,
        formatArrivalTime
    };
}

// Also expose on window for browser usage
if (typeof window !== 'undefined') {
    window.NumNom = {
        numberToWord,
        formatArrivalTime
    };
}
