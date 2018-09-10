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

async function syncOmniFocusToBeeminder() {

  const beeminder = omniminder.beeminder();
  const hostname = os.hostname();
  const daystamp = new Date().toISOString().slice(0, 10);

  let datapoints = {
    'omnifocus-inbox': []
  };

  let inbox = await omniminder.inboxCount();
  datapoints['omnifocus-inbox'].push({
    value: inbox,
    comment: `OmniFocus Inbox size on ${hostname} at ${new Date()}`,
    requestid: daystamp
  });

  // let tasks = await recentlyUpdatedTasks();

  let promises = Object.entries(datapoints)
    .map(d => beeminder.createDatapoints(d[0], d[1]));
  return Promise.all(promises);
}

syncOmniFocusToBeeminder()
  .then(responses => {
    let n = responses
      .reduce((a,b) => a + b.length, 0);
    console.log(`${new Date()}: sent ${n} datapoints to Beeminder`);
  })
  .catch(console.error);
