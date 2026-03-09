// Sync Gmail mutes to GitHub unsubscribes.
//
// When you mute a thread in Gmail, this finds it, unsubscribes from
// the GitHub notification thread, then unmutes the Gmail thread.
// Future @mentions will re-subscribe you on GitHub's side.

/**
 * Main muter entry point. Called by the time-based trigger.
 */
function syncMutes() {
  var threads = GmailApp.search(CONFIG.MUTE_QUERY, 0, CONFIG.BATCH_SIZE);

  if (threads.length === 0) return;

  GmailApp.getMessagesForThreads(threads);

  for (var i = 0; i < threads.length; i++) {
    unsubscribeAndUnmute(threads[i]);
  }
}

/**
 * Unsubscribe from a GitHub thread and clear the Gmail mute.
 */
function unsubscribeAndUnmute(thread) {
  var unsubUrl = getUnsubscribeUrl(thread);

  if (unsubUrl) {
    try {
      var response = UrlFetchApp.fetch(unsubUrl, { muteHttpExceptions: true });
      if (response.getResponseCode() !== 200) {
        Logger.log('GHENT: Failed to unsubscribe (' + response.getResponseCode() + '): ' + unsubUrl);
      }
    } catch (e) {
      Logger.log('GHENT: Error unsubscribing: ' + e.message);
    }
  }

  // Clear the mute: move to inbox then archive.
  // This removes the muted state so Gmail shows future messages normally.
  thread.moveToInbox();
  thread.moveToArchive();
}

/**
 * Extract the GitHub unsubscribe URL from thread messages.
 * Checks the List-Unsubscribe header for a GitHub notifications URL.
 */
function getUnsubscribeUrl(thread) {
  var messages = thread.getMessages();

  for (var i = 0; i < messages.length; i++) {
    var header = messages[i].getHeader('List-Unsubscribe');
    if (!header) continue;

    var match = header.match(/<(https:\/\/github\.com\/notifications\/unsubscribe[^>]*)>/);
    if (match) return match[1];
  }

  return null;
}
