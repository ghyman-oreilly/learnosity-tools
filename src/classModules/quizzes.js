
class Quiz {
	constructor() {
		this.title = ''
		this.refId = ''
		this.shuffleItems = true
		this.courseId = ''
		this.questionBankId = ''
		this.questions = []
		this.items = []
		this.publisher = "O'Reilly Media"
	}
	
	assignQuizPropValues( {} = {}) {

	}

	getItemRefIdsfromItems() {
		const itemRefIds = [];
		for (i = 0; i < this.items.length; i ++) {
			const item = items[i];
			const itemRefId = item.reference
			itemRefIds.push(itemRefId);
		}
		return itemRefIds
	}

	getQuizPropsAsJSON() {
		itemRefIds = this.getItemRefIdsfromItems();
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
			tags: {
				Publisher: [this.publisher],
				"Question Bank FPID": [this.questionBankId]
			}
		}
	}

}

class StandardQuiz extends Quiz {
	constructor() {
		super();
		this.moduleType
	}

	getQuizPropsAsJSON() {
		const baseJson = super.assignQuizPropValues();
		baseJson.tags["Course FPID"] = this.courseId;
		return baseJson
	}
}

class DiagnosticQuiz extends Quiz {
	constructor() {
		super();
	}
}

module.exports = { StandardQuiz, DiagnosticQuiz };