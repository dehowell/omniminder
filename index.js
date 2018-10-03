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
module.exports.loadConfig = function() {
  let configFile = path.join(process.env['HOME'], '.omniminder', 'config.json');
  return new Promise((resolve, reject) =>
    fs.readFile(configFile, 'utf-8', (err, data) => {
      if (err) throw err;
      let config = JSON.parse(data);
      // TODO add assertions to check that auth token is available, etc.
      // TODO add schema validation
      resolve(config);
    })
  );
}


module.exports.beeminder = function(config) {
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
 * Utility functions
 **********************************************************************/

/* Reformat a date as a daystamp in local time. */
asDaystamp = function(date) {
  let local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().substring(0, 10);
}

/* Convert a task to a datapoint */
asDataPoint = function(task) {
  let timestamp = new Date(task.completed ? task.completedAt : task.updatedAt);
  return {
    value: task.completed ? 1 : 0,
    timestamp: timestamp.getTime() / 1000,
    comment: `Completed '${task.taskName}' at ${timestamp}, updated at ${new Date()}`,
    // TODO this doesn't really work as a request id for arbitrary beeminding
    requestid: asDaystamp(timestamp)
  };
}

function asPredicate(key, value) {
  if (typeof(value) == 'object') {
    if (value.search) {
      let pattern = RegExp(value.search, value.flags);
      return task => task[key].search(pattern) > 1;
    }
  } else {
    return task => task[key] == value;
  }
}

function compileRule(rule) {
  let keys = ["project", "taskName", "flagged"];
  let predicates = keys
    .filter(k => rule[k])
    .map(k => asPredicate(k, rule[k]));

  return {
    slug: rule.slug,
    evaluate: task => {
      let matches = predicates.map(p => p(task))
      let allMatched = matches.reduce((a, b) => a && b, true);
      return allMatched;
    }
  }
}

module.exports.evaluateCompletedTaskRules = function(config, completed) {
  let datapoints = [];

  config.completedTaskRules
    .map(compileRule)
    .map(rule => {
      completed
        .filter(t => rule.evaluate(t))
        .map(t => { datapoints.push([rule.slug, asDataPoint(t)]) })
    })

  return datapoints;
}

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
 * Retrieve tasks completed in the last 24 hours.
 */
module.exports.recentlyCompletedTasks = osa(() => {
  let start = new Date(new Date() - 48 * 3600 * 1000);
  let tasks = Application("OmniFocus").defaultDocument
    .flattenedTasks
    .whose({
      completionDate: { _greaterThan: start},
      completed: true,
      inInbox: false
    })();

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
module.exports.reviewBacklog = osa(() => {
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