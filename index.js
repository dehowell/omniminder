#!/usr/bin/env node

/**********************************************************************
 * Standard Library Imports
**********************************************************************/
const fs = require('fs');
const os = require('os');
const path = require('path');
const { promisify } = require('util');


/**********************************************************************
 * Third-Party Imports
**********************************************************************/
const beeminder = require('beeminder');
const ini = require('ini');
const osa = require('osa2');

/**********************************************************************
 * Setup
 **********************************************************************/
function beeminderClient() {
  let configFile = path.join(os.homedir(), '.bmndrrc');
  let text = fs.readFileSync(configFile, 'utf-8');
  let authToken = text.match(/^auth_token: (.*?)$/m)[1];
  let client = beeminder(authToken);
  return {
    createDatapoint: promisify(client.createDatapoint) 
  };
}

const Beeminder = beeminderClient();
const hostname = os.hostname();
const daystamp = new Date().toISOString().slice(0, 10);
const comment = `Updated on ${hostname} at ${new Date()} via beeminding-omnifocus scripts`


/**********************************************************************
 * Functions that evaluate state of OmniFocus database.
 **********************************************************************/

/*
 * Retrieve the number of tasks currently in OmniFocus.
 */
const inboxCount = osa(() => 
    Application("OmniFocus").defaultDocument.inboxTasks().length
  );


/*
 * From here on, evaluate properties and send data points to OmniFocus.
 */
inboxCount()
  .then(n =>
    Beeminder.createDatapoint('omnifocus-inbox', {
      value: n,
      comment: comment,
      requestid: daystamp
    }))
  .catch(console.error);

