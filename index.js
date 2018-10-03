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


/*
 * Load the OmniMinder configuration file.
 */
function loadConfig() {
  let configFile = path.join(process.env['HOME'], '.omniminder', 'config.json');
  return new Promise((resolve, reject) =>
    fs.readFile(configFile, 'utf-8', (err, data) => {
      if (err) throw err;
      let config = JSON.parse(data);
      // TODO add assertions to check that auth token is available, etc.
      resolve(config);
    })
  );
}


function beeminderClient(config) {
  let client = beeminder(config.authToken);
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

/*
 * Retrieve statistics about the projects due for review.
 */
const reviewBacklog = osa(() => {
  let today = new Date();
  let pending = Application("OmniFocus").defaultDocument
    .flattenedProjects
    .whose({
      completed: false,
      nextReviewDate: { _lessThan: today }
    })()
    // `status` is an enum and I can't figure out how to construct one in the whose
    // clause; It's converted to a string once the ObjectSpecifier is materialized
    // as JavaScript types, so I'm filtering it here.
    .filter(p => p.status() != "dropped");

  let ageDue = p => (today - p.nextReviewDate()) / (1000 * 3600 * 24);

  return {
    'size': pending.length,
    'oldestDue': Math.max.apply(Math, pending.map(ageDue))
  };
})

module.exports = {
  loadConfig: loadConfig,
  inboxCount: inboxCount,
  recentlyCompletedTasks: recentlyCompletedTasks,
  reviewBacklog: reviewBacklog,
  beeminder: beeminderClient
};