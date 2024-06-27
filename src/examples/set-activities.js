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
  {
    "activities": [
        {
            "title": "Test Activity",
            "reference": "test_1234109280",
            "status": "unpublished",
            "data": {
                "items": [
                    "ORE_b554a814-73ac-4b9d-8d6d-e3800966e478",
                    "test_098123091231"
                ],
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
    ]
  },
    'set'
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

makeDataAPICall('https://data.learnosity.com/v2023.1.LTS/itembank/activities', form)
  .then(response => {
  console.log(response)
  })
  .catch(error => console.log('there was an error', error))



