// Vanilla node.js example with no dependencies required.
const Learnosity = require('learnosity-sdk-nodejs');
const config = require('../config'); // Load consumer key & secret from config.js
const uuid = require('uuid');        // Load the UUID library
const fs = require('fs');

/*
* NOTE: 
* For this example native node Fetch API (still experimental) needs to be 
* enabled, and then the following global functions and classes are made 
* available: fetch(), Request, Response, Headers, FormData.
* To enable Fetch in node you should use v18 or greater.
* Run 'node --experimental-fetch' or 
* 'node <FILENAME.js> --experimental-fetch' in the terminal to enable
*/


// Instantiate the SDK
const learnositySdk = new Learnosity();

// Set the web server domain
const domain = 'localhost';


let requestBody = `
{
    "include": {
      "activities": ["dt_updated"]
    },
    "status": ["archived"],
    "sort_field": "updated",
    "limit": 1000
  }`

function createRequestForm(requestBody) {

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
    requestBody,
      'get'
  );

  const form = new FormData();

  form.append("security", dataAPIRequest.security);
  form.append("request", dataAPIRequest.request);
  form.append("action", dataAPIRequest.action);

  return form
}

let requestForm = createRequestForm(requestBody);

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

const responses = [];

async function recursiveAPICall(url, form) {
  return makeDataAPICall(url, form)
    .then(response => {
      responses.push(response);

      // Check for 'next' metadata field
      if (response.meta && response.meta.next) {
        let requestObject = JSON.parse(requestBody);
        requestObject.next = response.meta.next;
        requestBody = JSON.stringify(requestObject);

        requestForm = createRequestForm(requestBody);
        
        // If the metadata field is present, recursively call the function
        return recursiveAPICall(url, requestForm);

      } else {
        // If the metadata field is not present, write the responses to a file
        const jsonData = JSON.stringify(responses, null, 2);

        fs.writeFile('output.json', jsonData, (err) => {
          if (err) {
            console.error('Error writing file', err);
          } else {
            console.log('Successfully wrote file');
          }
        });
      }
    })
    .catch(error => {
      console.error('Error making API call', error);
    });
}

recursiveAPICall('https://data.learnosity.com/v2023.1.LTS/itembank/activities', requestForm);

