const fs = require('fs');
const path = require('path');

const PAYOUTS_FILE = path.resolve(__dirname, '../data/payouts.json');

/**
 * Loads the payout data from the JSON file.
 * @returns {Object} The payout data object.
 */
function loadPayouts() {
    try {
        if (!fs.existsSync(PAYOUTS_FILE)) {
            fs.writeFileSync(PAYOUTS_FILE, '{}');
            return {};
        }
        const data = fs.readFileSync(PAYOUTS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading payouts data:', error);
        return {};
    }
}

/**
 * Saves the payout data to the JSON file.
 * @param {Object} data - The payout data object to save.
 */
function savePayouts(data) {
    try {
        fs.writeFileSync(PAYOUTS_FILE, JSON.stringify(data, null, 4));
    } catch (error) {
        console.error('Error saving payouts data:', error);
    }
}

module.exports = { loadPayouts, savePayouts };
