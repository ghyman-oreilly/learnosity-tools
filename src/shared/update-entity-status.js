const getEntities = require('./get-entities');
const { callDataAPI } = require('./call-learnosity');

async function updateEntitiesStatus(entityType, refIds, status){
  try {
    const entities = await getEntities({entityType: entityType, refIds: refIds});

    entities.forEach(entity => {
      if (entity.status !== undefined) {
        entity.status = status;
      } else {
        console.log(`Status object not found for entity with the following ref ID. Skipped updating: ${entity.reference}`);
      }
    });
    let payloadObject = {
          [entityType]: entities
        };
    const payloadBody = JSON.stringify(payloadObject);
    let response = await callDataAPI(payloadBody, "set", entityType);
    return response
  } catch (error) {
    console.error(`Error updating ${entityType} via call to Learnosity: `, error);
    throw error;
  }
}

module.exports = updateEntitiesStatus;