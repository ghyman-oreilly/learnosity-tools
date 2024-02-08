const inquirer = require('inquirer');
const pandoc = require('node-pandoc-promise');
const xpath = require('xpath');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');
const fs = require('fs');
const path = require('path');

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
    
    function clean(node) {
      for(var n = 0; n < node.childNodes.length; n ++) {
        var child = node.childNodes[n];
        if (child.nodeType === 8 || (child.nodeType === 3 && !/\S/.test(child.nodeValue))) {
          node.removeChild(child);
          n --;
        }
        else if(child.nodeType === 1) {
          clean(child);
        }
      }
    }

    // remove useless nodes from doc
    clean(doc)
    
    // Combine continuation elements with their predecessors
    let continuationElements = xpath.select('//div[contains(@data-custom-style, "Continued")]', doc);
    while (continuationElements.length > 0) {
        for (let i = continuationElements.length - 1; i >= 0; i--) {
            let continuationElement = continuationElements[i];

            // Loop through children of continuation element, moving them to previousSibling
            while (continuationElement.firstChild) {
                continuationElement.previousSibling.appendChild(continuationElement.firstChild);
            }
            continuationElement.parentNode.removeChild(continuationElement);
        }
        continuationElements = xpath.select('//div[contains(@data-custom-style, "Continued")]', doc);
    }

    const inlineElements = xpath.select('//span[starts-with(@data-custom-style, "Code Block") or starts-with(@data-custom-style, "Inline Code")]', doc);
    const codeBlockBreaks = xpath.select('//span[@data-custom-style="Code Block"]/br', doc);

    // handling for manual breaks within code blocks
    for (i = 0; i < codeBlockBreaks.length; i++) {
      let codeBlockBreak = codeBlockBreaks[i];
      codeBlockBreak.parentNode.removeChild(codeBlockBreak);
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

    // Handle inlines
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

    // function to clean up question elements
    function elementCleanup(text){
      const strongReg = /(<strong>|<\/strong>)/gi;
      const itemPrefixReg = /^(\s*\<.[^\>]*\>)?\s*?((?:[A-Z]|(?:[0-9]*))\.\s*)/gim;
      const itemPrefixRegReplacement = "$1";
      const paraReg = /<p>\s*(<pre>)|(<\/pre>)\s*<\/p>/g;
      const paraRegReplacement = "$1$2";

      // perform some text cleanup
      text = text.replace(strongReg,"");
      text = text.replace(itemPrefixReg, itemPrefixRegReplacement);
      text = text.replace(paraReg, paraRegReplacement); // this must come after the prefix replacement

      return text
    }

    // function to serialize node children to string
    function serialize(element) {
      if (element.hasChildNodes) {
        let string = '';
        while (element.firstChild) {
          string += element.firstChild.toString();
          element.removeChild(element.firstChild)
        }
        return string
      }
    }

    // function to create question body from elements
    function createQuestionBody(multipleResponses, options, correctOptions, questionStem, rationales) {
      multipleResponses = JSON.stringify(multipleResponses);
      options = JSON.stringify(options);
      correctOptions = JSON.stringify(correctOptions);
      questionStem = JSON.stringify(questionStem);
      rationales = JSON.stringify(rationales);

      let questionBody = `
          {
              "multiple_responses": ${multipleResponses},
              "options": ${options},
              "stimulus": ${questionStem},
              "type": "mcq",
              "validation": {
                  "scoring_type": "exactMatch",
                  "valid_response": {
                      "score": 1,
                      "value": ${correctOptions}
                  }
              },
              "ui_style": {
                  "type": "horizontal"
              },
              "metadata": {
                  "distractor_rationale_response_level": ${rationales}
              },
              "shuffle_options": true
          }
      `;
      return questionBody
    }

    let quizCounter = 0;
    let questionCounter = 0;
    let questionBodies = [];

    let quizzes = [];

    const quizTitleElements = xpath.select('//h1[starts-with(@class, "QuizTitle")]', doc);

    // Loop through quiz titles
    for (let i = 0; i < quizTitleElements.length; i++) {
        let quizTitleElement = quizTitleElements[i];

        quizCounter++; // Increment quiz counter

        // Reset question counter and question bodies array for each new quiz
        questionCounter = 0;
        questionBodies = [];

        quizTitle = quizTitleElement.textContent.trim();
        let nextElement = quizTitleElement.nextSibling;

        let questionStem = ''; // Initialize questionStem variable here
        let options = []; // Initialize options array
        let correctOptions = []; // Initialize correctOptions array
        let rationales = []; // Initialize rationales array
        let questionBody;
        let optionCounter;
        let multipleResponses;

        while (nextElement && (!nextElement.getAttribute('class') || nextElement.getAttribute('class') !== 'QuizTitle')) {
          // Parse quiz elements here
          let elementType = nextElement.getAttribute('data-custom-style');
          let questionOption;
          let questionRationale;

          // skip elements that don't have data-custom-style attr (like [rationale] tag)
          while (nextElement && !nextElement.getAttribute('data-custom-style')) {
              nextElement = nextElement.nextSibling; // move to next sibling
              elementType = nextElement.getAttribute('data-custom-style');
          }

          switch(elementType) {
            case 'QuizType':
                quizType = nextElement.textContent.trim();
                break;
            case 'QuestionStem':
                questionCounter++; // Increment question counter

                // if questionCounter > 1, record previous question
                // creates and pushes questionBody for all but last question in a given quiz
                if (questionCounter > 1) {
                  questionBody = createQuestionBody(multipleResponses, options, correctOptions, questionStem, rationales);
                  questionBodies.push(questionBody);
                }

                questionStem = elementCleanup(serialize(nextElement));
                optionCounter = 0 // reset option counter (zero-indexed)
                options = []; // Reset array when encountering a stem
                correctOptions = []; // Reset array when encountering a stem
                rationales = []; // Reset array when encountering a stem
                multipleResponses = false; // reset flag
                break;
            case 'QuestionOption':
                questionOption = serialize(nextElement);
                
                // test for correct option(s)
                const isCorrect = /\[Correct[^\]]*\]/i.test(questionOption);
                if (isCorrect) {
                  correctOptions.push(optionCounter.toString()); 
                }
                if (correctOptions.length > 1) {
                  multipleResponses = true
                }

                questionOption = elementCleanup(questionOption.replace(/\[Correct[^\]]*\]/i, '').trim());
                // options.push(questionOption);
                options.push({label: questionOption, value: optionCounter.toString()})
                optionCounter++ // increment option counter
                break;
            case 'QuestionRationale':
                questionRationale = elementCleanup(serialize(nextElement));
                rationales.push(questionRationale);
                break;
          }
          nextElement = nextElement.nextSibling; // Move to next sibling
        }

        // create a push questionBody for last question in a given quiz
        questionBody = createQuestionBody(multipleResponses, options, correctOptions, questionStem, rationales);
        questionBodies.push(questionBody);

        // TODO: logic for multiple correct responses: true/false
        // TODO: accumulate indices of correct responses

        const quiz = {
          quizTitle: quizTitle,
          quizType: quizType,
          questionBodies: questionBodies
        };
        quizzes.push(quiz);

    }
    return {
      quizzes: quizzes,
      path: path
    }
  } catch (error) {
    console.error('Error reading HTML:', error);
    throw error;
  }
}

async function printQuizzes() {
    try {
        let quizzes = await readHTML();
        const docPath = quizzes.path;
        quizzes = quizzes.quizzes;
        
        const outputFilePath = path.join(docPath, 'output.txt');
        const outputStream = fs.createWriteStream(outputFilePath);

        quizzes.forEach((quiz, index) => {
            outputStream.write(`Quiz ${index + 1}:\n`);
            outputStream.write(`Title: ${quiz.quizTitle}\n`);
            outputStream.write(`Type: ${quiz.quizType}\n`);
            outputStream.write(`Question Bodies:\n`);
            quiz.questionBodies.forEach((questionBody, i) => {
                outputStream.write(`\tQuestion ${i + 1}:\n`);
                outputStream.write(`\t${questionBody}\n`);
            });
            outputStream.write('\n');
        });

        outputStream.end();
        console.log(`Output written to ${outputFilePath}`);
    } catch (error) {
        console.error('Error writing output:', error);
    }
}

printQuizzes();



