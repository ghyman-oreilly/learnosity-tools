const { callDataAPI } = require('./call-learnosity')

async function appendTagsToEntities(entityType, refIds, tags) {
    try {
        const payloadObject = {
            [entityType]: refIds.map(refId => ({
                reference: refId,
                tags: tags
            }))
        };
		const payloadBody = JSON.stringify(payloadObject);
		const jsonData = JSON.parse(payloadBody);
		const endpoint = `${entityType.toLowerCase()}/tags`
		if (jsonData) {
			const apiResponse = await callDataAPI(payloadObject, "update", endpoint);
			return apiResponse;
		} else {
			throw new Error('Invalid JSON in payload');
		}
    } catch (error) {
      console.error(`Error appending tags to ${entityType} via Learnosity API: `, error);
      throw error;
    }
}

module.exports = appendTagsToEntities;