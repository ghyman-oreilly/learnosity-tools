
class Question {
	constructor() {
		this.type = 'mcq'
		this.stem = '';
		this.options = [];
		this.correctOptions = [];
		this.questionRefId = '';
		this.itemRefId = '';
		this.shuffleOptions = true;
		this.multipleResponses = false;
		this.courseId = '';
		this.questionBankId = '';
		this.publisher = "O'Reilly Media";
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
			tags: {
				Publisher: [
					this.publisher
				]
			}
		}
	}
}

class StandardQuestion extends Question {
	constructor() {
		super();
		this.rationales = []
	}

	assignQuestionPropValues(params) {
		super.assignQuestionPropValues(params);

		const { questionStem, options, rationales } = params;
		
		if (!options || !rationales || options.length != rationales.length) {
          console.log('Question has unequal number of options and rationales ' + questionStem);
          throw new Error('At least one quiz question has an unequal number of options and rationales. Please fix and rerun.')
        }
		
		this.rationales = rationales;
	}

	getQuestionPropsAsJSON() {
		const baseJson = super.getQuestionPropsAsJSON();
		baseJson.data.metadata.distractor_rationale_response_level = this.rationales;
		return baseJson
	}

	getItemPropsAsJson() {
		const baseJson = super.getItemPropsAsJson();
		baseJson.tags["Course FPID"] = [this.courseId];
		return baseJson
	}
}

class DiagnosticQuestion extends Question {
	constructor(difficultyLevel, skill) {
		super();
		this.difficultyLevel = difficultyLevel;
		this.skill = skill;
	}

	assignQuestionPropValues(params) {
		super.assignQuestionPropValues(params);

		const { difficultyLevel, skill } = params;
		this.difficultyLevel = difficultyLevel;
		this.skill = skill;
	}

	getItemPropsAsJson() {
		const baseJson = super.getItemPropsAsJson();
		baseJson.tags.Level = [this.difficultyLevel];
		baseJson.tags.Subject = [this.skill];
		baseJson.tags["Question Bank FPID"] = [this.questionBankId]
		return baseJson
	}

}

module.exports = { StandardQuestion, DiagnosticQuestion };