const fs = require('fs');

async function readReferenceIdsFromTxtFile(filepath) {
  try {
    
    if (filepath) {
        const src = filepath;

        const contents = fs.readFileSync(src).toString()
        const referenceIds = contents.split('\n')
          .map(id => id.trim())     // Trim whitespace from each ID
          .filter(id => id !== '')  // Remove any empty IDs

        return referenceIds
    } else {
        throw new Error('Invalid filepath');
    }
  } catch (error) {
    console.error('Error reading reference IDs from file:', error);
    throw error;
  }
}

module.exports = readReferenceIdsFromTxtFile;