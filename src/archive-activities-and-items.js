const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
const Learnosity = require('learnosity-sdk-nodejs');
const { callDataAPI } = require('./shared/call-learnosity');


async function getUserInput() {
  try {
    const questions = [
      {
        type: 'input',
        name: 'src',
        message: 'Please provide the filepath of the text file containing your activity ref IDs (one per line): ',
      }
    ];

    const answers = await inquirer.prompt(questions);

    return {
      src: answers['src'],
    };
  } catch (error) {
    console.error('Error getting user input:', error);
    throw error; // Rethrow the error to propagate it up the chain
  }
}

async function processFilepath() {
  try {
    const userinput = await getUserInput();

    // Check if userinput is not null or undefined before accessing its properties
    if (userinput && userinput.src) {
      const src = userinput.src;
      const output = src.substring(0, src.lastIndexOf('/'));

      console.log(src)
      console.log(output)
      exit();

      return {
        src: src,
        output: output,
      };
    } else {
      throw new Error('Invalid user input');
    }
  } catch (error) {
    console.error('Error processing filepath:', error);
    throw error;
  }
}

async function readReferenceIdsFromFile(filepath) {
  try {
    
    if (filepath) {
        const src = filepath;

        const contents = fs.readFileSync(src).toString()
        const referenceIds = contents.split('\n')
          .map(id => id.trim())     // Trim whitespace from each ID
          .filter(id => id !== '')  // Remove any empty IDs
          .map(id => `"${id}"`);    // Wrap each ID in double quotes

        return referenceIds
    } else {
        throw new Error('Invalid filepath');
    }
  } catch (error) {
    console.error('Error reading reference IDs from file:', error);
    throw error;
  }
}

async function getEntities(refIds, entityType) {
  try {
    const payloadBody = `{"references": [${refIds}]}`;
    let entities = await callDataAPI(payloadBody, "get", entityType);
    entities = entities.data;

    return entities
  } catch (error) {
    console.error(`Error returning ${entityType} via call to Learnosity: `, error);
    throw error;
  }
}

function getItemReferenceIds(activities) {
  try {
    let itemRefs = [];

    activities.forEach(activity => {
      items = activity.data.items;
      items.forEach(item => {
        itemRefs.push(`"${item}"`);
      })
    });
    
    return itemRefs
  } catch (error) {
    console.error('Error obtaining item reference IDs from activity bodies: ', error);
    throw error;
  }
}

async function archiveEntities(entities, entityType) {
    try {
      let updatedEntities = [];

      entities.forEach(entity => {
        let updatedEntity = entity;
        updatedEntity.status = 'archived';
        updatedEntities.push(updatedEntity);
      });
      updatedEntities = JSON.stringify(updatedEntities);
      let payloadBody = `{"${entityType}": ${updatedEntities}}`;
      const apiResponse = await callDataAPI(payloadBody, "set", entityType);
      
      return apiResponse

    } catch (error) {
      console.error(`Error archiving ${entityType} via Learnosity API: `, error);
      throw error;
    }
}

async function printRefs(entityType, refIds, dir) {
    try {        
        const outputFilePath = path.join(dir, 'ref-ids-to-remove.txt');
        const outputStream = fs.createWriteStream(outputFilePath);

        outputStream.write(`${entityType} to be removed:`);

        refIds.forEach(refId => {
            outputStream.write(`${refId}\n`);
        });

        outputStream.write('\n');

        outputStream.end();

        return {
          flag: true,
          outputFilePath: outputFilePath
          }
    } catch (error) {
        console.error('Error writing refIds to review file:', error);
    }
}

async function main() {
  const { filepath, dir } = await processFilepath();
  const activityRefIds = await readReferenceIdsFromFile(filepath);
  let activities = await getEntities(activityRefIds, "activities");
  let itemRefIds = getItemReferenceIds(activities);
  let items = await getEntities(itemRefIds, "items");

  // CRITICAL TODO: only allow archival if entity was created by user XYZ (set in config?)

  // TODO: print refs to file and have user review before continuing. Warn that items may be used in more than one activity!
  const activityRefsPrinted = await printRefs("Activities", itemRefIds, dir);
  const itemRefsPrinted = await printRefs("Items", itemRefIds, dir);

  if (activityRefsPrinted.flag && itemRefsPrinted.flag) {
    console.log(`Ref Ids written to ${itemRefsPrinted.outputFilePath}`);
  }

    // print ref IDs of activities and items to delete, and hold for user Y/N to proceed with deletion
    let printOutput1 = await printRefs(XX, XX); // TODO: THIS IS WIP
    let printOutput2 = await printRefs(XX, XX); // TODO: THIS IS WIP
    
    let continueFlag = await inquirer.prompt({
          type: 'list',
          choices: ['Yes','No'],
          name: 'continueFlag',
          message: 'Please review the ref IDs of activities and items to be deleted before continuing.\nWarning: \nDo you wish to proceed with creating the quizzes?',
        });

    continueFlag = continueFlag.continueFlag

    if (continueFlag != 'Yes') {
      console.log("Exiting...");
      process.exit();
    }

  let activityResponse = await archiveEntities(activities, "activities");
  let itemResponse = await archiveEntities(items, "items");
  
  if (itemResponse.meta.status === true) {
    console.log(`Items successfully archived...`)
  } else {
    console.log(`API response (see below) indicates items may not have been successfully archived. Please check...\n${JSON.stringify(itemResponse)}`)
  }

  if (activityResponse.meta.status === true) {
    console.log(`Activities successfully archived...`)
  } else {
    console.log(`API response (see below) indicates activities may not have been successfully archived. Please check...\n${JSON.stringify(activityResponse)}`)
  }

}

main();
