/**
 * Count Newcomers Utility
 * 
 * Returns the number of newcomers (dreamers) who joined today.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

/**
 * Count dreamers who arrived today
 * @returns {Promise<number>} Number of newcomers today
 */
async function countNewcomersToday() {
    return new Promise((resolve, reject) => {
        const dbPath = path.join(__dirname, '..', 'data', 'reverie.db');
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                console.error('Error opening database:', err);
                reject(err);
                return;
            }
        });

        // Get start of today in epoch time (Unix timestamp)
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEpoch = Math.floor(startOfToday.getTime() / 1000);

        // Count dreamers whose arrival is >= today's epoch
        const query = `SELECT COUNT(*) as count FROM dreamers WHERE arrival >= ?`;
        
        db.get(query, [todayEpoch], (err, row) => {
            db.close();
            
            if (err) {
                console.error('Error counting newcomers:', err);
                reject(err);
                return;
            }
            
            resolve(row ? row.count : 0);
        });
    });
}

// If run directly (not imported)
if (require.main === module) {
    countNewcomersToday()
        .then(count => {
            console.log(`Newcomers today: ${count}`);
            process.exit(0);
        })
        .catch(err => {
            console.error('Error:', err);
            process.exit(1);
        });
}

module.exports = { countNewcomersToday };
