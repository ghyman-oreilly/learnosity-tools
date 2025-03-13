const {
	publisherTagName,
	publisherTagValue,
	questionBankIdTagName,
	courseIdTagName,
	quizTypeTagName
} = require('../constants')
const { deepSerialize } = require('../shared/helpers')

class Quiz {
	constructor() {
		this.title = ''
		this.refId = ''
		this.shuffleItems = true
		this.questions = []
		this.tags = { 
			[publisherTagName]: [publisherTagValue],
			[questionBankIdTagName]: ['']
		 };
	}
	
	// TODO: might be helpful to have an superclass for Quiz and Question - they share a lot of shape/behavior

	toJSON() {
		/* object serialization for testing */
    	return deepSerialize(this);
  	}

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

	getItemRefIdsfromQuestions() {
		const itemRefIds = [];
		for (let i = 0; i < this.questions.length; i ++) {
			const question = this.questions[i];
			const itemRefId = question.itemRefId;
			itemRefIds.push(itemRefId);
		}
		return itemRefIds
	}

	getQuizPropsAsJSON() {
		const itemRefIds = this.getItemRefIdsfromQuestions();
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