const assert = require('assert');
const fs = require('fs');
const { DOMParser, XMLSerializer } = require('xmldom');
const path = require('path');
const { convertDOCXtoHTML, processHTML } = require('@src/create-quizzes-from-docx');
const { sendAPIRequests, getPublicUrl, uploadFileToPresignedUrl, callDataAPI } = require('@src/shared/call-learnosity');

const [SIMPLE_DOCX_PATH, SIMPLE_HTML_PATH, SIMPLE_JSON_PATH] = generateInputFilepaths('simple');
const [CODE_DOCX_PATH, CODE_HTML_PATH, CODE_JSON_PATH] = generateInputFilepaths('code');
const [MATH_DOCX_PATH, MATH_HTML_PATH, MATH_JSON_PATH] = generateInputFilepaths('math');
const [TABLES_DOCX_PATH, TABLES_HTML_PATH, TABLES_JSON_PATH] = generateInputFilepaths('tables');
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

function normalizeHTML(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');

    function normalizeNode(node) {
        if (node.nodeType === 3) {  // Text node
            node.nodeValue = node.nodeValue.replace(/\s+/g, ' ').trim();
        } else if (node.nodeType === 1) {  // Element node
            const isCodeLike = node.getAttribute('data-custom-style') === 'Code Block' ||
                               node.getAttribute('data-custom-style') === 'Inline Code';

            if (!isCodeLike) {
                // Normalize child nodes unless inside a code block
                Array.from(node.childNodes).forEach(normalizeNode);
            }
        }
    }

    normalizeNode(doc.documentElement);

    let serialized = new XMLSerializer().serializeToString(doc);

    // Ensure consistent indentation and spacing
    serialized = serialized.replace(/>\s+</g, '><');  // Remove unnecessary whitespace between tags
    serialized = serialized.replace(/\n+/g, '\n');     // Collapse multiple newlines into one
    return serialized.trim();
}

function serializeQuizzes(quizzes) {
	const serializedQuizzes = quizzes.map(quiz => quiz.toJSON());
	return serializedQuizzes
}

async function testConvertDocxToHtml(input_docx_path, expected_html_path) {
	/* Test that a quiz doc
	converts to expected HTML. */
	const expected_html = readFileContents(expected_html_path);
	html = await convertDOCXtoHTML(input_docx_path);
  expect(normalizeHTML(html)).toBe(normalizeHTML(expected_html));
}

async function testProcessHtml(input_html_path, expected_json_path, has_rationales = true, quiz_type = 'Standard') {
	/* Test that HTML from DOCX
	is processed to produce the expected
	quiz objects (represented as custom objects
	serialized to JSON). */
	const input_html = readFileContents(input_html_path);
	const expected_json = readFileContents(expected_json_path);
	const quizzes = await processHTML(input_html, has_rationales, quiz_type);
	const serializedQuizzes = serializeQuizzes(quizzes);
	const serializedQuizzesJSON = JSON.stringify(serializedQuizzes, null, 2);
  expect(serializedQuizzesJSON).toBe(expected_json);
}

describe('convertDOCXtoHTML', () => {
  it('should process simple DOCX into the expected HTML', async () => {
    await testConvertDocxToHtml(SIMPLE_DOCX_PATH, SIMPLE_HTML_PATH);
  });
  
  it('should process code-containing DOCX into the expected HTML', async () => {
    await testConvertDocxToHtml(CODE_DOCX_PATH, CODE_HTML_PATH);
  });

  it('should process math-containing DOCX into the expected HTML', async () => {
    await testConvertDocxToHtml(MATH_DOCX_PATH, MATH_HTML_PATH);
  });

  it('should process table-containing DOCX into the expected HTML', async () => {
    await testConvertDocxToHtml(TABLES_DOCX_PATH, TABLES_HTML_PATH);
  });

  it('should process image-containing DOCX into the expected HTML', async () => {
    const temp_dir = 'temp_media'
    const expected_html = readFileContents(IMAGES_HTML_PATH);
    const expectedFiles = ['image1.jpeg', 'image2.jpeg'];
    const html = await convertDOCXtoHTML(IMAGES_DOCX_PATH, temp_dir);

    const filesInDirectory = fs.readdirSync(temp_dir + '/media');

      expectedFiles.forEach(file => {
        assert(filesInDirectory.includes(file), `${file} is missing in the directory.`);
      });

    assert.strictEqual(normalizeHTML(html), normalizeHTML(expected_html)); 

    fs.rm(temp_dir, { recursive: true }, (err) => {
    if (err) {
      console.error('Error removing directory:', err);
    }
    });
  });
});

describe('processHTML', () => {
  it('should process simple HTML into the expected JSON', async () => {
    await testProcessHtml(SIMPLE_HTML_PATH, SIMPLE_JSON_PATH);
  });
  
  it('should process code-containing HTML into the expected JSON', async () => {
    await testProcessHtml(CODE_HTML_PATH, CODE_JSON_PATH);
  });

  it('should process math-containing HTML into the expected JSON', async () => {
    await testProcessHtml(MATH_HTML_PATH, MATH_JSON_PATH);
  });

  it('should process table-containing HTML into the expected JSON', async () => {
    await testProcessHtml(TABLES_HTML_PATH, TABLES_JSON_PATH);
  });
  
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
    getPublicUrl.mockResolvedValue({ok: false});
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