const {
	publisherTagName,
	publisherTagValue,
	questionBankIdTagName,
	courseIdTagName,
	quizTypeTagName
} = require('../constants')
const { deepSerialize } = require('../shared/helpers')
const { Question } = require('./questions')


class Quiz {
	constructor(QuizInitOptions) {
		this.title = ''
		this.refId = ''
		this.shuffleItems = true
		this.questions = []
		this.show_distractor_rationale =  {
			per_question: "incorrect",
			per_response: "never"
		}
		this.tags = { 
			[publisherTagName]: [publisherTagValue],
			[questionBankIdTagName]: ['']
		 };
	}

	// Static method to create a Quiz (Standard or Diagnostic)
	static fromJSON(json, type = 'Standard') {
		// Create an instance of the appropriate Quiz subclass
		let instance;
		if (type === 'Diagnostic') {
			instance = new DiagnosticQuiz();
		} else {
			instance = new StandardQuiz();
		}

		// Initialize properties from JSON
		for (let key in json) {
			if (json.hasOwnProperty(key)) {
				const value = json[key];
				// Handle questions array
				if (key === 'questions' && Array.isArray(value)) {
					// Create the questions using the same type as the Quiz
					instance[key] = value.map(questionData => {
						return Question.fromJSON(questionData, type); // Pass type to Question.fromJSON
					});
				} else if (Array.isArray(value)) {
					instance[key] = value;
				} else if (typeof value === 'object' && value !== null) {
					instance[key] = value;
				} else {
					instance[key] = value;
				}
			}
		}
		return instance;
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
					questions_api_init_options: {
						show_distractor_rationale: 	this.show_distractor_rationale
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