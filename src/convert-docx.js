const inquirer = require('inquirer');
const pandoc = require('node-pandoc-promise');
const xpath = require('xpath');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom')
const fs = require('fs');

async function getUserInput(){

  const questions = [
    {
      type: 'input',
      name: 'src',
      message: "Please provide the filepath of the DOCX file to convert: ",
    }
  ];

  const answers = await inquirer
  .prompt(questions)
  .then((answers) => {
    return {
      src: answers['src'],
    }
  })
  .catch((error) => {
    if (error.isTtyError) {
      // Prompt couldn't be rendered in the current environment
    } else {
      // Something else went wrong
    }
  });

  return answers

}

async function processFilepath(){
  const userinput = await getUserInput();
  const src = userinput.src;
  const output = src.substring(0, src.lastIndexOf("/"));

  return {
    src: src,
    output: output
  }
}

async function convertDOCXtoHTML(){
  
  const filepaths = await processFilepath();
  const src = filepaths.src;
  const path = filepaths.output; 

  // Arguments in either a single String or as an Array:
  // args = ['-f', 'docx+styles', '-t', 'html5', '-o', output + '/' + 'output.html'];
  args = ['-f', 'docx+styles', '-t', 'html5', '--wrap=none'];
 
  // Call pandoc
  const doc = await pandoc(src, args);

  return {
    doc: doc,
    path: path
  }
}

async function readHTML(){
  let docinfo  = await convertDOCXtoHTML(); // TODO: these var names are confusing as heck; must fix!
  let source = docinfo.doc;
  let path = docinfo.path;

  source = '<!DOCTYPE html><html><head></head><body>' + source + '</body></html>' // we need valid, complete HTML
  const doc = new DOMParser().parseFromString(source, 'text/xml')
  const stems = xpath.select('//div[@data-custom-style="QuestionStem"]/*', doc);
  let questionStrings = []
  const codeBlocks = xpath.select('//span[@data-custom-style="Code Block Char"]', doc);
  const codeBlockBreaks = xpath.select('//span[@data-custom-style="Code Block Char"]/br', doc);
  const inlineCode = xpath.select('//span[@data-custom-style="Inline Code Char"]', doc);

  // TODO: add procedure to remove all the custom style spans once they're no longer needed

  // handling for manual breaks within code blocks
  for (i = 0; i < codeBlockBreaks.length; i++) {
    let codeBlockBreak = codeBlockBreaks[i];
    codeBlockBreak.parentNode.removeChild(codeBlockBreak);
  }

  // handling for Code Block Char spans
  for (i = 0; i < codeBlocks.length; i++) {
    let newBlock = doc.createElement("pre");
    let codeBlock = codeBlocks[i];
    let parent = codeBlock.parentNode;

    // wrap codeBlock in pre tag
    codeBlock.parentNode.insertBefore(newBlock, codeBlock);
    
    while (codeBlock.firstChild) { 
      newBlock.appendChild(codeBlock.firstChild); // move codeBlock (span) children, one at a time, to new pre block
    } 

    codeBlock.parentNode.removeChild(codeBlock); // remove original codeBlock span

    // replace encompassing p tag
    if (parent.nodeName == "p") {
      parent.parentNode.insertBefore(newBlock, parent);
      parent.parentNode.removeChild(parent);
    }

  }

  // handling for inline code 
  for (i = 0; i < inlineCode.length; i++) {
    let newBlock = doc.createElement("code");
    let code = inlineCode[i];

    // wrap inline code in code tag
    code.parentNode.insertBefore(newBlock, code);

    while (code.firstChild) { 
      newBlock.appendChild(code.firstChild); // move code (span) children, one at a time, to new code block
    } 

    code.parentNode.removeChild(code); // remove original code span
  }

  for (i = 0, question = ''; i < stems.length; i++) {
    const stem = stems[i];
    const precedingSiblingsCount = i + 1;
    const options = xpath.select('//div[@data-custom-style="QuestionStem"]/following-sibling::div[@data-custom-style="QuestionOption" and count(preceding-sibling::div[@data-custom-style="QuestionStem"])="' + precedingSiblingsCount + '"]/*', stem);
    const rationales = xpath.select('//div[@data-custom-style="QuestionStem"]/following-sibling::div[@data-custom-style="QuestionRationale"  and count(preceding-sibling::div[@data-custom-style="QuestionStem"])="' + precedingSiblingsCount + '"]/*', stem);

    let stemString = stem.toString();
    let optionObjs = [];
    let correctOptions = [];
    let rationaleArr = [];
    let strongReg = /(<strong>|<\/strong>)/gi;
    let correctFlagReg = /([\[]Correct.*?\])/i;
    let itemPrefixReg = /^(\s*\<.[^\>]*\>)?\s*?((?:[A-Z]|(?:[0-9]*))\.\s*)/gim;
    const itemPrefixRegReplacement = "$1";
    let multipleResponses = false

    for (k = 0; k < options.length; k++) {
      let optionString = options[k].toString();
      const indexString = k.toString();
      
      // test whether option is marked as a correct answer
      const isCorrect = new RegExp(correctFlagReg).test(optionString);

      if (isCorrect) {
        correctOptions.push(indexString);
        optionString = optionString.replace(correctFlagReg,"");
      }

      stemString = stemString.replace(itemPrefixReg, itemPrefixRegReplacement);
      optionString = optionString.replace(strongReg,"");
      optionString = optionString.replace(itemPrefixReg, itemPrefixRegReplacement);

      const optionObj = {label: optionString, value: indexString};
      optionObjs.push(optionObj);
    }

    for (l = 0; l < rationales.length; l++) {
      let rationalesString = rationales[l].toString();
      rationalesString = rationalesString.replace(itemPrefixReg,"");
      const indexString = l.toString();
      rationaleArr.push(rationalesString);
    }
    
    // update multiple responses flag
    if (correctOptions.length > 1) {
      multipleResponses = true
    }

    // write to JSON with slug/template
    let stemJson = JSON.stringify(stemString)
		let optionObjsJson = JSON.stringify(optionObjs)
		let rationalesJson = JSON.stringify(rationaleArr)
		let correctOptionsJson = JSON.stringify(correctOptions)

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

    questionStrings.push(quizJson);
  }

  return {
    questionStrings: questionStrings,
    path: path
  }   

}

async function writeToFile(){
  let html = await readHTML();
  let questionStrings = html.questionStrings;
  let path = html.path;

  for (i = 0; i < questionStrings.length; i++) {
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

}

writeToFile();
