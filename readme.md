#Install Salvo#
  run `npm install salvo -g` in the terminal

#Run Salvo in Terminal Commands#
  1. In the project folder you want to use Salvo in, run `salvo -t filename.json`.
  2. If the file you wish to use Salvo with is setup correctly, it should run.

#How to setup the object for salvo to run#
  1. Salvo runs a JSON file. Here's an example of a JSON object bare bones structure:
  `{
    "name": "Example Script to run",
    "preloads": [],
    "operations": [
      {
        "name": "Operation 1",
        "description": "Describe what the operation is supposed to do. Will show up in terminal",
        "iterations": 1,
        "run_at": "",
        "actions": [
          {
            "name": "Action 1",
            "type": "",
            "values": {}
          }
        ]
      }
    ]
  }`
#Setting up Operation#
  1. Every object needs at least one operation that has at least one action inside it. You can have multiple operations/actions.
  2. At the Operation level there some optional properties you can add to customize the timing of your script. They are as follows:
    - `iterations`: take a number value. Denotes how many time to run an operation.
    - `pre_delay_op`: Takes a numerical value that will represent time in milliseconds. Will be the first to run. A delay ran at the beginning of each operation.
		-	`pre_delay_loop`: Takes a numerical value that will represent time in milliseconds. Will be the 2nd to run. A delay ran at the beginning of the actions loop.
		-	`post_delay-op`: Takes a numerical value that will represent time in milliseconds. Will run 3rd. A delay ran at the end of the actions loop.
		- `post_delay-loop`: Takes a numerical value that will represent time in milliseconds. Will run last. A delay at the end of the iteration of an operation.
    - `run_at`: Takes a time String. Can a date/time stamp like this: `2017-09-25T19:26:00Z` or a time based on the 12hr clock, like `11:00 am` or `4:30 pm`. If you use the am/pm time, if you for am or pm, it will default to am. It doesn't accept military time. This property is used to run an operation at a later time than when you run the salvo command in the terminal.

#Setting up Action(s)#
  1. The actions array accepts multiple action object. Based on the type value you give each action, the action object will vary. Here are some examples below
##Type examples##
  `type`: Accepts quite a few different strings: terminal, replace-file-text, send-email, set-var, web-call, make-file, and update-file.
    1. Terminal. When ran, npm install will be ran in the terminal. Whatever command you give in `values.text` will be ran in the terminal.
    `{
      "name": "Action 1",
      "type": "terminal",
      "values": {
        "text": "npm install"
      }
    }`

    2. replace-file-text. When ran, will replace the text in the document specified in fileLocation from `values.replacements.from` to `values.replacements.to`

   `{
      "name": "Action 1",
      "type": "terminal",
      "values": {
				"fileLocation": "./fileFolder/fileName",
				"replacements": [
					{
						"from": "oldText",
						"to": "newText"
					}
				]
			}
    }`

    3. send-email. When ran, will send an HTML based email to the account given. See example set-up below.

    `{
        "name": "Send email",
        "type": "send-email",
        "values": {
          "accountProperties": {
            "service": "Gmail",
            "user": "emailAddress",
            "pass": "password"
          },
          "emailProperties": {
            "from": "You <youremail@gmail.com>",
            "to": "Your friend <yourfriendsemail@gmail.com>",
            "subject": "Salvo calling!",
            "text": "It worked!",
            "html": "<p>I am HTML, look at me!</p>",
            "attachments": [
              "file1.txt",
              "file2.txt"
            ]
          }
        }
      }`

  4. set-var. When ran, will set a variable that can be used later in your script. In values.action, there are three options to use: increment, set or push. If increment, then

   `{
     "name": "Send email",
     "type": "send-email",
     "values": {
       "target": "",
       "data": "",
       "action": "set"
     }
    }`

  5.

  `{
      "name": "Loop an op for each file in a directory",
      "preloads": [],
      "operations": [
        {
          "name": "Loop over files",
          "iterations": {
            "type": "for-each-file",
            "iteratee": "fileName",
            "directory": "dummyFiles"
          },
          "actions": [
          {
            "name": "Operation 2 Action 4",
            "description": "Updates file",
            "type": "update-file",
            "values": {
              "fileType": "text",
              "dataOperations": [],
              "data": "}>}fileName{<{",
              "fileLocation": "}>}fileName{<{"
            }
          }
          ]
        }
      ]
    }`

  6. web-call

  `{
      "name": "Uploads a file",
      "preloads": [],
      "operations": [
        {
          "name": "Upload file",
          "description": "You can describe the operation here",
          "pre_delay_op": 0,
          "pre_delay_loop": 500,
          "post_delay_op": 0,
          "post_delay_loop": 500,
          "iterations": 1,
          "actions": [
            {
              "name": "Upload file",
              "pre_delay": 1000,
              "post_delay": 1000,
              "type": "web-call",
              "values": {
                "method": "POST",
                "headers": {
                  "Content-Type": "application/json"
                },
                "target": "http://localhost:1337/api/files/upload",
                "attachment": {
                  "fileName": "your key name",
                  "filePath": "yourfile.jpg"
                }
              }
            }
          ]
        }
      ]
    }`

  7. make-file

    `{
				"name": "POST test",
				"description": "You can describe the operation here",
				"pre_delay_op": 300,
				"pre_delay_loop": 1000,
				"post_delay_op": 1000,
				"post_delay_loop": 1000,
				"iterations": 1,
				"actions": [
					{
						"name": "Record results",
						"description": "Updates file",
						"type": "make-file",
						"values": {
							"fileType": "text",
							"dataOperations": [],
							"data": "}>}passingTests{<{",
							"fileLocation": "testResults.txt"
						}
					}
				]
			}`
