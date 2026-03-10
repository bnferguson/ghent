// Label GitHub notification threads by reason and repo, then archive.

/**
 * Main labeler entry point. Called by the time-based trigger.
 */
function labelAndArchive() {
  var query = buildQuery();
  var startTime = new Date().getTime();
  var maxRuntime = 5 * 60 * 1000; // 5 minutes (GAS limit is 6)
  var totalProcessed = 0;

  while (true) {
    // Safety valve: stop before hitting GAS execution limit
    if (new Date().getTime() - startTime > maxRuntime) {
      Logger.log('GHENT: Stopping after ' + totalProcessed + ' threads (approaching time limit)');
      break;
    }

    var threads = GmailApp.search(query, 0, CONFIG.BATCH_SIZE);
    if (threads.length === 0) break;

    // Pre-fetch all messages for efficiency
    GmailApp.getMessagesForThreads(threads);

    // Build a map of label name -> [thread, thread, ...]
    var labelMap = {};

    for (var i = 0; i < threads.length; i++) {
      var thread = threads[i];
      removeStaleReasonLabels(thread);
      var labels = getLabelsForThread(thread);

      for (var j = 0; j < labels.length; j++) {
        var labelName = labels[j];
        if (!labelMap[labelName]) labelMap[labelName] = [];
        labelMap[labelName].push(thread);
      }
    }

    // Apply labels in batch
    var labelNames = Object.keys(labelMap);
    for (var i = 0; i < labelNames.length; i++) {
      var label = findOrCreateLabel(labelNames[i]);
      label.addToThreads(labelMap[labelNames[i]]);
    }

    // Archive
    if (CONFIG.SHOULD_ARCHIVE) {
      GmailApp.moveThreadsToArchive(threads);
    }

    totalProcessed += threads.length;
    Logger.log('GHENT: Processed ' + totalProcessed + ' threads so far');

    // If we got fewer than BATCH_SIZE, we're done
    if (threads.length < CONFIG.BATCH_SIZE) break;
  }

  // Update last run timestamp
  var props = PropertiesService.getScriptProperties();
  props.setProperty(CONFIG.LAST_RUN_KEY, new Date().toISOString());

  Logger.log('GHENT: Done. Processed ' + totalProcessed + ' threads total');
}

/**
 * Determine which labels to apply to a thread.
 * Returns an array of full label paths like ["GHENT/Mention", "GHENT/Repos/soffi-main"].
 */
function getLabelsForThread(thread) {
  var labels = [];
  var prefix = CONFIG.LABEL_PREFIX;

  // Reason label
  var reason = getThreadReason(thread);
  var reasonInfo = reason ? (REASON_PRIORITY[reason] || DEFAULT_REASON) : DEFAULT_REASON;
  labels.push(prefix + '/' + reasonInfo.label);

  // Repo label
  var repo = getThreadRepo(thread);
  if (repo) {
    labels.push(prefix + '/Repos/' + repo.repo);
  }

  return labels;
}

/**
 * Remove any existing GHENT reason labels from a thread.
 * Called before applying the new reason so we don't accumulate stale labels
 * when a thread's priority upgrades (e.g., Subscribed -> Mention).
 */
function removeStaleReasonLabels(thread) {
  var prefix = CONFIG.LABEL_PREFIX + '/';
  var repoPrefix = CONFIG.LABEL_PREFIX + '/Repos/';
  var threadLabels = thread.getLabels();

  for (var i = 0; i < threadLabels.length; i++) {
    var name = threadLabels[i].getName();
    // Remove GHENT reason labels but keep repo labels
    if (name.indexOf(prefix) === 0 && name.indexOf(repoPrefix) !== 0 && name !== CONFIG.LABEL_PREFIX) {
      thread.removeLabel(threadLabels[i]);
    }
  }
}

/**
 * Build the Gmail search query, scoped to messages since last run.
 */
function buildQuery() {
  var query = CONFIG.QUERY;

  var props = PropertiesService.getScriptProperties();
  var lastRun = props.getProperty(CONFIG.LAST_RUN_KEY);

  if (lastRun) {
    var date = new Date(lastRun);
    // Go back 1 day from last run to catch any stragglers
    date.setDate(date.getDate() - 1);
    var dateStr = Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy/MM/dd');
    query += ' after:' + dateStr;
  }

  return query;
}

// Label cache to avoid repeated lookups
var labelCache = {};

/**
 * Find a Gmail label by name, creating it (and parents) if needed.
 */
function findOrCreateLabel(name) {
  if (labelCache[name]) return labelCache[name];

  // Ensure parent labels exist
  var parts = name.split('/');
  for (var i = 1; i < parts.length; i++) {
    var parentName = parts.slice(0, i).join('/');
    if (!labelCache[parentName]) {
      labelCache[parentName] = GmailApp.getUserLabelByName(parentName) || GmailApp.createLabel(parentName);
    }
  }

  labelCache[name] = GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
  return labelCache[name];
}
