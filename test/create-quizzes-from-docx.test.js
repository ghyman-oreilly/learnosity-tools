const assert = require('assert');
const fs = require('fs');
const { DOMParser, XMLSerializer } = require('xmldom');
const path = require('path');
const { convertDOCXtoHTML, processHTML } = require('../src/create-quizzes-from-docx');
const { sendAPIRequests } = require('../src/shared/call-learnosity');


const [SIMPLE_DOCX_PATH, SIMPLE_HTML_PATH, SIMPLE_JSON_PATH] = generateInputFilepaths('simple');
const [CODE_DOCX_PATH, CODE_HTML_PATH, CODE_JSON_PATH] = generateInputFilepaths('code');
const [MATH_DOCX_PATH, MATH_HTML_PATH, MATH_JSON_PATH] = generateInputFilepaths('math');
const [TABLES_DOCX_PATH, TABLES_HTML_PATH, TABLES_JSON_PATH] = generateInputFilepaths('tables');
const [IMAGES_DOCX_PATH, IMAGES_HTML_PATH, IMAGES_JSON_PATH] = generateInputFilepaths('images');

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

function generateInputFilepaths(descriptor, fileTypes = ['docx', 'html', 'json']) {
  /* Generate file paths dynamically based on fileTypes array
     The descriptor determines the base name for the file paths. 
     Example: 'simple' -> 'data/simple.docx', 'data/simple.html', 'data/simple.json' */
  
  return fileTypes.map(type => path.resolve(__dirname, 'data', `${descriptor}.${type}`));
}

async function testConvertDocxToHtml(input_docx_path, expected_html_path) {
	/* Test that a quiz doc
	converts to expected HTML. */
	const expected_html = readFileContents(expected_html_path);
	html = await convertDOCXtoHTML(input_docx_path);
	assert.strictEqual(normalizeHTML(html), normalizeHTML(expected_html)); 
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
	assert.strictEqual(serializedQuizzesJSON, expected_json);
}

async function testSimpleDocxToHtml(SIMPLE_DOCX_PATH, SIMPLE_HTML_PATH) {
	/* Test that a simple quiz doc
	converts to expected HTML. */
	testConvertDocxToHtml(SIMPLE_DOCX_PATH, SIMPLE_HTML_PATH);
}

async function testCodeDocxToHtml(CODE_DOCX_PATH, CODE_HTML_PATH) {
	/* Test that a quiz doc with 
	lots of code converts to expected
	HTML. */
	testConvertDocxToHtml(CODE_DOCX_PATH, CODE_HTML_PATH);
}

async function testMathDocxToHtml(MATH_DOCX_PATH, MATH_HTML_PATH) {
	/* Test that a quiz doc with 
	lots of math converts to expected
	HTML. */
	testConvertDocxToHtml(MATH_DOCX_PATH, MATH_HTML_PATH);
}

async function testTableDocxToHtml(TABLES_DOCX_PATH, TABLES_HTML_PATH) {
	/* Test that a quiz doc with 
	tables converts to expected
	HTML. */
	testConvertDocxToHtml(TABLES_DOCX_PATH, TABLES_HTML_PATH);
}

async function testImageDocxToHtml(IMAGES_DOCX_PATH, IMAGES_HTML_PATH) {
	/* Test that a quiz doc with 
	images converts to expected
	HTML. */
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
}

async function processSimpleHtml(SIMPLE_HTML_PATH, SIMPLE_JSON_PATH) {
	/* Test that HTML from simple DOCX
	is processed to produce the expected
	quiz objects (represented as custom objects
	serialized to JSON). */
	testProcessHtml(SIMPLE_HTML_PATH, SIMPLE_JSON_PATH);
}

async function processCodeHtml(CODE_HTML_PATH, CODE_JSON_PATH) {
	/* Test that HTML from DOCX with
	lots of code is processed to produce
	the expected JSON payload.
	*/
	testProcessHtml(CODE_HTML_PATH, CODE_JSON_PATH);
}

async function processMathHtml(MATH_HTML_PATH, MATH_JSON_PATH) {
	/* Test that HTML from DOCX with
	lots of math is processed to produce
	the expected JSON payload.
	*/
	testProcessHtml(MATH_HTML_PATH, MATH_JSON_PATH);
}

async function processTableHtml(TABLES_HTML_PATH, TABLES_JSON_PATH) {
	/* Test that HTML from DOCX with
	tables is processed to produce
	the expected JSON payload.
	*/
	testProcessHtml(TABLES_HTML_PATH, TABLES_JSON_PATH);
}

async function processImageHtml() {
	/* Test that HTML from DOCX with
	images is processed to produce
	the expected JSON payload.
	*/

	/* TODO: this will required mocks, 
	so we might need to use Jest.
	
	Do we want to migrate the other tests
	to Jest as well? */
}

testSimpleDocxToHtml(SIMPLE_DOCX_PATH, SIMPLE_HTML_PATH);
processSimpleHtml(SIMPLE_HTML_PATH, SIMPLE_JSON_PATH);
testCodeDocxToHtml(CODE_DOCX_PATH, CODE_HTML_PATH);
processCodeHtml(CODE_HTML_PATH, CODE_JSON_PATH);
testMathDocxToHtml(MATH_DOCX_PATH, MATH_HTML_PATH);
processMathHtml(MATH_HTML_PATH, MATH_JSON_PATH);
testTableDocxToHtml(TABLES_DOCX_PATH, TABLES_HTML_PATH);
processTableHtml(TABLES_HTML_PATH, TABLES_JSON_PATH);
testImageDocxToHtml(IMAGES_DOCX_PATH, IMAGES_HTML_PATH);