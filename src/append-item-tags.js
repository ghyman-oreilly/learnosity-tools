
const getUserInput = require('./shared/get-user-input');
const processFilepath = require('./shared/process-file-path');
const readReferenceIdsFromTxtFile = require('./shared/read-ids-from-txt-file');
const getEntities = require('./shared/get-entities');
const getItemReferenceIdsFromActivities = require('./shared/get-item-ref-ids-from-activities');
const printToFile = require('./shared/print-to-file');
const promptUserToConfirmContinue = require('./shared/prompt-to-confirm-continue');
const appendTagsToEntities = require('./shared/append-tags-to-entities');
const readJSONFromFile = require('./shared/read-json-from-file');

async function main() {
  const questions = [
      {
        type: 'input',
        name: 'idsSrc',
        message: 'Please provide the filepath of the text file containing the ACTIVITY ref IDs for the ITEMS to which you wish to append tags (one ID per line): ',
      },
	  {
        type: 'input',
        name: 'tagsSrc',
        message: 'Please provide the filepath of the JSON file containing the tags you wish to append to the items (file must contain valid JSON): ',
      }
    ];
	const answers = await getUserInput(questions);
	let idsFilepath = answers.idsSrc;
	let tagsFilepath = answers.tagsSrc;
	const dir = await processFilepath(idsFilepath);
	const activityRefIds = await readReferenceIdsFromTxtFile(idsFilepath);
	const tags = await readJSONFromFile(tagsFilepath);
	let activities = await getEntities(activityRefIds, "activities");
	let itemRefIds = getItemReferenceIdsFromActivities(activities);
	// let items = await getEntities(itemRefIds, "items"); // this could be used if we were going to add the stems to the confirmation file, say

	let reviewTxt = `Activities with items to be tagged: ${activityRefIds}\n\nItems to be tagged: ${itemRefIds}\n\nTags to be appended:\n${JSON.stringify(tags)}`
	const unixTimestampMillis = Date.now();
	const reviewFilename = `review-file-${unixTimestampMillis}.txt`
 
	const { confirmationFilePrinted, confirmationFilepath } = await printToFile(reviewTxt, dir, reviewFilename);

	if (confirmationFilePrinted && confirmationFilepath) {
		console.log(`Confirmation file written to ${confirmationFilepath}`);
	}
    
	const continueMessage = "Please review the confirmation file and indicate whether you wish to continue:"
	const continueFlag = await promptUserToConfirmContinue(continueMessage);

    if (continueFlag != 'Yes') {
      console.log("Exiting...");
      process.exit();
    }

	let appendCallResponse = await appendTagsToEntities("items", itemRefIds, tags)

	if (appendCallResponse.meta.status === true) {
	console.log(`Items tags succesfully updated...`)
	} else {
	console.log(`API response (see below) indicates item tags may not have been successfully updated. Please check...\n${JSON.stringify(appendCallResponse)}`)
	}

}

main();
