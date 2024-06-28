const fs = require('fs');
const path = require('path');

async function printToFile(txtToWrite, dir, outputFilename) {
    const outputFilePath = path.join(dir, outputFilename);
    const outputStream = fs.createWriteStream(outputFilePath);

    try {
        await new Promise((resolve, reject) => {
            outputStream.write(txtToWrite, 'utf-8', (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
            outputStream.end();
        });
        outputStream.close();

        return {
            confirmationFilePrinted: true,
            confirmationFilepath: outputFilePath
        };
    } catch (error) {
        console.error('Error writing to file:', error);
        throw error; // Rethrow the error for higher-level handling
    }
}

module.exports = printToFile;