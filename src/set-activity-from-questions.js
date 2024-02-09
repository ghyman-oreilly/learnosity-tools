
const Learnosity = require('learnosity-sdk-nodejs');
const config = require('./config'); // Load consumer key & secret from config.js
const uuid = require('uuid');        // Load the UUID library
const fs = require('fs');
const fsAsync = require('fs/promises');
const path = require('path');
const inquirer = require('inquirer');


async function getUserInput(){

  const questions = [
    {
      type: 'input',
      name: 'dir',
      default: './',
      message: "Please provide the filepath of this module's question JSON files: ",
    },
    {
      type: 'input',
      name: 'title',
      message: "What is the name of the activity?",
    },
    {
      type: 'list',
      name: 'quizType',
      message: "What type of quiz activity is this?",
      choices: ["Formative", "Summative"]
    },
    {
      type: 'input',
      name: 'questionBankFPID',
      message: "What is the Question Bank FPID?",
    },
    {
      type: 'input',
      name: 'courseFPID',
      message: "What is the Course FPID?",
    },
  ];

  const answers = await inquirer
  .prompt(questions)
  .then((answers) => {
    return {
      dir: answers['dir'],
      title: answers['title'],
      quizType: answers['quizType'],
      questionBankFPID: answers['questionBankFPID'],
      courseFPID: answers['courseFPID'],
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

async function readFilesSync(dir) {
  const files = await fsAsync.readdir(dir);
  const questionRefIds = [];
  const extension = '.json';
  const processedFiles = [];

  for (const file of files) {
    if (path.extname(file).toLowerCase() === extension) {

      const filepath = path.resolve(dir, file);
      const stat = fs.statSync(filepath);
      let contents = fs.readFileSync(filepath).toString();
      const isFile = stat.isFile();
      
      const ref_id = await generateID('questions');
      questionRefIds.push(ref_id);

      contents = `{
              "type": "mcq",
              "reference": "${ref_id}",
              "data": ${contents}
          }` 

      if (isFile) processedFiles.push(contents);

    }
  }

  const questions = "[" + processedFiles.join(',') + "]"

  return {
    questionRefIds: questionRefIds, 
    questions: questions
  }
}

async function setQuestions(dir){
  dir = dir
  const readFiles = await readFilesSync(dir);
  const questionRefIds = readFiles.questionRefIds
  let questions = readFiles.questions;
  questions = `{"questions": ${questions}}`

  let callapi = await callDataAPI(questions, 'set', 'questions');

  return questionRefIds

}

async function setItems(dir){
  dir = dir;
  const questionRefs = await setQuestions(dir);
  let items = [];
  const itemRefIds = [];
  
  for (i = 0; i < questionRefs.length; i++) {
    const questionRef = questionRefs[i];
    const itemRef = await generateID('items');
    const item = `{
            "reference": "${itemRef}",
            "metadata": null,
            "definition": {
                "widgets": [
                    {
                        "reference": "${questionRef}"
                    }
                ]
            },
            "status": "published",
            "questions": [
                {
                    "reference": "${questionRef}"
                }
            ],
            "tags": {
              "Publisher": [
                  "O'Reilly Media"
              ]
            }
        }`
    items.push(item);
    itemRefIds.push(itemRef);
  }
  
  items = '{"items":[' + items.join(',') + ']}'
  
  await callDataAPI(items, 'set', 'items');

  const output = "Created items with IDs as follows: \n" + JSON.stringify(itemRefIds)

  await writeOutput(dir, output)

  console.log(output)

  return itemRefIds;
}

async function setActivity(){
  let userinput = await getUserInput();
  const dir = userinput.dir;
  const title = userinput.title;
  const quizType = userinput.quizType;
  const questionBankFPID = userinput.questionBankFPID;
  const courseFPID = userinput.courseFPID;

  let itemRefIds = await setItems(dir);
  itemRefIds = '"' + itemRefIds.join('","') + '"';
  
  const activityRef = await generateID('activities');
  
  const activity = `{"activities": [
      {
          "title": "${title}",
          "reference": "${activityRef}",
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
                  "${questionBankFPID}"
              ],
              "Course FPID": [
                  "${courseFPID}"
              ]
          }
      }
  ]}`
  
  await callDataAPI(activity, 'set', 'activities');

  const output = "\nThe reference ID for the activity is: " + activityRef

  await writeOutput(dir, output)

  console.log(output)
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
    .catch(error => console.log('there was an error', error))
  
  return response
}

async function generateID(endpoint) {
  
  let ref_id = uuid.v4();
  let tries = 0
  
  const checkID = async function(ref_id, endpoint) {
    const body = `{"references":["${ref_id}"]}`
    const response = await callDataAPI(body, 'get', endpoint);
    const records = response.meta.records;
    return records
  }

  let records = await checkID(ref_id, endpoint);

  while(records != 0 && tries <= 5){
    ref_id = uuid.v4();
    records = await checkID(ref_id, endpoint);
    tries++;

    if (tries == 5){
      console.log("Unable to produce a unique ID in 5 tries. Exiting...")
      return
    }
  }

  return ref_id
}

async function writeOutput(filepath, output) {

  const outputPath = filepath + '/output.txt' 

  fs.appendFile(outputPath, output, function (err) {
    if (err) throw err;
  });
}

setActivity();