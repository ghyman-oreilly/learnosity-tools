const { callDataAPI } = require('./call-learnosity');

async function getEntities({entityType, refIds = null, customPayload = null}) {
  try {
    let payloadObject
    if (customPayload === null) {
      if (refIds !== null) {
        payloadObject = {
          "references": refIds
        };   
      } else {
        throw error
      } 
    } else {
      payloadObject = customPayload;
    }   
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