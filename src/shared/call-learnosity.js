const Learnosity = require('learnosity-sdk-nodejs');
const config = require('../config'); // Load consumer key & secret from config.js
const fs = require('fs');


async function sendAPIRequests(items, action, endpoint) {
    const maxItems = 50; // Maximum number of items per request
    let callBody
    let responses = []

    for (let i = 0; i < items.length; i += maxItems) {
        // Get the current chunk of items
        const chunk = items.slice(i, i + maxItems);
        if (endpoint.includes('upload')){
          callBody = `{"subkeys": [${chunk}]}`
        } else {
          callBody = `{"${endpoint}": [${chunk}]}`
        }     

        // Make the API call with the current chunk
        try {
            const response = await callDataAPI(callBody, action, endpoint);
            responses.push(response)
        } catch (error) {
            console.error('Error calling API:', error);
        }
    }
    return responses
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
    .catch(error => console.log('There was an error calling the Learnosity API: ', error))
  
  return response
}

async function getPublicUrl(publicUrl) {
  const response = await fetch(publicUrl);
  return response
}

async function uploadFileToPresignedUrl(filePath, contentType, presignedUrl) {
    const fileData = fs.readFileSync(filePath); // Read file as binary data

    try {
        const response = await fetch(presignedUrl, {
            method: 'PUT',
            body: fileData,
            headers: {
                'Content-Type': contentType // Ensure correct content type
            }
        });

        if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
        }
        return response
    } catch (error) {
        console.error('Error uploading file:', error);
    }
}

module.exports = { callDataAPI, sendAPIRequests, uploadFileToPresignedUrl, getPublicUrl };