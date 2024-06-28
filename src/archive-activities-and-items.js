
const getUserInput = require('./shared/get-user-input');
const processFilepath = require('./shared/process-file-path');
const readReferenceIdsFromTxtFile = require('./shared/read-ids-from-txt-file');
const getEntities = require('./shared/get-entities');
const getItemReferenceIdsFromActivities = require('./shared/get-item-ref-ids-from-activities');
const printToFile = require('./shared/print-to-file');
const promptUserToConfirmContinue = require('./shared/prompt-to-confirm-continue');
const updateEntitiesStatus = require('./shared/update-entity-status');


async function removeMultiactivityItemsFromList(itemRefIds){
  try {
    const scrubbedItemRefIds = []
    for (const itemRefId of itemRefIds) {
      const payloadObject = {
        "item_references": {
          "all": [ itemRefId ]
        }
      }
      const itemActivities = await getEntities({entityType: "activities", customPayload: payloadObject});
      if (itemActivities.length > 1) {
        console.log(`Item with the follow ref ID is used in more than one activity. Skipping it: ${itemRefId}`)
      } else {
        scrubbedItemRefIds.push(itemRefId)
      }
    }
    return scrubbedItemRefIds
  } catch(error) {
    console.error(`Error checking item activities: `, error);
    throw error;
  }
}

async function main() {
  const questions = [
      {
        type: 'input',
        name: 'idsSrc',
        message: 'Please provide the filepath of the text file containing ACTIVITY ref IDs (one ID per line). This script will archive those activities and all of their items: ',
      }
    ];
	const answers = await getUserInput(questions);
	const idsFilepath = answers.idsSrc;
	const dir = await processFilepath(idsFilepath);
	const activityRefIds = await readReferenceIdsFromTxtFile(idsFilepath);
	const activities = await getEntities({entityType: "activities", refIds: activityRefIds});
 	const itemRefIds = getItemReferenceIdsFromActivities(activities);
  const scrubbedItemRefIds = await removeMultiactivityItemsFromList(itemRefIds);
  
  // TODO: use hashed `created_by` check to prevent archiving entities created by others (incl quiz service)??

	let reviewTxt = `Activities to be archived: ${activityRefIds}\n\nItems to be archived: ${scrubbedItemRefIds}`
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

  let archiveActivitiesCallResponse = await updateEntitiesStatus("activities", activityRefIds, "archived");
	let archiveItemsCallResponse = await updateEntitiesStatus("items", scrubbedItemRefIds, "archived");

	if (archiveItemsCallResponse.meta.status === true) {
	console.log(`Items succesfully archived...`)
	} else {
	console.log(`API response (see below) indicates items may not have been successfully archived. Please check...\n${JSON.stringify(archiveItemsCallResponse)}`)
	}

	if (archiveActivitiesCallResponse.meta.status === true) {
	console.log(`Activities succesfully archived...`)
	} else {
	console.log(`API response (see below) indicates activities may not have been successfully archived. Please check...\n${JSON.stringify(archiveActivitiesCallResponse)}`)
	}
}

main();
