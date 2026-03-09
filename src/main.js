// GHENT — GitHub Email Notifications Tamer
// Entry points and trigger management.

/**
 * Main entry point, called by the time-based trigger.
 * Runs the labeler and muter sequentially.
 */
function run() {
  labelAndArchive();
  syncMutes();
}

/**
 * Install a time-based trigger to run GHENT automatically.
 * Safe to call multiple times — removes existing triggers first.
 */
function install() {
  uninstall();
  ScriptApp.newTrigger('run')
    .timeBased()
    .everyMinutes(CONFIG.TRIGGER_INTERVAL_MINUTES)
    .create();
  Logger.log('GHENT: Installed trigger (every ' + CONFIG.TRIGGER_INTERVAL_MINUTES + ' minutes)');
}

/**
 * Remove all GHENT triggers.
 */
function uninstall() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'run') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  Logger.log('GHENT: Uninstalled all triggers');
}

/**
 * Reset the last-run timestamp so the next run processes all inbox threads.
 * Useful for initial setup or if you want to re-process everything.
 */
function resetLastRun() {
  PropertiesService.getUserProperties().deleteProperty(CONFIG.LAST_RUN_KEY);
  Logger.log('GHENT: Reset last run timestamp — next run will process all inbox threads');
}
