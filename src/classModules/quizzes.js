const {
	publisherTagName,
	publisherTagValue,
	questionBankIdTagName,
	courseIdTagName,
	quizTypeTagName
} = require('../constants')

class Quiz {
	constructor() {
		this.title = ''
		this.refId = ''
		this.shuffleItems = true
		this.questions = []
		this.items = []
		this.tags = { 
			[publisherTagName]: [publisherTagValue],
			[questionBankIdTagName]: ['']
		 };
	}
	
	// TODO: might be helpful to have an superclass for Quiz and Question - they share a lot of shape/behavior

	assignQuizPropValues( {} = {}) {
	}

	updateOrAddTag(tagName, tagValue) {
        if (Array.isArray(tagValue)) {
			this.tags[tagName] = tagValue;
		} else {
			this.tags[tagName] = [tagValue];
		}
    }

	updateTag(tagName, tagValue) {
		if (this.tags[tagName]) {			
			if (Array.isArray(tagValue)) {
				this.tags[tagName] = tagValue;
			} else {
				this.tags[tagName] = [tagValue];
			}
		}
	}

	getItemRefIdsfromItems() {
		const itemRefIds = [];
		for (let i = 0; i < this.items.length; i ++) {
			const item = items[i];
			const itemRefId = item.reference
			itemRefIds.push(itemRefId);
		}
		return itemRefIds
	}

	getQuizPropsAsJSON() {
		const itemRefIds = this.getItemRefIdsfromItems();
		return {
			title: this.title,
			reference: this.refId,
			status: "published",
			data: {
				items: itemRefIds,
				config: {
					configuration: {
						shuffle_items: this.shuffleItems
					},
					regions: "main"
				},
				rendering_type: "assess"
			},
			tags: this.tags
		}
	}

}

class StandardQuiz extends Quiz {
	constructor() {
		super();
		this.moduleType; // unused for now
		this.updateOrAddTag(courseIdTagName, '');
	}
}

class DiagnosticQuiz extends Quiz {
	constructor() {
		super();
		this.updateOrAddTag(quizTypeTagName, 'Diagnostic');
	}
}

module.exports = { StandardQuiz, DiagnosticQuiz };