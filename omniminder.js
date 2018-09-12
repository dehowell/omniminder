#!/usr/bin/env node
const os = require('os');

const omniminder = require('./index');

/**********************************************************************
 * Map OmniFocus to Beeminder goals.
 *
 * Eventually, it'd be cool to figure out how to make this externalized
 * configuration, such that other people could use this script without
 * having to just fork the code for their own rules. But not this day.
 **********************************************************************/
/* Reformat a date as a daystamp in local time. */
function asDaystamp(date) {
  let local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().substring(0, 10);
}

/* Convert a task to a datapoint */
function asDataPoint(task) {
  let timestamp = new Date(task.completed ? task.completedAt : task.updatedAt);
  return {
    value: task.completed ? 1 : 0,
    timestamp: timestamp.getTime() / 1000,
    comment: `Completed '${task.taskName}' at ${timestamp}, updated at ${new Date()}`,
    requestid: asDaystamp(timestamp)
  };
}

/* Query OmniFocus database state and generate datapoints. */
async function syncOmniFocusToBeeminder() {

  const beeminder = omniminder.beeminder();
  const hostname = os.hostname();
  const daystamp = new Date().toISOString().slice(0, 10);

  let datapoints = [];

  let inbox = await omniminder.inboxCount();
  datapoints.push([ 'omnifocus-inbox', {
    value: inbox,
    comment: `OmniFocus Inbox size on ${hostname} at ${new Date()}`,
    requestid: daystamp
  }]);

  let completed = await omniminder.recentlyCompletedTasks();

  // TODO stew on it and then rewrite as a set of rules
  completed
    .filter(t => t.project == 'Routines' && t.taskName.search(/gratitude/i) > 1)
    .map(t => { datapoints.push(['gratitude', asDataPoint(t)])});

  completed
    .filter(t => t.project == 'Routines' && t.taskName.search(/mood/i) > 1)
    .map(t => { datapoints.push(['mood', asDataPoint(t)])});

  let promises = datapoints.map( ([g, d]) => beeminder.createDatapoint(g, d) );
  return Promise.all(promises);
}

syncOmniFocusToBeeminder()
  .then(responses => {
    let n = responses.length;
    console.log(`${new Date()}: sent ${n} datapoints to Beeminder`);
  })
  .catch(console.error);
