/**********************************************************************
 * Standard Library Imports
**********************************************************************/
const fs = require('fs');
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
//
// This would have to be fixed for these functions to be usable in a
// library.
process.chdir(__dirname);


function beeminderClient() {
  // TODO look up user's home directory properly
  let configFile = path.join('/Users/dave', '.bmndrrc');
  let text = fs.readFileSync(configFile, 'utf-8');
  let authToken = text.match(/^auth_token: (.*?)$/m)[1];
  let client = beeminder(authToken);
  let callApi = promisify(client.callApi);
  return {
    createDatapoint: promisify(client.createDatapoint),
    // Malcolm hasn't cut a release for the Beeminder client that includes
    // this API call.
    createDatapoints: function(goalName, datapoints) {
      let path = `/users/me/goals/${goalName}/datapoints/create_all.json`;
      return callApi(path, {datapoints: JSON.stringify(datapoints)}, 'POST');
    }
  };
}

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
 * Retrieve tasks completed in the last 24 hours.
 */
const recentlyCompletedTasks = osa(() => {
  let start = new Date(new Date() - 48 * 3600 * 1000);
  let tasks = Application("OmniFocus").defaultDocument
    .flattenedTasks
    .whose({
      completionDate: { _greaterThan: start},
      completed: true,
      inInbox: false
    })();

  // TODO can I just task.properties() and have that convert to Node?
  return tasks.map(task => ({
    id: task.id(),
    project: task.containingProject.name(),
    taskName: task.name(),
    completed: task.completed(),
    flagged: task.flagged(),
    updatedAt: task.modificationDate(),
    completedAt: task.completionDate(),
    blocked: task.blocked()
  }));
})


module.exports = {
  inboxCount: inboxCount,
  recentlyCompletedTasks: recentlyCompletedTasks,
  beeminder: beeminderClient
};