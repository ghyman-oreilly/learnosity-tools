
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
		this.rationales = []
		this.hasRationales = hasRationales;
	}

	assignQuestionPropValues(params) {
		super.assignQuestionPropValues(params);

		const { questionStem, options, hasRationales, rationales } = params;
		
		if (hasRationales) {
			if (!options || !rationales || options.length != rationales.length) {
			console.log('Question has unequal number of options and rationales ' + questionStem);
			throw new Error('At least one quiz question has an unequal number of options and rationales. Please fix and rerun.')
			}
			this.hasRationales = hasRationales;
			this.rationales = rationales;
		}
	}

	getQuestionPropsAsJSON() {
		const baseJson = super.getQuestionPropsAsJSON();
		if (this.hasRationales) {
			baseJson.data.metadata.distractor_rationale_response_level = this.rationales;
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

module.exports = { StandardQuestion, DiagnosticQuestion };