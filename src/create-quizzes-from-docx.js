const inquirer = require('inquirer');
const pandoc = require('node-pandoc-promise');
const xpath = require('xpath');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');
const fs = require('fs');
const path = require('path');
const config = require('./config'); // Load consumer key & secret from config.js
const uuid = require('uuid');
const { callDataAPI, sendAPIRequests, uploadFileToPresignedUrl } = require('./shared/call-learnosity');
const readJSONFromFile = require('./shared/read-json-from-file');
const { StandardQuestion, DiagnosticQuestion } = require('./classModules/questions')
const { StandardQuiz, DiagnosticQuiz } = require('./classModules/quizzes')
const {
	questionBankIdTagName,
	courseIdTagName
} = require('./constants')

async function getUserInput(enableDiagnostic=false, allowRationaleToggleInStandardQuizzes=false) {
  try {
    const questions = [
      {
        type: 'input',
        name: 'src',
        message: 'Please provide the filepath of the DOCX file to convert: ',
      },
      {
      type: 'list',
      name: 'quizType',
      message: 'Is this a Standard or Diagnostic Quiz?',
      choices: ['Standard', 'Diagnostic'],
      when: enableDiagnostic === true,
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
        when: (answers) => answers.quizType === 'Standard',
      },
      {
        type: 'list',
        name: 'hasRationales',
        choices: ["Yes", "No"],
        message: 'Do your quizzes have rationales?',
        when: (answers) => answers.quizType === 'Standard' && allowRationaleToggleInStandardQuizzes === true,
      },
      {
        type: 'list',
        name: 'addTags',
        choices: ["No", "Yes"],
        message: 'Do you wish to add addl activity and item tags (e.g., Level, Topic, Role) via JSON file?',
        when: (answers) => answers.quizType === 'Standard',
      },
      {
        type: 'input',
        name: 'tagsFile',
        message: 'Please provide the filepath of the JSON file containing your tags: ',
        when: (answers) => answers.addTags === 'Yes',
      },
    ];

    const answers = await inquirer.prompt(questions);
    let hasRationales

    // handle hasRationales, depending on quiz type, config, and user input
    if (answers.quizType === 'Standard') {
      hasRationales = 'hasRationales' in answers ? answers['hasRationales'] : true;
    } else {
      hasRationales = false;
    }
    hasRationales = hasRationales === "Yes" || hasRationales === true; // convert to boolean
    let addTags = 'addTags' in answers ? answers['addTags'] : '';
    addTags = addTags === "Yes";

    return [
      answers['src'] ?? '',
      'quizType' in answers ? answers['quizType'] : 'Standard',
      answers['questionBankISBN'],
      'courseID' in answers ? answers['courseID'] : '',
      hasRationales,
      addTags,
      'tagsFile' in answers ? answers['tagsFile'] : '',
    ];
  } catch (error) {
    console.error('Error getting user input:', error);
    throw error; // Rethrow the error to propagate it up the chain
  }
}

async function convertDOCXtoHTML(path_to_docx, path_to_temp_dir) {
  try {
      const extract_media_flag = '--extract-media=' + path_to_temp_dir
      
      const args = ['-f', 'docx+styles', '-t', 'html5', '--wrap=none', extract_media_flag];

      const doc = await pandoc(path_to_docx, args);

      if (!doc) {
        throw new Error('HTML output not received from pandoc')
      }

      return doc

  } catch (error) {
    console.error('Error converting DOCX to HTML:', error);
    throw error;
  }
}

async function processHTML(html, hasRationales, quizType) {
  try {
      
    html = '<!DOCTYPE html><html><head></head><body>' + html + '</body></html>';
    const doc = new DOMParser().parseFromString(html, 'text/xml');
    
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

    /* TODO: calls to obtain presigned upload URLs,
    upload images, and replace src paths could potentially be
    abstracted out, though the replacements might need to rely
    on regex instead of DOM manipulation */

    // Image handling
    const imagesForUpload = [];
    const filenamesForUpload = [];
    const images = xpath.select('//img', doc);

    // get image elements and image attributes
    for (const image of images) {
        const src = image.getAttribute('src');
        if (src) {
          const filename = src.split('/').pop();
          const fileExt = filename.split('.').pop();
          const uniqueId = uuid.v4();
          const uniqueFilename = uniqueId + "." + fileExt
          imagesForUpload.push({ name: filename, path: src, uploadName: uniqueFilename });
          filenamesForUpload.push(JSON.stringify(uniqueFilename));
        }
    }

    let responses
    let uploadData = []

    // get presigned upload URLs and public URLs from Learnosity
    if ((filenamesForUpload.length > 0) && (filenamesForUpload.length == imagesForUpload.length)) {
      responses = await sendAPIRequests(filenamesForUpload, 'get', 'upload/assets');
    }

    for (const response of responses) {
      if (response.meta.status === true) {
        uploadData.push(...response.data)
      }
    }

    let imageSrcReplacements = []

    // upload images to Learnosity
    if ((uploadData.length > 0) && uploadData.length == imagesForUpload.length) {
      for (let i = 0; i < uploadData.length; i++) {
        const response = await uploadFileToPresignedUrl(imagesForUpload[i].path, uploadData[i].content_type, uploadData[i].upload)
        if (response) {
          imageSrcReplacements.push({'oldSrc': imagesForUpload[i].path, 'newSrc': uploadData[i].public})
        }
      }
    }

    // add Learnosity public URLs to html
    if (imageSrcReplacements.length > 0) {
      for (const image of images) {
        const src = image.getAttribute('src');
        if (src) {
          for (const imageSrcReplacement of imageSrcReplacements) {
            if (imageSrcReplacement.oldSrc == src && imageSrcReplacement.newSrc) {
              image.setAttribute('src', imageSrcReplacement.newSrc);
            }
          }
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
    for (let i = 0; i < codeBlockBreaks.length; i++) {
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

    function elementCleanupAndStringify(element, stripMarks = stripMarksConfig) {
      /* function to clean up and stringfy elements
          contained in quiz-element div
       */

      let combinedHtmlContentString = ""
      const strongReg = /(<strong>|<\/strong>)/gi;
      const itemPrefixReg = /^(\s*\<.[^\>]*\>)?\s*?((?:[A-Z]|(?:[0-9]*))\.\s*)/gim;
      const itemPrefixRegReplacement = "$1";
      const correctFlagReg = /\[Correct[^\]]*\]/i

      // Get child elements (e.g., paragraphs within div)
      const topLevelElements = Array.from(element.childNodes).filter(node => node.nodeType === 1); // 1 = ELEMENT_NODE

      // Iterate over top-level elements
      for (let i = 0; i < topLevelElements.length; i++) {
        let currentElement = topLevelElements[i];

        // Check if the element contains a <pre> element
        const preElement = currentElement.getElementsByTagName('pre')[0];
        if (preElement) {
          // If the element contains a <pre> element, continue processing the pre element,
          // effectively dropping the enclosing para
          currentElement = preElement;
        }

        let htmlContentString = currentElement.toString();  // Get HTML content of element as a string

        // skip to next element if textContent is null or undefined
        if (htmlContentString == null) {
          continue;
        }

        // Perform replacements
        htmlContentString = htmlContentString.replace(strongReg, "");  // Remove strong tags
        htmlContentString = htmlContentString.replace(correctFlagReg, "") // Remove correct flags

        // remove strip marks unless config specifies not to
        if (stripMarks != 'undefined' && stripMarks != false) {
          const markReg = /(<mark>|<\/mark>)/gi;
          htmlContentString = htmlContentString.replace(markReg,"");
        }

        // Perform the itemPrefixReg replacement on the element's text content (if it's not a <pre> element)
        if (currentElement.nodeName.toLowerCase() !== 'pre') {
          htmlContentString = htmlContentString.replace(itemPrefixReg, itemPrefixRegReplacement);
        }

        combinedHtmlContentString = combinedHtmlContentString + htmlContentString
      }

      return combinedHtmlContentString;

    }

    let quizCounter = 0;
    let questionCounter = 0;
    let questions = [];

    let quizzes = [];
    let shuffleTwoOptionQuestions = config.shuffleTwoOptionQuestions;

    const quizTitleElements = xpath.select('//h1[starts-with(@class, "QuizTitle")]', doc);
    const quizSectionElements = xpath.select('//h2[starts-with(@class, "QuizSection")]', doc);

    // Loop through quiz titles
    for (let i = 0; i < quizTitleElements.length; i++) {
        let quiz;

        if (quizType === 'Diagnostic') {
          quiz = new DiagnosticQuiz();
        } else {
          quiz = new StandardQuiz();
        }

        let quizTitleElement = quizTitleElements[i];

        quizCounter++; // Increment quiz counter

        // Reset question counter and question bodies array for each new quiz
        questionCounter = 0;
        questions = [];

        quiz.title = quizTitleElement.textContent.trim();
        let nextElement = quizTitleElement.nextSibling;
        let optionCounter
        let question
        let questionStem 
        let options
        let correctOptions
        let rationales
        let difficultyLevel
        let skill

        if (quizType === 'Diagnostic') {
          skill = quiz.title.replace(/\s+/g, '-')
        }

        while (nextElement && (!nextElement.getAttribute('class') || nextElement.getAttribute('class') !== 'QuizTitle')) {
          
          // Parse quiz elements here
          let elementType = nextElement.getAttribute('data-custom-style') || nextElement.getAttribute('class');

          // skip elements that don't have data-custom-style or class attr (like [rationale] tag)
          while (nextElement && !elementType) {
              nextElement = nextElement.nextSibling; // move to next sibling
              elementType = nextElement.getAttribute('data-custom-style') || nextElement.getAttribute('class');
          }

          switch(true) {
            case /^QuizType$/.test(elementType):
                if (quizType === 'Diagnostic') {
                  throw new Error("Diagnostic quizzes must not contain QuizType elements. Please fix and rerun");
                }
                quiz.moduleType = nextElement.textContent.trim();
                break;
            case /^QuizSection/.test(elementType):
                if (quizType === 'Standard') {
                  throw new Error("Standard quizzes must not contain QuizSection elements. Please fix and rerun");
                }
                difficultyLevel = elementType.replace(/^QuizSection/, '');
                if (!["Beginner", "Intermediate", "Advanced"].includes(difficultyLevel)) {
                  throw new Error("Invalid section difficulty level value encountered. Exiting.");
                }
                break
            case /^QuestionStem$/.test(elementType):
                questionCounter++; // Increment question counter

                // if questionCounter > 1, record previous question (all but last question)
                if (questionCounter > 1) {
                  question.assignQuestionPropValues({ options, correctOptions, questionStem, shuffleTwoOptionQuestions, hasRationales, rationales, difficultyLevel, skill })
                  questions.push(question);
                }

                // initialize instance of quiz class depending on intended type
                if (quizType === 'Diagnostic') {
                  if (quizSectionElements.length != 3) {
                    throw new Error('Diagnostic quizzes must contain 3 QuizSection elements. Please fix and rerun.')
                  } else if (quizTitleElements.length != 1) {
                    throw new Error('Diagnostic quizzes must contain 1 QuizTitle element. Please fix and rerun.')
                  }
                    else {
                    question = new DiagnosticQuestion(difficultyLevel, skill);
                  }
                } else {
                  question = new StandardQuestion(hasRationales);
                }

                questionStem = elementCleanupAndStringify(nextElement);
                optionCounter = 0 // reset option counter (zero-indexed)
                options = []; // Reset array when encountering a stem
                correctOptions = []; // Reset array when encountering a stem
                rationales = []; // Reset array when encountering a stem
                break;
            case /^QuestionOption$/.test(elementType):    
                // test for correct option(s)
                const isCorrect = /\[Correct[^\]]*\]/i.test(nextElement.textContent);
                if (isCorrect) {
                  correctOptions.push(optionCounter.toString()); 
                }
                questionOption = elementCleanupAndStringify(nextElement);
                options.push({label: questionOption, value: optionCounter.toString()})
                optionCounter++ // increment option counter
                break;
            case /^QuestionRationale$/.test(elementType):
                questionRationale = elementCleanupAndStringify(nextElement);
                rationales.push(questionRationale);
                break;
          }
          nextElement = nextElement.nextSibling; // Move to next sibling
        }

        // last question: assign props and push question to array 
        question.assignQuestionPropValues({ options, correctOptions, questionStem, shuffleTwoOptionQuestions, hasRationales, rationales, difficultyLevel, skill })
        questions.push(question);

        quiz.questions = questions;
        quizzes.push(quiz);

    }
    return quizzes
  } catch (error) {
    console.error('Error reading HTML:', error);
    throw error;
  }
}

async function createQuizzes(quizzes, questionBankISBN, courseID, tagsJSON, outputPath){
  try {

    // add refIds and some tag values to questions
    for (let i = 0; i < quizzes.length; i++) {
      let quiz = quizzes[i];
      quiz.updateTag(questionBankIdTagName, questionBankISBN)
      quiz.updateTag(courseIdTagName, courseID);

      // add supplement tags, if applicable
      if (tagsJSON !== undefined) {
        for (let [key, value] of Object.entries(tagsJSON)) {
          quiz.updateOrAddTag(key, value)
        }
      }

      let questions = quiz.questions;
      let questionRefIds = await generateIDs(questions.length, 'questions');
      
      // loop through questions, adding refIds
      if (questions.length == questionRefIds.length) {
        for (k = 0; k < questions.length; k++) {
          let question = questions[k];
          let questionrefId = questionRefIds[k];
          question.questionRefId = questionrefId;
          question.updateTag(courseIdTagName, courseID);
          question.updateTag(questionBankIdTagName, questionBankISBN);

          // add supplement tags, if applicable
          if (tagsJSON !== undefined) {
            for (let [key, value] of Object.entries(tagsJSON)) {
              question.updateOrAddTag(key, value)
            }
          }

        }
      } else {
        throw new Error('Number of refIds does not match number of questions.');
      }
    }

    let activitiesJsonArr = [] // array for quizzes

    // print quiz details output and hold for user Y/N to proceed with quiz creation
    await printQuizzes(quizzes, outputPath);
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

    // generate quiz IDs
    let quizRefIds = await generateIDs(quizzes.length, 'activities');

    if (quizRefIds.length != quizzes.length) {
      throw new Error('Number of quiz refIds did not match number of quizzes.');
    }

    let questionsJsonArr = [];
    let itemsJsonArr = [];

    // loop through quizzes
    for (let i = 0; i < quizzes.length; i++) {
      let quiz = quizzes[i];
      let questions = quiz.questions;
     
      let itemRefIds = [];
      
      // generate item IDs
      itemRefIds = await generateIDs(questions.length, 'items');
           
      // prepare questions and items json arrays
      if (questions.length == itemRefIds.length) {
        for (let k = 0; k < itemRefIds.length; k++) {
          let question = questions[k];
          
          const questionJson = JSON.stringify(question.getQuestionPropsAsJSON());
          questionsJsonArr.push(questionJson);
          
          let itemRefId = itemRefIds[k];
          question.itemRefId = itemRefId;

          const itemJson = JSON.stringify(question.getItemPropsAsJson());

          itemsJsonArr.push(itemJson);

        }
      } else {
        throw new Error('Number of questions did not match number of item refIds.');
      }

      // prepare quizzes
      quiz.refId = quizRefIds[i];

      const activity = JSON.stringify(quiz.getQuizPropsAsJSON());

      activitiesJsonArr.push(activity);
    
    }
    
    let callapi

    // generate questions
    callapi = await sendAPIRequests(questionsJsonArr, 'set', 'questions');

    // generate items
    callapi = await sendAPIRequests(itemsJsonArr, 'set', 'items');

    callapi = await sendAPIRequests(activitiesJsonArr, 'set', 'activities');

    console.log("Quizzes successfully created!");

    printRefIds(activitiesJsonArr, outputPath);

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
  } catch (error) {
    console.error('Error generating IDs: ', error);
    throw error; // Rethrow the error to propagate it up the chain
  }
}

async function printQuizzes(quizzes, docPath) {
    try {        
        const outputFilePath = path.join(docPath, 'review-file.txt');
        const outputStream = fs.createWriteStream(outputFilePath);

        for (let i = 0; i < quizzes.length; i ++) {
            const quiz = quizzes[i];
            const quizTags = JSON.stringify(quiz.getQuizPropsAsJSON().tags);
            outputStream.write(`Quiz ${i + 1}:\n`);
            outputStream.write(`Title: ${quiz.title}\n`);
            outputStream.write(`Type: ${quiz.moduleType || "none"}\n`);
            outputStream.write(`Quiz ${i + 1} tags:\n`);
            outputStream.write(`\t${quizTags}\n`);
            for (let k = 0; k < quiz.questions.length; k ++) {
                const question = quiz.questions[k];
                const questionProps = JSON.stringify(question.getQuestionPropsAsJSON());
                const itemTags = JSON.stringify(question.getItemPropsAsJson().tags);
                outputStream.write(`\tQuestion ${k + 1}:\n`);
                outputStream.write(`\t${questionProps}\n`);
                outputStream.write(`\tQuestion ${k + 1} tags:\n`);
                outputStream.write(`\t${itemTags}\n`);
            }
            outputStream.write('\n');
        }

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

async function main() {
  const enableDiagnostic = config.enableDiagnostic;
  const allowRationaleToggleInStandardQuizzes = config.allowRationaleToggleInStandardQuizzes;
  const [src, quizType, questionBankISBN, courseID, hasRationales, addTags, tagsFile] = await getUserInput(enableDiagnostic, allowRationaleToggleInStandardQuizzes);
  const outputPath = src.substring(0, src.lastIndexOf('/'));
  let tagsData = '';

  if (tagsFile != '') {
    tagsData = await readJSONFromFile(tagsFile);
  }

  const timestamp = Date.now();
  const temp_dir = path.join(outputPath, `temp_media_${timestamp}`);

  fs.mkdir(temp_dir, { recursive: true }, (err) => {
    if (err) {
      console.error('Error creating directory:', err);
    }
  });

  const html = await convertDOCXtoHTML(src, temp_dir);
  const quizzes = await processHTML(html, hasRationales, quizType)

  createQuizzes(quizzes, questionBankISBN, courseID, tagsData, outputPath);  

  fs.rmdir(temp_dir, { recursive: true }, (err) => {
    if (err) {
      console.error('Error removing directory:', err);
    }
  });

}

main();


