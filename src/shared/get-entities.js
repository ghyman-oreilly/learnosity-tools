const { callDataAPI } = require('./call-learnosity');

async function getEntities(refIds, entityType) {
  try {
    const payloadObject = {
      "references": refIds
    };
    
    const payloadBody = JSON.stringify(payloadObject);
    let entities = await callDataAPI(payloadBody, "get", entityType);
    entities = entities.data;

    return entities
  } catch (error) {
    console.error(`Error returning ${entityType} via call to Learnosity: `, error);
    throw error;
  }
}

module.exports = getEntities;