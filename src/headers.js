// Parse GitHub notification metadata from email headers and fields.

/**
 * Extract the notification reason from a Gmail message.
 * Tries X-GitHub-Reason header first, falls back to CC field parsing.
 */
function getMessageReason(message) {
  var reason = message.getHeader('X-GitHub-Reason');
  if (reason) return reason.trim().toLowerCase();

  return getReasonFromCc(message);
}

/**
 * Parse notification reason from the CC field.
 * GitHub encodes the reason as <reason>@noreply.github.com in CC.
 */
function getReasonFromCc(message) {
  var raw = message.getHeader('Cc') || '';
  var match = raw.match(/([a-z_]+)@noreply\.github\.com/);
  if (!match) return null;

  var cc = match[1];
  // Filter out non-reason CC addresses (repo names, reply addresses)
  var validReasons = [
    'mention', 'author', 'review_requested', 'assign', 'push',
    'subscribed', 'team_mention', 'comment', 'state_change',
    'ci_activity', 'manual'
  ];
  return validReasons.indexOf(cc) !== -1 ? cc : null;
}

/**
 * Extract org/repo from the email subject.
 * Subjects look like: "Re: [Soffi-ai/soffi-main] feat: Add thing (PR #123)"
 */
function getRepoFromSubject(subject) {
  var match = subject.match(/\[([^\]]+\/[^\]]+)\]/);
  if (!match) return null;

  var parts = match[1].split('/');
  return { org: parts[0], repo: parts[1] };
}

/**
 * Get the highest-priority reason across all messages in a thread.
 */
function getThreadReason(thread) {
  var messages = thread.getMessages();
  var bestReason = null;
  var bestPriority = Infinity;

  for (var i = 0; i < messages.length; i++) {
    var reason = getMessageReason(messages[i]);
    if (!reason) continue;

    var info = REASON_PRIORITY[reason] || DEFAULT_REASON;
    if (info.priority < bestPriority) {
      bestPriority = info.priority;
      bestReason = reason;
    }
  }

  return bestReason;
}

/**
 * Get the repo info from the first message's subject in a thread.
 */
function getThreadRepo(thread) {
  return getRepoFromSubject(thread.getFirstMessageSubject());
}
