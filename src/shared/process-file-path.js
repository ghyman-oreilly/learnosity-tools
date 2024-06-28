async function getDirFromFilepath(filepath) {
  try {
    if (filepath) {
      const dir = filepath.substring(0, filepath.lastIndexOf('/'));

      return dir
    } else {
      throw new Error('Invalid filepath');
    }
  } catch (error) {
    console.error('Error processing filepath:', error);
    throw error;
  }
}

module.exports = getDirFromFilepath;