const os = require('os');

const omniminder = require('./index');

async function test() {

  const config = await omniminder.loadConfig();
  const hostname = os.hostname();
  const daystamp = new Date().toISOString().slice(0, 10);

  let datapoints = [];

  let completed = await omniminder.recentlyCompletedTasks();

  omniminder
    .evaluateCompletedTaskRules(config, completed)
    .map(dp => datapoints.push(dp));
  
  return datapoints;
}


test()
  .then(dp => console.log(JSON.stringify(dp, null, ' ')));