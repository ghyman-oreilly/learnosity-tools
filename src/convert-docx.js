const inquirer = require('inquirer');
const pandoc = require('node-pandoc-promise');
const xpath = require('xpath');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom')

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
  const output = filepaths.output; 

  // Arguments in either a single String or as an Array:
  // args = ['-f', 'docx+styles', '-t', 'html5', '-o', output + '/' + 'output.html'];
  args = ['-f', 'docx+styles', '-t', 'html5'];
 
  // Call pandoc
  const doc = await pandoc(src, args);

  return doc
}

async function readHTML(){
  let source = await convertDOCXtoHTML();
  source = '<!DOCTYPE html><html><head></head><body>' + source + '</body></html>' // we need valid, complete HTML
  const doc = new DOMParser().parseFromString(source, 'text/xml')
  const stems = xpath.select('//div[@data-custom-style="QuestionStem"]', doc);
  
  for (i = 0, question = ''; i < stems.length; i++) {
    const stem = stems[i];
    const precedingSiblingsCount = i + 1;
    const optionsAndRationales = xpath.select('.//following-sibling::div[@data-custom-style="QuestionOption" and count(preceding-sibling::div[@data-custom-style="QuestionStem"])="' + precedingSiblingsCount + '"]|.//following-sibling::div[@data-custom-style="QuestionRationale"  and count(preceding-sibling::div[@data-custom-style="QuestionStem"])="' + precedingSiblingsCount + '"]', stem);
    
    const stemString = stem.toString();
    question = stemString

    for (k = 0; k < optionsAndRationales.length; k++) {
      const optionsOrRationaleString = optionsAndRationales[k].toString();
      question = question + optionsOrRationaleString;
    }

  }


}

readHTML();
