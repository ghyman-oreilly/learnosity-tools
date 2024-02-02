const inquirer = require('inquirer');
const pandoc = require('node-pandoc-promise');
const xpath = require('xpath');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');
const fs = require('fs');

async function getUserInput() {
  try {
    const questions = [
      {
        type: 'input',
        name: 'src',
        message: 'Please provide the filepath of the DOCX file to convert: ',
      },
    ];

    const answers = await inquirer.prompt(questions);

    return {
      src: answers['src'],
    };
  } catch (error) {
    console.error('Error getting user input:', error);
    throw error; // Rethrow the error to propagate it up the chain
  }
}

async function processFilepath() {
  try {
    const userinput = await getUserInput();

    // Check if userinput is not null or undefined before accessing its properties
    if (userinput && userinput.src) {
      const src = userinput.src;
      const output = src.substring(0, src.lastIndexOf('/'));

      return {
        src: src,
        output: output,
      };
    } else {
      throw new Error('Invalid user input');
    }
  } catch (error) {
    console.error('Error processing filepath:', error);
    throw error;
  }
}

async function convertDOCXtoHTML() {
  try {
    const filepaths = await processFilepath();
    
    if (filepaths && filepaths.src && filepaths.output) {
      const src = filepaths.src;
      const path = filepaths.output;

      const args = ['-f', 'docx+styles', '-t', 'html5', '--wrap=none'];

      const doc = await pandoc(src, args);

      if (!doc) {
        throw new Error('HTML output not received from pandoc')
      }

      return {
        doc: doc,
        path: path,
      };
    } else {
      throw new Error('Invalid filepath');
    }
  } catch (error) {
    console.error('Error converting DOCX to HTML:', error);
    throw error;
  }
}

async function readHTML() {
  try {
    const docinfo = await convertDOCXtoHTML();
    
    if (!docinfo || !docinfo.doc || !docinfo.path) {
      throw new Error('HTML not received from convertDOCXtoHTML function')
    }
    
    let source = docinfo.doc;
    const path = docinfo.path;

    source = '<!DOCTYPE html><html><head></head><body>' + source + '</body></html>';
    const doc = new DOMParser().parseFromString(source, 'text/xml');
    const divElements = xpath.select('//div[starts-with(@data-custom-style, "Question")]', doc);
    const inlineElements = xpath.select('//span[starts-with(@data-custom-style, "Code Block") or starts-with(@data-custom-style, "Inline Code")]', doc);
    const codeBlockBreaks = xpath.select('//span[@data-custom-style="Code Block"]/br', doc);

    let questionStrings = [];

    let currentPredecessor = null;
    let currentPredecessorText = '';
    let multipleResponses = false;
    let optionObjs = [];
    let correctOptions = [];
    let rationaleArr = [];
    let stemText = '';

    // handling for manual breaks within code blocks
    for (i = 0; i < codeBlockBreaks.length; i++) {
      let codeBlockBreak = codeBlockBreaks[i];
      codeBlockBreak.parentNode.removeChild(codeBlockBreak);
    }

  // Handle inlines first
    for (let i = 0; i < inlineElements.length; i++) {
      const inline = inlineElements[i];
      const elementType = inline.getAttribute('data-custom-style');

      // Apply transformations for CodeBlock and InlineCode
      if (elementType === 'Code Block') {
        wrapElementWithPreTag(inline);
      } else if (elementType === 'Inline Code') {
        wrapElementWithCodeTag(inline);
      }
    }

  // Handle divs
  for (let i = 0; i < divElements.length; i++) {
    const element = divElements[i];
    const para = element.childNodes[1]; // assumes paragraph node is preceded by one newline
    const elementType = element.getAttribute('data-custom-style');

    if (elementType.includes('Continued')) {
      // Append continuation text to the current predecessor
      if (currentPredecessor !== null && currentPredecessorText !== '') {
        currentPredecessorText += new XMLSerializer().serializeToString(para).trim();
      }
    } else {
      // Set the new current predecessor only for elements with specific data-custom-style values
      if (elementType.startsWith('Question')) {
        // Process the previous predecessor before starting a new one
        if (currentPredecessor !== null && currentPredecessorText !== '') {
          processPredecessor(currentPredecessor, currentPredecessorText);
        }

        currentPredecessor = elementType;
        currentPredecessorText = new XMLSerializer().serializeToString(para).trim();
      }
    }
  }

  // Process the last predecessor
  if (currentPredecessor !== null && currentPredecessorText !== '') {
    processPredecessor(currentPredecessor, currentPredecessorText);
  }

    function wrapElementWithCodeTag(element) {
      const codeTag = element.ownerDocument.createElement('code');
      element.parentNode.insertBefore(codeTag, element);

      while (element.firstChild) {
        codeTag.appendChild(element.firstChild);
      }

      element.parentNode.removeChild(element);
    }

    function wrapElementWithPreTag(element) {
      const preTag = element.ownerDocument.createElement('pre');
      element.parentNode.insertBefore(preTag, element);

      // move children to parent (enclosing para, which we can't remove yet, as it could contain 'correct' flag)
      while (element.firstChild) {
        preTag.appendChild(element.firstChild);
      }

      element.parentNode.removeChild(element);

    }

    function processPredecessor(type, text) {
      const strongReg = /(<strong>|<\/strong>)/gi;
      const itemPrefixReg = /^(\s*\<.[^\>]*\>)?\s*?((?:[A-Z]|(?:[0-9]*))\.\s*)/gim;
      const itemPrefixRegReplacement = "$1";
      const paraReg = /<p>\s*(<pre>)|(<\/pre>)\s*<\/p>/g;
      const paraRegReplacement = "$1$2";

      // perform some text cleanup
      text = text.replace(strongReg,"");
      text = text.replace(itemPrefixReg, itemPrefixRegReplacement);
      text = text.replace(paraReg, paraRegReplacement); // this must come after the prefix replacement

      // Processing logic for different predecessor types
      switch (type) {
        case 'QuestionStem':
          // Create a new quiz question if there is already data for the previous question
          if (stemText !== '') {
            createQuizQuestion();
          }
          // Customize logic for processing QuestionStem
          stemText = text;
          break;
        case 'QuestionOption':
          // Customize logic for processing QuestionOption
          // For demonstration, wrap the text in JSON
          const indexString = optionObjs.length.toString();
          const isCorrect = /\[Correct[^\]]*\]/i.test(text);
          let optionText = text.replace(/\[Correct[^\]]*\]/i, '').trim();
          optionText = optionText.replace(itemPrefixReg, itemPrefixRegReplacement); // 'duplicated' here in case the prefix follows the correct flag
          optionText = optionText.replace(paraReg, paraRegReplacement); // ditto here
          const optionObj = { label: optionText, value: indexString };
          optionObjs.push(optionObj);

          if (isCorrect) {
            correctOptions.push(indexString);
          }
          break;
        case 'QuestionRationale':
          // Customize logic for processing QuestionRationale
          // For demonstration, wrap the text in JSON
          rationaleArr.push(text);
          break;
        default:
          break;
      }
    }

    // Create a new quiz question with the accumulated data
    function createQuizQuestion() {
      
      // Set single or multiple response
      if (correctOptions.length > 1) {
        multipleResponses = true;
      }
      if (correctOptions.length == 0) {
        throw new Error("One or more quiz items are missing a correct response flag. Please fix and rerun the script.\nQuestion stem: " + stemText)
      }

      // Test # options = # rationales
      if (optionObjs.length != rationaleArr.length) {
        throw new Error("The number of options doesn't equal the number of rationales for at least one quiz question. Please fix and rerun script.\nQuestion stem: " + stemText)
      }

      let stemJson = JSON.stringify(stemText);
      let optionObjsJson = JSON.stringify(optionObjs);
      let correctOptionsJson = JSON.stringify(correctOptions);
      let rationalesJson = JSON.stringify(rationaleArr);

      let quizJson = `
        {
          "multiple_responses": ${multipleResponses},
          "options": ${optionObjsJson},
          "stimulus": ${stemJson},
          "type": "mcq",
          "validation": {
            "scoring_type": "exactMatch",
            "valid_response": {
              "score": 1,
              "value": ${correctOptionsJson}
            }
          },
          "ui_style": {
            "type": "horizontal"
          },
          "metadata": {
            "distractor_rationale_response_level": ${rationalesJson}
          },
          "shuffle_options": true
        }
      `;

      // Push the JSON string to questionStrings
      questionStrings.push(quizJson);

      // Reset data for the next question
      stemText = '';
      optionObjs = [];
      correctOptions = [];
      rationaleArr = [];
      multipleResponses = false;
    }

    // Create a new quiz question for the last set of elements
    createQuizQuestion();

    return {
      questionStrings: questionStrings,
      path: path,
    };
  } catch (error) {
    console.error('Error reading HTML:', error);
    throw error;
  }
}

async function writeToFile() {
  try {
    const html = await readHTML();
    
    if (!html || !html.questionStrings || !html.path) {
      throw new Error("JSON not received from readHTML function")
    }
    
    const questionStrings = html.questionStrings;
    const path = html.path;

    for (let i = 0; i < questionStrings.length; i++) {
      let questionString = questionStrings[i];
      let questionNumberString = String(i).padStart(2,'0');
      let uniqueString = String(Date.now()); 
      let filename = "question_" + questionNumberString + "_" + uniqueString + ".json"
      let filepath = path + "/" + filename

      fs.writeFile(filepath, questionString, function(err) {
        if(err) {
            return console.log(err);
        }
        console.log("The file " + filename + " was saved!");
      }); 
    }
  } catch (error) {
    console.error('Error writing to file:', error);
  }
}

writeToFile();
