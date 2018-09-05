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
//
// This would have to be fixed for these functions to be usable in a
// library.
process.chdir(__dirname);


function beeminderClient() {
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

async function syncOmniFocusToBeeminder() {

  const Beeminder = beeminderClient();
  const hostname = os.hostname();
  const daystamp = new Date().toISOString().slice(0, 10);

  let datapoints = {
    'omnifocus-inbox': []
  };

  let inbox = await inboxCount();
  datapoints['omnifocus-inbox'].push({
    value: inbox,
    comment: `OmniFocus Inbox size on ${hostname} at ${new Date()}`,
    requestid: daystamp
  });

  // let tasks = await recentlyUpdatedTasks();

  let promises = Object.entries(datapoints)
    .map(d => Beeminder.createDatapoints(d[0], d[1]));
  return Promise.all(promises);
}

syncOmniFocusToBeeminder()
  .then(responses => {
    let n = responses
      .reduce((a,b) => a + b.length, 0);
    console.log(`${new Date()}: sent ${n} datapoints to Beeminder`);
  })
  .catch(console.error);