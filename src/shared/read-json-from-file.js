const fs = require('fs');

async function readJSONFromFile(filepath) {
    try {
        if (!filepath) {
            throw new Error('Invalid filepath');
        }

        const src = filepath;
        const contents = fs.readFileSync(src, 'utf-8');

        // Attempt to parse contents as JSON
        try {
            const jsonData = JSON.parse(contents);
            return jsonData;
        } catch (jsonError) {
            throw new Error('Invalid JSON format in file');
        }
    } catch (error) {
        console.error('Error reading JSON from file:', error);
        throw error;
    }
}

module.exports = readJSONFromFile;