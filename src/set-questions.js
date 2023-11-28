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
  'questions',

  // Security details - dataAPIRequest.security 
  {
      consumer_key: config.consumerKey, // Your actual consumer key goes here 
      domain:       domain, // Your actual domain goes here
      user_id:      '110961' // GH user id
  },
  // secret 
  config.consumerSecret, // Your actual consumer secret here
  /* Request details - build your request object for the Data API here - 
  dataAPIRequest.request */
  {
      "questions": [
          {
          "type": "mcq",
          "reference": "test_098234234",
          "data": {
            "multiple_responses": false,
          "options": [{"label":"Being able to catch all the bugs in production","value":"0"},{"label":"Having 100% test coverage","value":"1"},{"label":" Software working as it's intended\nto","value":"2"},{"label":"Having a QA team performing manual testing before the releases","value":"3"}],
          "stimulus": "Which is a sign of having high-quality software?",
          
          "validation": {
            "scoring_type": "exactMatch",
            "valid_response": {
              "score": 1,
              "value": ["2"]
            }
          },
          "ui_style": {
            "type": "horizontal"
          },
          "metadata": {
            "distractor_rationale_response_level": ["Being able to prevent bugs from going into the software, instead of\ncaching all of them in production, is a sign of having high-quality\nsoftware. See “Quality Software Fundamentals.”","Having 100% test coverage doesn't mean you have high quality. Test\ncoverage is a measure that can be used to identify parts of the code\nthat are not being tested, but having all parts of the code going\nthrough a test runner doesn't speak for the quality of the tests. See\n“Quality Software Fundamentals.”","Quality is about making sure the software is working as it's intended\nto and that we're not breaking anything that already existed when we add\nnew functionality or make changes to the software. See “Quality Software\nFundamentals.”","Manual testing can be useful in some types of tests (like exploratory\nand usability tests), but it doesn't mean that we have high quality.\nOther types of tests need to be implemented and automated, and run\ncontinuously, to support the software in achieving high quality. See\n“Quality Software Fundamentals.”"]
          },
          "shuffle_options": true
          }
        }
      ],
      "organisation_id": "956"
  },
    // Action type - dataAPIRequest.action
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

makeDataAPICall('https://data.learnosity.com/v2022.1.LTS/itembank/questions', form)
  .then(response => {
  console.log(JSON.stringify(response.data[0], ["title"], 2))
  console.log(JSON.stringify(response.data[0]?.data.items, ["reference"], 2))
  })
  .catch(error => console.log('there was an error', error))



