// Vanilla node.js example with no dependencies required.
const Learnosity = require('learnosity-sdk-nodejs');
const config = require('./config'); // Load consumer key & secret from config.js

/*
* NOTE: 
* For this example native node Fetch API (still experimental) needs to be 
* enabled, and then the following global functions and classes are made 
* available: fetch(), Request, Response, Headers, FormData.
* To enable Fetch in node you should use v18 or greater.
* Run 'node --experimental-fetch' or 
* 'node <FILENAME.js> --experimental-fetch' in the terminal to enable
*/

async function refIds() {
  // prompt user for activity refs/ids
  const readline = require('readline');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const prompt = (query) => new Promise((resolve) => rl.question(query, resolve));

  try {
    const refIds = await prompt("Provide the ref ids of the activities you wish to query (comma delimited): ");
    return refIds
    rl.close();
  } catch (e) {
    console.error("Unable to prompt", e);
  }
return refIds
};

async function splitRefIds() {
  // split string of refIds
  refIdString = await refIds();
  refIds = refIdString.split(',');
  console.log(refIds)
  return refIds
}

async function getActivityItems() {
  // get list of refIds
  refIdsArray = await splitRefIds();

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
    /* Request details - build your request object for the Data API here - 
    dataAPIRequest.request 
    This example fetches activities from our demos Item bank w/ the following references: */
    {
        references : refIdsArray
    },
      // Action type - dataAPIRequest.action
      'get'
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
  
  /* Now call the function, passing in the desired endpoint (itembank/activities in this case), and pass in the fromData object (saved to the variable called 'form' here), which contains the requestParams: */

  makeDataAPICall('https://data.learnosity.com/v2022.1.LTS/itembank/activities', form)
    .then(response => {
    console.log(JSON.stringify(response.data[0], ["title"], 2))
    console.log(JSON.stringify(response.data[0]?.data.items, ["reference"], 2))
    })
    .catch(error => console.log('there was an error', error))

}

getActivityItems();