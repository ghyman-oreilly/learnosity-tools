
class Tag {
	constructor(TagName, TagValue) {
		this.name = TagName;
		this.value = [TagValue];
	}

	appendValue(TagValue) {
		this.value.push(TagValue);
	}
	

	resetToValue(TagValue) {
		this.value = [TagValue];
	}

}

module.exports = { Tag };