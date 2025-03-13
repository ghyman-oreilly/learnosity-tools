const assert = require('assert');
const fs = require('fs');
const { DOMParser, XMLSerializer } = require('xmldom');
const path = require('path');
const { convertDOCXtoHTML, processHTML } = require('@src/create-quizzes-from-docx');
const { sendAPIRequests, getPublicUrl, uploadFileToPresignedUrl, callDataAPI } = require('@src/shared/call-learnosity');


const [IMAGES_DOCX_PATH, IMAGES_HTML_PATH, IMAGES_JSON_PATH] = generateInputFilepaths('images');

beforeEach(() => {
  jest.resetModules();
});

jest.mock('@src/shared/call-learnosity', () => ({
  sendAPIRequests: jest.fn(),
  getPublicUrl: jest.fn(),
  uploadFileToPresignedUrl: jest.fn(),
  callDataAPI: jest.fn(),
}));

function generateInputFilepaths(descriptor, fileTypes = ['docx', 'html', 'json']) {
  /* Generate file paths dynamically based on fileTypes array
     The descriptor determines the base name for the file paths. 
     Example: 'simple' -> 'data/simple.docx', 'data/simple.html', 'data/simple.json' */
  
  return fileTypes.map(type => path.resolve(__dirname, 'data', `${descriptor}.${type}`));
}

function readFileContents(filePath) {
  const data = fs.readFileSync(filePath, 'utf8');
  return data
}

function serializeQuizzes(quizzes) {
	const serializedQuizzes = quizzes.map(quiz => quiz.toJSON());
	return serializedQuizzes
}

describe('processImageHtml', () => {
  it('should process image-containing HTML into the expected JSON', async () => {

    // Mocks, to avoid API calls
    sendAPIRequests.mockResolvedValue([
      {
        meta: {status: true},
        data: [
          {upload: 'https://www.example.com', public: 'https://www.example.com/image1.jpeg', content_type: 'image/jpeg'},
          {upload: 'https://www.example.com', public: 'https://www.example.com/image2.jpeg', content_type: 'image/jpeg'}
        ]
        }
      ]);
    uploadFileToPresignedUrl.mockResolvedValue({ok: true});
    getPublicUrl.mockResolvedValue({ok: true});
    callDataAPI.mockResolvedValue({meta: {records: 0}});

    // HTML input and expected JSON output
	  const input_html = readFileContents(IMAGES_HTML_PATH);
	  const expected_json = readFileContents(IMAGES_JSON_PATH);

    const quizzes = await processHTML(input_html, has_rationales = true, quiz_type = 'Standard');
    
    const serializedQuizzes = serializeQuizzes(quizzes);
	  const serializedQuizzesJSON = JSON.stringify(serializedQuizzes, null, 2);

    // Assert that the result from processHTML is as expected
    expect(serializedQuizzesJSON).toBe(expected_json);
  });
});