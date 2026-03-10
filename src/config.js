// GHENT Configuration
// All user-facing settings are read from Script Properties in the GAS editor.
// See README for setup instructions.

var CONFIG = (function() {
  var props = PropertiesService.getScriptProperties();
  return {
    LABEL_PREFIX: props.getProperty('label_prefix') || 'GHENT',
    SHOULD_ARCHIVE: props.getProperty('should_archive') !== 'false',
    BATCH_SIZE: parseInt(props.getProperty('batch_size'), 10) || 50,
    TRIGGER_INTERVAL_MINUTES: parseInt(props.getProperty('trigger_interval_minutes'), 10) || 5,
    QUERY: 'in:inbox from:notifications@github.com',
    MUTE_QUERY: 'is:muted from:notifications@github.com',
    LAST_RUN_KEY: 'ghent_last_run_timestamp',
  };
})();

// Notification reason priority (lower = higher priority).
// When a thread has multiple reasons, the highest priority wins.
var REASON_PRIORITY = {
  'mention':          { priority: 1, label: 'Mention' },
  'review_requested': { priority: 2, label: 'Review Requested' },
  'assign':           { priority: 3, label: 'Assigned' },
  'author':           { priority: 4, label: 'Author' },
  'comment':          { priority: 4, label: 'Author' },
  'state_change':     { priority: 4, label: 'Author' },
  'team_mention':     { priority: 5, label: 'Team Mention' },
  'ci_activity':      { priority: 6, label: 'CI' },
  'subscribed':       { priority: 7, label: 'Subscribed' },
  'manual':           { priority: 7, label: 'Subscribed' },
  'push':             { priority: 7, label: 'Subscribed' },
};

var DEFAULT_REASON = { priority: 99, label: 'Unknown' };
