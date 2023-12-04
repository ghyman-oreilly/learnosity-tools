
const Learnosity = require('learnosity-sdk-nodejs');
const config = require('./config'); // Load consumer key & secret from config.js
const uuid = require('uuid');        // Load the UUID library
const fs = require('fs');
const path = require('path');

// TODO: throughout, use promises (response from data API) to avoid use of settimeout
// TODO: user input parameters: activity title, tags, etc.

async function readFilesSync(dir) {
  const files = [];
  const questionRefIds = [];

  fs.readdirSync(dir).forEach(filename => {
    const filepath = path.resolve(dir, filename);
    const stat = fs.statSync(filepath);
    let contents = fs.readFileSync(filepath).toString()
    const isFile = stat.isFile();
    
    ref_id = uuid.v4() + '_GH'
    questionRefIds.push(ref_id);

    contents = `{
            "type": "mcq",
            "reference": "${ref_id}",
            "data": ${contents}
        }` 

    if (isFile) files.push(contents);
  });

  const questions = "[" + files.join(',') + "]"
  
  return {
    questionRefIds: questionRefIds, 
    questions: questions
  }
}

async function setQuestions(){
  const readFiles = await readFilesSync('/Users/ghyman/Downloads/Module 1')
  const questionRefIds = readFiles.questionRefIds
  let questions = readFiles.questions;
  questions = `{"questions": ${questions}}`

  let callapi = await callDataAPI(questions, 'questions');

  return questionRefIds

}

async function setItems(){

  const questionRefs = await setQuestions();
  let items = [];
  const itemRefIds = [];
  
  for (i = 0; i < questionRefs.length; i++) {
    const questionRef = questionRefs[i];
    const itemRef = uuid.v4() + '_GH';
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
            "tags": {}
        }`
    items.push(item);
    itemRefIds.push(itemRef);
  }
  
  items = '{"items":[' + items.join(',') + ']}'
  
  setTimeout(() => {
    callDataAPI(items, 'items');
  }, 1000)

  return itemRefIds;

}

async function setActivity(){
  let itemRefIds = await setItems();
  itemRefIds = '"' + itemRefIds.join('","') + '"';
  
  const activityRef = uuid.v4() + '_GH';
  
  const activity = `{"activities": [
      {
          "title": "Test Activity",
          "reference": "${activityRef}",
          "status": "unpublished",
          "data": {
              "items": [${itemRefIds}],
              "config": {
                  "regions": "main"
              },
              "rendering_type": "assess"
          },
          "tags": {
              "Quiz Type": [
                  "Formative"
              ],
              "Publisher": [
                  "O'Reilly Media"
              ]
          }
      }
  ]}`
  
  setTimeout(() => {
    callDataAPI(activity, 'activities');
  }, 2000)
  
  console.log("The reference ID for the activity is: " + activityRef)
  return activityRef
}

async function callDataAPI(body, endpoint){
  return new Promise((resolve) => {
    setTimeout(() => {
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
        
        'set' // request action
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

      makeDataAPICall(endpoint, form)
        .then(response => {
        console.log(response)
        })
        .catch(error => console.log('there was an error', error))

      resolve();
    }, 200);
  });
  
}

setActivity();




