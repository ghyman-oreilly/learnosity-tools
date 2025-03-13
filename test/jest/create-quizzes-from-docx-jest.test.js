const assert = require('assert');
const fs = require('fs');
const { DOMParser, XMLSerializer } = require('xmldom');
const path = require('path');
const { convertDOCXtoHTML, processHTML } = require('../src/create-quizzes-from-docx');
const { sendAPIRequests } = require('../src/shared/call-learnosity');


const [IMAGES_DOCX_PATH, IMAGES_HTML_PATH, IMAGES_JSON_PATH] = generateInputFilepaths('images');

// mock API calls to learnosity
jest.mock('../src/shared/call-learnosity', () => ({
  sendAPIRequests: jest.fn()
}));

function readFileContents(filePath) {
  const data = fs.readFileSync(filePath, 'utf8');
  return data
}

describe('processImageHtml', () => {
  it('should process image-containing HTML into the expected JSON', async () => {
    // Arrange: Mock the functions to avoid actual API calls

    // Mock sendAPIRequests to return mocked data
    sendAPIRequests.mockResolvedValue({ data: 'mocked data' });

    // Create a local mock for generateIDsOrKeys to return mock data
    const generateIDsOrKeysMock = jest.fn().mockResolvedValue(['mocked-id-1', 'mocked-id-2', 'mocked-id-3']);
    
    // Temporarily replace the generateIDsOrKeys function inside processHTML with the mock
    const rewire = require('rewire');
    const yourModule = rewire('../src/create-quizzes-from-docx');
    yourModule.__set__('generateIDsOrKeys', generateIDsOrKeysMock);

    // HTML input and expected JSON output
	const input_html = readFileContents(IMAGES_HTML_PATH);
	const expected_json = readFileContents(IMAGES_JSON_PATH);

    // Act: Call the processHTML function
    const result = await processHTML(htmlInput);

    // Assert that the result from processHTML is as expected
    expect(result).toBeDefined(); // or other assertions based on what processHTML returns
  });
});