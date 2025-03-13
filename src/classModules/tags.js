const { deepSerialize } = require('../shared/helpers')


class Tag {
	constructor(TagName, TagValue) {
		this.name = TagName;
		this.value = [TagValue];
	}

	toJSON() {
		/* object serialization for testing */
    	return deepSerialize(this);
  	}

	appendValue(TagValue) {
		this.value.push(TagValue);
	}
	

	resetToValue(TagValue) {
		this.value = [TagValue];
	}

}

module.exports = { Tag };