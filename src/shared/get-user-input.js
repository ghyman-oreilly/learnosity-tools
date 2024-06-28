const inquirer = require('inquirer');

async function getUserInput(questions) {
	/*
    Provide an array of questions in the following format (see inquirer doc for more options):
	[
      {
        type: 'input',
        name: 'src',
        message: 'Please provide the filepath of the text file containing your activity ref IDs (one per line): ',
      }
    ]
	*/

  try {
    const answers = await inquirer.prompt(questions);

    return answers
  } catch (error) {
    console.error('Error getting user input:', error);
    throw error;
  }
}

module.exports = getUserInput;