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

/* Query OmniFocus database state and generate datapoints. */
async function syncOmniFocusToBeeminder() {

  const config = await omniminder.loadConfig();
  const beeminder = omniminder.beeminder(config);
  const hostname = os.hostname();
  const daystamp = new Date().toISOString().slice(0, 10);

  let datapoints = [];

  // Beemind inbox backlog size
  if (config.inboxGoal) {
    let inbox = await omniminder.inboxCount();
    datapoints.push([config.inboxGoal, {
      value: inbox,
      comment: `OmniFocus Inbox size on ${hostname} at ${new Date()}`,
      requestid: daystamp
    }]);
  }

  // Beemind review backlog size
  if (config.reviewGoal) {
    let {size: reviewBacklog} = await omniminder.reviewBacklog();
    datapoints.push([config.reviewGoal, {
      value: reviewBacklog,
      comment: `OmniFocus projects pending review on ${hostname} at ${new Date()}`,
      requestid: daystamp
    }]);
  }

  let completed = await omniminder.recentlyCompletedTasks();
  // TODO stew on it and then rewrite as a set of rules
  completed
    .filter(t => t.project == 'Routines' && t.taskName.search(/gratitude/i) > 1)
    .map(t => { datapoints.push(['gratitude', omniminder.asDataPoint(t)])});

  completed
    .filter(t => t.project == 'Startup' && t.taskName.search(/mood/i) > 1)
    .map(t => { datapoints.push(['mood', omniminder.asDataPoint(t)])});

  let promises = datapoints.map( ([g, d]) => beeminder.createDatapoint(g, d) );
  return Promise.all(promises);
}

syncOmniFocusToBeeminder()
  .then(responses => {
    let n = responses.length;
    console.log(`${new Date()}: sent ${n} datapoints to Beeminder`);
  })
  .catch(console.error);
