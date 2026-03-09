import { describe, it, expect, beforeEach } from 'vitest';
import { loadGasEnvironment } from './gas-loader.mjs';

describe('headers', () => {
  let env;

  beforeEach(() => {
    env = loadGasEnvironment();
  });

  describe('getMessageReason', () => {
    it('uses X-GitHub-Reason header when present', () => {
      const message = {
        getHeader: (name) => name === 'X-GitHub-Reason' ? 'mention' : null,
      };
      expect(env.getMessageReason(message)).toBe('mention');
    });

    it('falls back to CC field when X-GitHub-Reason is missing', () => {
      const message = {
        getHeader: (name) => {
          if (name === 'Cc') return 'Brandon Ferguson <brandon@soffi.ai>, Mention <mention@noreply.github.com>';
          return null;
        },
      };
      expect(env.getMessageReason(message)).toBe('mention');
    });

    it('returns null when no reason can be determined', () => {
      const message = { getHeader: () => null };
      expect(env.getMessageReason(message)).toBeNull();
    });
  });

  describe('getReasonFromCc', () => {
    it('parses review_requested from CC', () => {
      const message = {
        getHeader: (name) => name === 'Cc' ? 'User <user@example.com>, Review requested <review_requested@noreply.github.com>' : null,
      };
      expect(env.getReasonFromCc(message)).toBe('review_requested');
    });

    it('parses author from CC', () => {
      const message = {
        getHeader: (name) => name === 'Cc' ? 'Brandon <brandon@soffi.ai>, Author <author@noreply.github.com>' : null,
      };
      expect(env.getReasonFromCc(message)).toBe('author');
    });

    it('parses assign from CC', () => {
      const message = {
        getHeader: (name) => name === 'Cc' ? 'User <user@example.com>, Assign <assign@noreply.github.com>' : null,
      };
      expect(env.getReasonFromCc(message)).toBe('assign');
    });

    it('ignores repo CC addresses like soffi-main@noreply.github.com', () => {
      const message = {
        getHeader: (name) => name === 'Cc' ? '"Soffi-ai/soffi-main" <soffi-main@noreply.github.com>' : null,
      };
      expect(env.getReasonFromCc(message)).toBeNull();
    });

    it('returns null when CC is empty', () => {
      const message = { getHeader: () => null };
      expect(env.getReasonFromCc(message)).toBeNull();
    });
  });

  describe('getRepoFromSubject', () => {
    it('extracts org and repo from PR subject', () => {
      expect(env.getRepoFromSubject('Re: [Soffi-ai/soffi-main] feat: Add thing (PR #123)'))
        .toEqual({ org: 'Soffi-ai', repo: 'soffi-main' });
    });

    it('extracts org and repo from issue subject', () => {
      expect(env.getRepoFromSubject('[my-org/my-repo] Bug report (#45)'))
        .toEqual({ org: 'my-org', repo: 'my-repo' });
    });

    it('returns null for non-GitHub subjects', () => {
      expect(env.getRepoFromSubject('Hello world')).toBeNull();
    });
  });

  describe('getThreadReason', () => {
    function makeMessage(reason) {
      return {
        getHeader: (name) => name === 'X-GitHub-Reason' ? reason : null,
      };
    }

    it('returns highest priority reason across messages', () => {
      const thread = {
        getMessages: () => [makeMessage('subscribed'), makeMessage('mention'), makeMessage('push')],
      };
      expect(env.getThreadReason(thread)).toBe('mention');
    });

    it('returns review_requested over author', () => {
      const thread = {
        getMessages: () => [makeMessage('author'), makeMessage('review_requested')],
      };
      expect(env.getThreadReason(thread)).toBe('review_requested');
    });

    it('returns null when no messages have a reason', () => {
      const thread = {
        getMessages: () => [{ getHeader: () => null }],
      };
      expect(env.getThreadReason(thread)).toBeNull();
    });
  });

  describe('getThreadRepo', () => {
    it('extracts repo from thread subject', () => {
      const thread = {
        getFirstMessageSubject: () => 'Re: [Soffi-ai/soffi-main] fix: Something (PR #42)',
      };
      expect(env.getThreadRepo(thread)).toEqual({ org: 'Soffi-ai', repo: 'soffi-main' });
    });
  });
});
