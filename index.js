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
 *
 */
const recentlyUpdatedTasks = osa(() => {
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



module.exports = {
  inboxCount: inboxCount,
  recentlyUpdatedTasks: recentlyUpdatedTasks
};

/**********************************************************************
 * Map OmniFocus to Beeminder goals.
 *
 * Eventually, it'd be cool to figure out how to make this externalized
 * configuration, such that other people could use this script without
 * having to just fork the code for their own rules. But not this day.
 *
 * Also, this should probably move to a script that can import the
 * rest of the stuff above as a module.
 **********************************************************************/

let datapoints = []

// Beemind inbox count
inboxCount()
  .then(n =>
    datapoints.push(['omnifocus-inbox', {
      value: n,
      comment: `OmniFocus Inbox size on ${hostname} at ${new Date()}`,
      requestid: '2018-09-04'
  }]))
  .catch(console.error);


recentlyUpdatedTasks()
  // Beemind completed flagged tasks
  .then(tasks => {
    // Filter down to flagged tasks
    // Convert completed to 1 or 0
    // Group by day
    // Reduce to completed by day
    return tasks
  })
  // Arbitrary Beeminding: tasks whose names match a pattern
  .then(tasks => {

  });

// Send data points to the Beeminder API
Promises.all(datapoints.map(d => Beeminder.createDatapoint(d[0], d[1])))
  .then(console.log)
  .catch(console.error);
