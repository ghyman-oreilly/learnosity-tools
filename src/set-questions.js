// Vanilla node.js example with no dependencies required.
const Learnosity = require('learnosity-sdk-nodejs');
const config = require('./config'); // Load consumer key & secret from config.js
const uuid = require('uuid');        // Load the UUID library

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

// Generate a reference ID - CURRENTLY UNUSED
const ref_id = uuid.v4();

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
    "questions": [
        {
            "type": "mcq",
            "reference": "test_098123091231a",
            "data": {
                "options": [
                    {
                        "value": "0",
                        "label": "Mark will have more apples and more oranges than Lucy."
                    },
                    {
                        "value": "1",
                        "label": "Bob will have less apples and less oranges than Sally."
                    },
                    {
                        "value": "2",
                        "label": "John will have more apples than Lucy, but Lucy has more oranges."
                    },
                    {
                        "value": "3",
                        "label": "John will have more oranges than Lucy, but Lucy has more apples."
                    }
                ],
                "stimulus": "This is the stem",
                "type": "mcq",
                "validation": {
                    "scoring_type": "exactMatch",
                    "valid_response": [
                        {
                            "value": [
                                "0"
                            ],
                            "score": 1
                        }
                    ]
                }
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

makeDataAPICall('https://data.learnosity.com/v2023.1.LTS/itembank/questions', form)
  .then(response => {
  console.log(response)
  })
  .catch(error => console.log('there was an error', error))



