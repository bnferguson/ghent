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
  PropertiesService.getScriptProperties().deleteProperty(CONFIG.LAST_RUN_KEY);
  Logger.log('GHENT: Reset last run timestamp — next run will process all inbox threads');
}

/**
 * Migrate threads from one label prefix to another and delete old labels.
 * Run from the editor after changing your label_prefix.
 *
 * Set these Script Properties before running:
 *   migrate_from  — old prefix (e.g., "GHENT")
 *   migrate_to    — new prefix, or omit to use current label_prefix
 */
function migrateLabels() {
  var props = PropertiesService.getScriptProperties();
  var oldPrefix = props.getProperty('migrate_from');
  var newPrefix = props.getProperty('migrate_to') || CONFIG.LABEL_PREFIX;

  if (!oldPrefix) {
    Logger.log('Set Script Property "migrate_from" to the old label prefix (e.g., "GHENT")');
    return;
  }

  if (oldPrefix === newPrefix) {
    Logger.log('migrate_from and migrate_to are the same ("' + oldPrefix + '") — nothing to do');
    return;
  }

  var allLabels = GmailApp.getUserLabels();
  var migrated = 0;
  var deleted = 0;

  // Sort so child labels are processed before parents
  var oldLabels = allLabels
    .filter(function(l) { return l.getName() === oldPrefix || l.getName().indexOf(oldPrefix + '/') === 0; })
    .sort(function(a, b) { return b.getName().length - a.getName().length; });

  for (var i = 0; i < oldLabels.length; i++) {
    var oldLabel = oldLabels[i];
    var oldName = oldLabel.getName();
    var newName = newPrefix + oldName.substring(oldPrefix.length);

    // Move threads to new label
    var threads = oldLabel.getThreads();
    if (threads.length > 0) {
      var newLabel = GmailApp.getUserLabelByName(newName) || GmailApp.createLabel(newName);
      // addToThreads has a limit of 100 per call
      for (var j = 0; j < threads.length; j += 100) {
        var batch = threads.slice(j, j + 100);
        newLabel.addToThreads(batch);
      }
      migrated += threads.length;
      Logger.log('Migrated ' + threads.length + ' threads: ' + oldName + ' → ' + newName);
    }

    // Delete old label
    oldLabel.deleteLabel();
    deleted++;
    Logger.log('Deleted label: ' + oldName);
  }

  Logger.log('Migration complete: ' + migrated + ' threads moved, ' + deleted + ' old labels deleted');
  Logger.log('You can now remove the migrate_from and migrate_to Script Properties');
}

/**
 * Migrate flat repo labels (GHENT/Repos/my-repo) to owner-nested labels
 * (GHENT/Repos/org/my-repo) by reading the org from each thread's subject.
 *
 * Run from the editor. Safe to run multiple times — skips labels that
 * already have the owner/repo structure.
 */
function migrateRepoLabels() {
  var repoPrefix = CONFIG.LABEL_PREFIX + '/Repos/';

  Logger.log('GHENT: Fetching labels...');
  var allLabels = GmailApp.getUserLabels();
  Logger.log('GHENT: Found ' + allLabels.length + ' total labels');

  var flatRepoLabels = allLabels.filter(function(l) {
    var name = l.getName();
    if (name.indexOf(repoPrefix) !== 0) return false;
    var rest = name.substring(repoPrefix.length);
    return rest.length > 0 && rest.indexOf('/') === -1;
  });

  Logger.log('GHENT: Found ' + flatRepoLabels.length + ' flat repo labels to migrate');
  for (var x = 0; x < flatRepoLabels.length; x++) {
    Logger.log('  - ' + flatRepoLabels[x].getName());
  }

  if (flatRepoLabels.length === 0) {
    Logger.log('GHENT: Nothing to migrate');
    return;
  }

  var migrated = 0;
  var skipped = 0;

  for (var i = 0; i < flatRepoLabels.length; i++) {
    var oldLabel = flatRepoLabels[i];
    var oldName = oldLabel.getName();
    var repoName = oldName.substring(repoPrefix.length);

    Logger.log('GHENT: Getting threads for ' + oldName + '...');
    Utilities.sleep(1000);

    var threads;
    try {
      threads = oldLabel.getThreads(0, 10);
    } catch (e) {
      Logger.log('GHENT: Error getting threads for ' + oldName + ': ' + e.message);
      Logger.log('GHENT: Waiting 5s and retrying...');
      Utilities.sleep(5000);
      try {
        threads = oldLabel.getThreads(0, 10);
      } catch (e2) {
        Logger.log('GHENT: Still failing for ' + oldName + ', skipping: ' + e2.message);
        continue;
      }
    }

    if (threads.length === 0) {
      try {
        oldLabel.deleteLabel();
        Logger.log('GHENT: Deleted empty label: ' + oldName);
      } catch (e) {
        Logger.log('GHENT: Could not delete empty label ' + oldName + ': ' + e.message);
      }
      continue;
    }

    Logger.log('GHENT: Got ' + threads.length + ' threads from ' + oldName);

    // Group threads by org (parsed from subject)
    var orgMap = {};
    var noOrg = [];

    for (var j = 0; j < threads.length; j++) {
      var subject = threads[j].getFirstMessageSubject();
      var repo = getRepoFromSubject(subject);
      if (repo && repo.org) {
        if (!orgMap[repo.org]) orgMap[repo.org] = [];
        orgMap[repo.org].push(threads[j]);
      } else {
        noOrg.push(threads[j]);
        Logger.log('GHENT: Could not parse org from subject: ' + subject);
      }
    }

    // Move threads to new org-nested labels one at a time
    var orgs = Object.keys(orgMap);
    for (var k = 0; k < orgs.length; k++) {
      var newName = repoPrefix + orgs[k] + '/' + repoName;
      Logger.log('GHENT: Moving threads to ' + newName);
      var newLabel = findOrCreateLabel(newName);
      var orgThreads = orgMap[orgs[k]];

      for (var b = 0; b < orgThreads.length; b++) {
        try {
          newLabel.addToThread(orgThreads[b]);
        } catch (e) {
          Logger.log('GHENT: Error adding thread ' + b + ': ' + e.message);
          Utilities.sleep(2000);
          newLabel.addToThread(orgThreads[b]);
        }
        Utilities.sleep(200);
      }

      migrated += orgThreads.length;
      Logger.log('GHENT: Migrated ' + orgThreads.length + ' threads: ' + oldName + ' → ' + newName);
    }

    if (noOrg.length > 0) {
      skipped += noOrg.length;
    }

    // Delete old label only if all threads were migrated
    if (noOrg.length === 0) {
      Utilities.sleep(2000);
      try {
        oldLabel.deleteLabel();
        Logger.log('GHENT: Deleted label: ' + oldName);
      } catch (e) {
        Logger.log('GHENT: Could not delete ' + oldName + ' (threads moved successfully): ' + e.message);
      }
    }

    // Pause between labels
    Utilities.sleep(2000);
  }

  Logger.log('GHENT: Repo label migration complete: ' + migrated + ' threads moved, ' + skipped + ' skipped');
}
