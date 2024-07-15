const inquirer = require('inquirer');
const pandoc = require('node-pandoc-promise');
const xpath = require('xpath');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');
const fs = require('fs');
const path = require('path');
const config = require('./config'); // Load consumer key & secret from config.js
const uuid = require('uuid');
const Learnosity = require('learnosity-sdk-nodejs');

async function getUserInput() {
  try {
    const questions = [
      {
        type: 'input',
        name: 'src',
        message: 'Please provide the filepath of the DOCX file to convert: ',
      },
      {
        type: 'input',
        name: 'questionBankISBN',
        message: 'Please provide the question bank ISBN: ',
      },
      {
        type: 'input',
        name: 'courseID',
        message: 'Please provide the course FPID or book ISBN: ',
      },
      {
        type: 'list',
        name: 'hasRationales',
        choices: ["Yes", "No"],
        message: 'Do your quizzes have rationales?',
      }
    ];

    const answers = await inquirer.prompt(questions);
    let hasRationales = answers['hasRationales'] === "Yes"; // convert to boolean

    return {
      src: answers['src'],
      questionBankISBN: answers['questionBankISBN'],
      courseID: answers['courseID'],
      hasRationales: hasRationales
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
      const questionBankISBN = userinput.questionBankISBN;
      const courseID = userinput.courseID;
      const hasRationales = userinput.hasRationales;
      const output = src.substring(0, src.lastIndexOf('/'));

      return {
        src: src,
        questionBankISBN: questionBankISBN,
        courseID: courseID,
        hasRationales: hasRationales,
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
      const questionBankISBN = filepaths.questionBankISBN;
      const courseID = filepaths.courseID;
      const hasRationales = filepaths.hasRationales;
      const path = filepaths.output;

      const args = ['-f', 'docx+styles', '-t', 'html5', '--wrap=none'];

      const doc = await pandoc(src, args);

      if (!doc) {
        throw new Error('HTML output not received from pandoc')
      }

      return {
        doc: doc,
        questionBankISBN: questionBankISBN,
        courseID: courseID,
        hasRationales: hasRationales,
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
    const questionBankISBN = docinfo.questionBankISBN;
    const courseID = docinfo.courseID;
    const hasRationales = docinfo.hasRationales;
    const path = docinfo.path;

    source = '<!DOCTYPE html><html><head></head><body>' + source + '</body></html>';
    const doc = new DOMParser().parseFromString(source, 'text/xml');
    
    function clean(node) {
      for(var n = 0; n < node.childNodes.length; n ++) {
        var child = node.childNodes[n];
        if (child.nodeType === 8 || (child.nodeType === 3 && !/\S/.test(child.nodeValue) && !/^\u00A0*$/.test(child.nodeValue))) { // remove comments, and text nodees that contain only whitespace (unless whitespace is nonbreaking spaces)
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

    // define permitted values for each attribute to iterate over during cleanup
    // exact strings and regex patterns can be used 
    const permittedAttrValuesMap = {
      "class": [/Quiz.*/, /Question.*/, "Code Block", "Inline Code", "table table-bordered lrn_width_auto"],
      "style": null
    }
    // remove junk attributes from doc
    removeJunkAttr(permittedAttrValuesMap);

    // function to remove junk attributes
    function removeJunkAttr(permittedAttrValuesMap) {
      for (const [attr, permittedValues] of Object.entries(permittedAttrValuesMap)) {
        const nodes = xpath.select(`//*[@${attr}]`, doc);
        if (!permittedValues) {
          nodes.forEach(node => {
              node.removeAttribute(attr);
          });
        } else {
          nodes.forEach(node => {
              const attrValue = node.getAttribute(attr);

              // Check if the attribute value matches any of the permitted values
              const isValid = permittedValues.some(value => {
                  // If the permitted value is a regex, test it against the attribute value
                  if (value instanceof RegExp) {
                      return value.test(attrValue);
                  }
                  // Otherwise, check for exact match
                  return value === attrValue;
              });

              // If no match is found, remove the attribute
              if (!isValid) {
                  node.removeAttribute(attr);
              }
          });
        }
      }
    }

    // handle tables (move to preceding sibling and do some cleanup)
    const tables = xpath.select('//table', doc);
    const tableClassesToAdd = "table table-bordered lrn_width_auto"
    removeChildrenFromParent(tables, './colgroup');
    addClassesToElement(tables, tableClassesToAdd)
    encloseElementsWithinPreviousSiblings(tables);
   
    // function for removing particular child elements from parent elements
    function removeChildrenFromParent(elements, childrenToRemoveXPATH) {
      if (elements) {
        for (const element of elements) {
          const childrenToRemove = xpath.select(childrenToRemoveXPATH, element);
          childrenToRemove.forEach(child => {
              child.parentNode.removeChild(child);
          });
        }
      }
    }

    // function to add specified classes to specified elements
    function addClassesToElement(elements, classesToAdd) {
        if (elements) {
            elements.forEach(element => {
              const existingClasses = element.getAttribute('class') || '';
              const newClasses = `${existingClasses} ${classesToAdd}`.trim();
              element.setAttribute('class', newClasses);
            });
        } else {
            console.error('Invalid element provided.');
        }
    }

    // function for handling tables and similar elements (move to enclose in previous sibling)
    function encloseElementsWithinPreviousSiblings(elements) {
      if (elements) {
        for (const element of elements) {
          console.log(element)
          let previousSib = element.previousSibling;
          if (previousSib) {
            previousSib.appendChild(element);
          }
        }
      }
    }

    // Combine continuation elements with their previous sibling
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

    // set variable from config option for removing mark tags
    const stripMarksConfig = config.stripMarks;

    // function to clean up question elements
    function elementCleanup(text, stripMarks = stripMarksConfig){
      const strongReg = /(<strong>|<\/strong>)/gi;
      const itemPrefixReg = /^(\s*\<.[^\>]*\>)?\s*?((?:[A-Z]|(?:[0-9]*))\.\s*)/gim;
      const itemPrefixRegReplacement = "$1";
      const paraReg = /<p>\s*(<pre>)|(<\/pre>)\s*<\/p>/g;
      const paraRegReplacement = "$1$2";

      // perform some text cleanup
      text = text.replace(strongReg,"");
      text = text.replace(itemPrefixReg, itemPrefixRegReplacement);
      text = text.replace(paraReg, paraRegReplacement); // this must come after the prefix replacement

      // remove strip marks unless config specifies not to
      if (stripMarks != 'undefined' && stripMarks != false) {
        const markReg = /(<mark>|<\/mark>)/gi;
        text = text.replace(markReg,"");
      }

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
    function createQuestionBody(hasRationales, multipleResponses, options, correctOptions, questionStem, rationales) {
      try {

        if (!correctOptions || correctOptions.length < 1) {
          console.log('Question is missing a correct answer flag: ' + questionStem);
          throw new Error('At least one quiz question is missing a correct answer flag. Please fix and rerun.')
        }
        
        if (hasRationales && (!options || !rationales || options.length != rationales.length)) {
          console.log('Question has unequal number of options and rationales ' + questionStem);
          throw new Error('At least one quiz question has an unequal number of options and rationales. Please fix and rerun.')
        }

        const optionsLen = options.length;
        multipleResponses = JSON.stringify(multipleResponses);
        options = JSON.stringify(options);
        correctOptions = JSON.stringify(correctOptions);
        questionStem = JSON.stringify(questionStem);
        rationales = hasRationales ? JSON.stringify(rationales) : null;
        let shouldShuffle = true;

        const shuffleTwoOptionQuestions = config.shuffleTwoOptionQuestions; // flag (possibly temporary) to allow toggling of behavior to shuffle two-option questions (e.g., True/False questions)

        if (typeof shuffleTwoOptionQuestions !== 'boolean') {
          throw new Error('The `shuffleTwoOptionQuestions` flag in config.js must be set to `true` or `false`.')
        }

        if (shuffleTwoOptionQuestions == false && optionsLen == 2) {
          shouldShuffle = false;
        }
  
        let questionBody = `{
                "type": "mcq",
                "reference": "",
                "data": {
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
                "shuffle_options": ${shouldShuffle}
            }
            }
        `;
        return questionBody
      } catch {
        console.error('Error creating question body:', error);
        throw error;
      }
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
                  questionBody = createQuestionBody(hasRationales, multipleResponses, options, correctOptions, questionStem, rationales);
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
        questionBody = createQuestionBody(hasRationales, multipleResponses, options, correctOptions, questionStem, rationales);
        questionBodies.push(questionBody);

        // create refIds for questions
        let questionRefIds = [];
        questionRefIds = await generateIDs(questionBodies.length, 'questions');

        // loop through question bodies, adding refIds
        if (questionBodies.length == questionRefIds.length) {
          for (k = 0; k < questionBodies.length; k++) {
            let questionBody = JSON.parse(questionBodies[k]);
            let questionrefId = questionRefIds[k];
            questionBody.reference = questionrefId;
            questionBodies[k] = JSON.stringify(questionBody)
          }
        } else {
          throw new Error('Number of refIds does not match number of questions.');
        }

        const quiz = {
          quizTitle: quizTitle,
          quizType: quizType,
          questionBodies: questionBodies,
          questionRefIds: questionRefIds
        };
        quizzes.push(quiz);

    }
    return {
      quizzes: quizzes,
      path: path,
      questionBankISBN: questionBankISBN,
      courseID: courseID
    }
  } catch (error) {
    console.error('Error reading HTML:', error);
    throw error;
  }
}

async function createQuizzes(){
  try {
    let quizzes = await readHTML();
    let path = quizzes.path;
    let questionBankISBN = quizzes.questionBankISBN;
    let courseID = quizzes.courseID;
    quizzes = quizzes.quizzes
    let activities = [] // array for quizzes

    // print quiz details output and hold for user Y/N to proceed with quiz creation
    let printOutput = await printQuizzes(quizzes, path);
    let continueFlag = await inquirer.prompt({
          type: 'list',
          choices: ['Yes','No'],
          name: 'continueFlag',
          message: 'Please review the quiz details before continuing.\nDo you wish to proceed with creating the quizzes?',
        });

    continueFlag = continueFlag.continueFlag

    if (continueFlag != 'Yes') {
      console.log("Exiting...");
      process.exit();
    }

    let callapi

    // generate quiz IDs
    let quizRefIds = await generateIDs(quizzes.length, 'activities');

    if (quizRefIds.length != quizzes.length) {
      throw new Error('Number of quiz refIds did not match number of quizzes.');
    }

    // loop through quizzes
    for (i = 0; i < quizzes.length; i++) {
      let quiz = quizzes[i];
      let questions = quiz.questionBodies;
      let questionRefIds = quiz.questionRefIds;
      let itemRefIds = [];
      let body = `{"questions": [${questions}]}`

      // generate questions
      callapi = await callDataAPI(body, 'set', 'questions');

      // generate item IDs
      itemRefIds = await generateIDs(questionRefIds.length, 'items');

      let items = [];

      // prepare items
      if (questionRefIds.length == itemRefIds.length) {
        for (let k = 0; k < itemRefIds.length; k++) {
          let itemRefId = itemRefIds[k];
          let questionRefId = questionRefIds[k];

          const item = `{
            "reference": "${itemRefId}",
            "metadata": null,
            "definition": {
                "widgets": [
                    {
                        "reference": "${questionRefId}"
                    }
                ]
            },
            "status": "published",
            "questions": [
                {
                    "reference": "${questionRefId}"
                }
            ],
            "tags": {
              "Publisher": [
                  "O'Reilly Media"
              ],
              "Course FPID": [
                  "${courseID}"
              ]
            }
          }`

          items.push(item);

        }
      } else {
        throw new Error('Number of question refIds did not match number of item refIds.');
      }

      
      body = `{"items": [${items}]}`

      // generate items
      callapi = await callDataAPI(body, 'set', 'items');

      // prepare quizzes
      let activityRefId = quizRefIds[i];
      let quizTitle = quiz.quizTitle;
      let quizType = quiz.quizType
      
      itemRefIds = '"' + itemRefIds.join('","') + '"'
      const activity = `{
          "title": "${quizTitle}",
          "reference": "${activityRefId}",
          "status": "published",
          "data": {
              "items": [${itemRefIds}],
              "config": {
                  "configuration": {
                      "shuffle_items": true
                  },
                  "regions": "main"
              },
              "rendering_type": "assess"
          },
          "tags": {
              "Quiz Type": [
                  "${quizType}"
              ],
              "Publisher": [
                  "O'Reilly Media"
              ],
              "Question Bank FPID": [
                  "${questionBankISBN}"
              ],
              "Course FPID": [
                  "${courseID}"
              ]
            }
          }`

      activities.push(activity);
    
    }
 

    // create quizzes
    body = `{"activities": [${activities}]}`

    callapi = await callDataAPI(body, 'set', 'activities');

    printRefIds(activities, path);

  } catch (error) {
    console.error('Error creating quizzes: ', error);
    throw error; // Rethrow the error to propagate it up the chain
  }
}

async function generateIDs(num, endpoint) {
  try {
    let refIds = [];

    // Generate reference IDs for each object
    for (let i = 0; i < num; i++) {
      let refId = uuid.v4();
      refIds.push(refId);
    }

    // Function to check if refIds are unique
    const checkID = async (refIds, endpoint) => {
      const body = JSON.stringify({ references: refIds });
      const response = await callDataAPI(body, 'get', endpoint);
      const records = response.meta.records;
      return records;
    };

    // Check if any reference IDs are not unique
    let records = await checkID(refIds, endpoint);
    let tries = 0;

    // Continue generating new reference IDs until all are unique
    while (records !== 0 && tries <= 5) {
      for (let i = 0; i < objArr.length; i++) {
        refIds[i] = uuid.v4();
      }
      records = await checkID(refIds, endpoint);
      tries++;

      if (tries === 5) {
        console.log("Unable to produce unique IDs in 5 tries. Exiting...");
        return null;
      }
    }

    if (num != refIds.length) {
      console.log("Problem generating refIds. Exiting...");
    }

    return refIds
  } catch {
    console.error('Error generating IDs: ', error);
    throw error; // Rethrow the error to propagate it up the chain
  }
}

async function callDataAPI(body, action, endpoint){
  // Things to do before completion of the promise
  endpoint = 'https://data.learnosity.com/v2023.1.LTS/itembank/' + endpoint

  // Instantiate the SDK
  const learnositySdk = new Learnosity();

  // Set the web server domain
  const domain = 'localhost';

  // Generate a Learnosity API initialization packet to the Data API
  const dataAPIRequest = learnositySdk.init(
    // Set the service type
    'data',

    // Security details - dataAPIRequest.security 
    {
        consumer_key: config.consumerKey, // Your actual consumer key goes here 
        domain:       domain, // Your actual domain goes here
        user_id:      '110961' // GH user id
    },
    // secret 
    config.consumerSecret, // Your actual consumer secret here
    
    body, // request body
    
    action // request action
    );

  const form = new FormData();
  /* Note: the same can be accomplished with using URLSearchParams 
  (https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams)
  const form = new URLSearchParams()
  */
  form.append("security", dataAPIRequest.security);
  form.append("request", dataAPIRequest.request);
  form.append("action", dataAPIRequest.action);

  /* Define an async/await data api call function that takes in the following:
  *
  * @param endpoint : string
  * @param requestParams : object
  *
  */
  const makeDataAPICall = async (endpoint, requestParams) => {
    // Use 'await' save the successful response to a variable called dataAPIResponse
    const dataAPIResponse = await fetch(endpoint, {
      method: 'POST', // *GET, POST, PUT, DELETE, etc.
      body: requestParams 
    });
    // Return the response JSON
    return dataAPIResponse.json(); 
  }

  /* Now call the function, passing in the desired endpoint, and pass in the fromData object (saved to the variable called 'form' here), which contains the requestParams: */

  const response = await makeDataAPICall(endpoint, form)
    .then(response => {
      return response
    })
    .catch(error => console.log('There was an error calling the Learnosity API: ', error))
  
  return response
}

async function printQuizzes(quizzes, docPath) {
    try {        
        const outputFilePath = path.join(docPath, 'review-file.txt');
        const outputStream = fs.createWriteStream(outputFilePath);

        quizzes.forEach((quiz, index) => {
            outputStream.write(`Quiz ${index + 1}:\n`);
            outputStream.write(`Title: ${quiz.quizTitle}\n`);
            outputStream.write(`Type: ${quiz.quizType}\n`);
            quiz.questionBodies.forEach((questionBody, i) => {
                outputStream.write(`\tQuestion ${i + 1}:\n`);
                outputStream.write(`\t${questionBody}\n`);
            });
            outputStream.write('\n');
        });

        outputStream.end();
        console.log(`Quiz details written to ${outputFilePath}`);
    } catch (error) {
        console.error('Error writing output:', error);
    }
}

async function printRefIds(activities, docPath) {
    try {        
        const outputFilePath = path.join(docPath, 'ref-ids.txt');
        const outputStream = fs.createWriteStream(outputFilePath, {flags:'a'});

        activities.forEach((activity) => {
          activity = JSON.parse(activity);
          outputStream.write(`Generated quiz with title "${activity.title}" and ref Id: ${activity.reference}\n`)
          outputStream.write(`Generated items with ref Ids:\n`)
          activity.data.items.forEach((item) => {
            outputStream.write(`${item}\n`)
          });
          outputStream.write('\n')
        });

        outputStream.end();
        console.log(`Ref ids of created quiz elements written to ${outputFilePath}`);
    } catch (error) {
        console.error('Error writing ref Ids to file: ', error);
    }
}

createQuizzes();

