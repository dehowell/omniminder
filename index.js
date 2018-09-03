#!/usr/bin/env node

/**********************************************************************
 * Standard Library Imports
**********************************************************************/
const fs = require('fs');
const os = require('os');
const path = require('path');
const process = require('process');
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

// Fixes babel error when looking for presets. Probably a better way to
// fix this, but I cannot presently be bothered.
process.chdir(__dirname);

function beeminderClient() {
  let configFile = path.join('/Users/dave', '.bmndrrc');
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
module.exports.inboxCount = osa(() =>
  Application("OmniFocus").defaultDocument.inboxTasks().length
);

/*
 *
 */
module.exports.recentlyUpdatedTasks = osa(() => {
  let start = new Date('2018-09-02');
  let tasks = Application("OmniFocus").defaultDocument
    .flattenedTasks
    .whose({
      modificationDate: { _greaterThan: start},
      blocked: false,
      _or: [
        { completed: false },
        { completionDate: { _greaterThan: start} }
      ]
    })();

  return tasks.map(task => ({
    id: task.id(),
    project: task.containingProject.name(),
    taskName: task.name(),
    completed: task.completed(),
    flagged: task.flagged(),
    updated: task.modificationDate(),
    blocked: task.blocked()
  }));
});





/**********************************************************************
 * Map OmniFocus to Beeminder goals.
 *
 * Eventually, it'd be cool to figure out how to make this externalized
 * configuration, such that other people could use this script without
 * having to just fork the code for their own rules. But not this day.
 **********************************************************************/

module.exports.inboxCount()
  .then(console.log);
//   .then(n =>
//     Beeminder.createDatapoint('omnifocus-inbox', {
//       value: n,
//       comment: comment,
//       requestid: daystamp
//     }))
//   .catch(console.error);

module.exports.recentlyUpdatedTasks()
  .then(console.log);