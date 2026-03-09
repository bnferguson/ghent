// GHENT Configuration
// Modify these values via Script Properties in the GAS editor,
// or change defaults here before pushing.

var CONFIG = {
  // Top-level Gmail label. Set via Script Properties key "label_prefix",
  // or change the default here. Labels will be created as:
  //   <prefix>/Mention, <prefix>/Repos/my-repo, etc.
  LABEL_PREFIX: PropertiesService.getUserProperties().getProperty('label_prefix') || 'GHENT',
  SHOULD_ARCHIVE: true,
  QUERY: 'in:inbox from:notifications@github.com',
  MUTE_QUERY: 'is:muted from:notifications@github.com',
  // Max threads to process per run (GAS has a 6-min execution limit)
  BATCH_SIZE: 50,
  // Property key for tracking last processed timestamp
  LAST_RUN_KEY: 'ghent_last_run_timestamp',
  // Trigger interval in minutes
  TRIGGER_INTERVAL_MINUTES: 5,
};

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
