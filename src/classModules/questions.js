
const {
	publisherTagName,
	publisherTagValue,
	questionBankIdTagName,
	courseIdTagName,
	questionDifficultyTagName,
	questionSkillTagName
} = require('../constants')
const { deepSerialize } = require('../shared/helpers')


class Question {
	constructor() {
		this.type = 'mcq'
		this.stem = '';
		this.options = [];
		this.correctOptions = [];
		this.questionRefId = '';
		this.itemRefId = '';
		this.difficultyLevel = 0;
		this.shuffleOptions = true;
		this.multipleResponses = false;
		this.tags = { [publisherTagName]: [publisherTagValue] };
	}

	// Static method to create a Question (Standard or Diagnostic)
	static fromJSON(json, type = 'Standard') {
		// Decide which class to instantiate
		let instance;
		if (type === 'Diagnostic') {
			instance = new DiagnosticQuestion();
		} else {
			instance = new StandardQuestion();
		}

		// Iterate over the JSON properties and assign them to the instance
		for (let key in json) {
			if (json.hasOwnProperty(key)) {
				const value = json[key];
				// Handle arrays and nested objects as needed
				if (Array.isArray(value)) {
					instance[key] = value;
				} else if (typeof value === 'object' && value !== null) {
					if (key === 'tags') {
						instance[key] = { ...value };  // Directly copy tags if they are objects
					} else {
						instance[key] = value;
					}
				} else {
					instance[key] = value;
				}
			}
		}
		return instance;
	}

	toJSON() {
		/* object serialization for testing */
    	return deepSerialize(this);
  	}

	assignQuestionPropValues( { options, correctOptions, questionStem, shuffleTwoOptionQuestions } = {}) {
		this.options = options;
		
		if (!correctOptions || correctOptions.length < 1) {
          console.log('Question is missing a correct answer flag: ' + questionStem);
          throw new Error('At least one quiz question is missing a correct answer flag. Please fix and rerun.')
        }

		this.correctOptions = correctOptions;
		this.stem = questionStem;

		if (shuffleTwoOptionQuestions == false && options.length == 2) {
          this.shouldShuffle = false;
        }

		if (correctOptions.length > 1) {
			this.multipleResponses = true;
		} else {
			this.multipleResponses = false;
		}

	}

	updateProperty(propName, value) {
	if (this.hasOwnProperty(propName)) {
		this[propName] = value;
		}
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

    getQuestionPropsAsJSON() {
        return {
            type: this.type,
            reference: this.questionRefId,
            data: {
                multiple_responses: this.multipleResponses,
                options: this.options,
                stimulus: this.stem,
                type: this.type, // Same as the class property
                validation: {
                    scoring_type: "exactMatch",
                    valid_response: {
                        score: 1,
                        value: this.correctOptions,
                    },
                },
                ui_style: {
                    type: "horizontal",
                },
                metadata: {
                },
                shuffle_options: this.shuffleOptions,
            },
        };
    }

	// TODO: eventually we should probably create a separate Item class

	getItemPropsAsJson() {
		return {
			reference: this.itemRefId,
			metadata: null,
			definition: {
				widgets: [
					{
						reference: this.questionRefId
					}
				]
			},
			status: "published",
			questions: [
				{
					reference: this.questionRefId
				}
			],
			tags: this.tags
		}
	}
}

class StandardQuestion extends Question {
	constructor(hasRationales) {
		super();
		super.updateOrAddTag(courseIdTagName, '')
		this.rationale = ''
		this.hasRationales = hasRationales;
	}

	assignQuestionPropValues(params) {
		super.assignQuestionPropValues(params);

		const { questionStem, options, hasRationales, rationales } = params;
		
		if (hasRationales) {
			if (!options || !rationales || rationales.length != 1) {
			console.log('Question does not have one rationale, as required: ' + questionStem);
			throw new Error('At least one quiz question has the wrong number of rationales (must have exactly 1). Please fix and rerun.')
			}
			this.hasRationales = hasRationales;
			this.rationale = rationales[0];
		}
	}

	getQuestionPropsAsJSON() {
		const baseJson = super.getQuestionPropsAsJSON();
		if (this.hasRationales) {
			baseJson.data.metadata.distractor_rationale = this.rationale;
		}
		return baseJson
	}

}

class DiagnosticQuestion extends Question {
	constructor(difficultyLevel, skill) {
		super();
		super.updateOrAddTag(questionBankIdTagName, '');
		super.updateOrAddTag(questionSkillTagName, skill);

		// assign difficulty level
		if (difficultyLevel == "Beginner") {
			this.difficultyLevel = 1;
		} else if (difficultyLevel == "Intermediate") {
			this.difficultyLevel = 2;
		} else if (difficultyLevel == "Advanced") {
			this.difficultyLevel = 3;
		}
	}

	assignQuestionPropValues(params) {
		super.assignQuestionPropValues(params);

		const { skill } = params;
		
		super.updateOrAddTag('Subject', skill);
	}

	getQuestionPropsAsJSON() {
		const baseJson = super.getQuestionPropsAsJSON();
		if (this.difficultyLevel != 0) {
			baseJson.data.adaptive = baseJson.data.adaptive || {}; // ensure `adaptive` object exists
			baseJson.data.adaptive.difficulty = this.difficultyLevel;
		}
		return baseJson
	}

}

module.exports = { Question, StandardQuestion, DiagnosticQuestion };