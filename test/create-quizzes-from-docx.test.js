const assert = require('assert');
const fs = require('fs');
const inquirer = require('inquirer');
const path = require('path');
const { DOMParser, XMLSerializer } = require('xmldom');
const { convertDOCXtoHTML, processHTML, createQuizzes } = require('@src/create-quizzes-from-docx');
const { sendAPIRequests, getPublicUrl, uploadFileToPresignedUrl, callDataAPI } = require('@src/shared/call-learnosity');
const { StandardQuestion, DiagnosticQuestion } = require('@src/classModules/questions');
const { StandardQuiz, DiagnosticQuiz } = require('@src/classModules/quizzes');

const DATA_DIR = path.resolve(__dirname, 'data');
const [SIMPLE_DOCX_PATH, SIMPLE_HTML_PATH, SIMPLE_JSON_PATH] = generateInputFilepaths('simple');
const [CODE_DOCX_PATH, CODE_HTML_PATH, CODE_JSON_PATH] = generateInputFilepaths('code');
const [MATH_DOCX_PATH, MATH_HTML_PATH, MATH_JSON_PATH] = generateInputFilepaths('math');
const [TABLES_DOCX_PATH, TABLES_HTML_PATH, TABLES_JSON_PATH] = generateInputFilepaths('tables');
const [IMAGES_DOCX_PATH, IMAGES_HTML_PATH, IMAGES_JSON_PATH] = generateInputFilepaths('images');


beforeEach(() => {
  jest.resetModules();
  jest.resetAllMocks();
});

// Mock functions in call-learnosity module
jest.mock('@src/shared/call-learnosity', () => ({
  sendAPIRequests: jest.fn(),
  getPublicUrl: jest.fn(),
  uploadFileToPresignedUrl: jest.fn(),
  callDataAPI: jest.fn(),
}));

// Mock inquirer
jest.mock('inquirer');

function generateInputFilepaths(descriptor, fileTypes = ['docx', 'html', 'json']) {
  /* Generate file paths dynamically based on fileTypes array
     The descriptor determines the base name for the file paths. 
     Example: 'simple' -> 'data/simple.docx', 'data/simple.html', 'data/simple.json' */
  
  return fileTypes.map(type => path.resolve(DATA_DIR, `${descriptor}.${type}`));
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

// Utility function to create a map of UUIDs to placeholders
// Expects an array of strings as input 
function createUUIDMap(payloads) {
  const uuidMap = {};
  let uuidCounter = 1;

  // Regular expression to match UUIDs
  const uuidRegex = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;

  // Iterate over each payload and collect UUIDs
  payloads.forEach((payload) => {
    let match;
    while ((match = uuidRegex.exec(payload)) !== null) {
      const uuid = match[0];
      if (!uuidMap[uuid]) {
        uuidMap[uuid] = `UUID_${uuidCounter++}`;
      }
    }
  });

  return uuidMap;
}

// Function to clean UUIDs in an array of string payloads using the previously built map
function cleanStringPayloadArray(payloads, uuidMap) {
  return payloads.map(payload => {
    return payload.replace(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi, (match) => {
      return uuidMap[match] || match; // Replace UUID with the corresponding placeholder from uuidMap
    });
  });
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
        expect(filesInDirectory).toContain(file, `${file} is missing in the directory.`);
      });

    expect(normalizeHTML(html)).toBe(normalizeHTML(expected_html));

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

describe('createQuizzes', () => {
  it('should generate expected simple-use-case quiz data for importing via API', async () => {
    sendAPIRequests.mockResolvedValue({ok: true});
    inquirer.prompt.mockResolvedValue({continueFlag: 'Yes'});
    callDataAPI.mockResolvedValue({meta: {records: 0}});

    const quizzes = []
    const quizzesJsonData = JSON.parse(readFileContents(SIMPLE_JSON_PATH));
    const expectedCleanedQuestions = readFileContents(path.resolve(DATA_DIR, 'simple_cleanedQuestions.json'));
    const expectedCleanedItems = readFileContents(path.resolve(DATA_DIR, 'simple_cleanedItems.json'));
    const expectedCleanedActivities = readFileContents(path.resolve(DATA_DIR, 'simple_cleanedActivities.json'));

    // generate Quiz and Question objects from 
    // parsed JSON
    quizzesJsonData.forEach((quizJsonData) => {
      const quiz = StandardQuiz.fromJSON(quizJsonData);
      quizzes.push(quiz);
    });

    const outputPath = path.resolve(DATA_DIR, 'temp');

    fs.mkdir(outputPath, () => {});

    await createQuizzes(quizzes, '111', '222', undefined, outputPath);

    fs.rm(outputPath, { recursive: true }, () => {})

    // Check the calls to sendAPIRequests and obtain outgoing payloads
    expect(sendAPIRequests).toHaveBeenCalledTimes(3);

    const actualQuestionsJsonArr = sendAPIRequests.mock.calls[0][0];
    const actualItemsJsonArr = sendAPIRequests.mock.calls[1][0];
    const actualActivitiesJsonArr = sendAPIRequests.mock.calls[2][0];

    // Collect UUIDs from all payloads to create a map
    // This allows us to scrub the UUIDs but still ensure in our testing
    // that payload UUIDs cross match where expected
    const uuidMap = createUUIDMap([actualQuestionsJsonArr, actualItemsJsonArr, actualActivitiesJsonArr]);

    // Clean all payloads using the UUID map
    const actualCleanedQuestions = JSON.stringify(cleanStringPayloadArray(actualQuestionsJsonArr, uuidMap), null, 2);
    const actualCleanedItems = JSON.stringify(cleanStringPayloadArray(actualItemsJsonArr, uuidMap), null, 2);
    const actualCleanedActivities = JSON.stringify(cleanStringPayloadArray(actualActivitiesJsonArr, uuidMap), null, 2);

    expect(actualCleanedQuestions).toBe(expectedCleanedQuestions);
    expect(actualCleanedItems).toBe(expectedCleanedItems);
    expect(actualCleanedActivities).toBe(expectedCleanedActivities);

  });
});