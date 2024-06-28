const inquirer = require('inquirer');

async function promptUserToConfirmContinue(message) {
  try {

	let promptBody = {
          type: 'list',
          choices: ['Yes','No'],
          name: 'continueFlag',
          message: null,
        }
	
	promptBody.message = message;
    
	const response = await inquirer.prompt(promptBody);

    return response.continueFlag
  } catch (error) {
    console.error('Error getting user input:', error);
    throw error;
  }
}

module.exports = promptUserToConfirmContinue;