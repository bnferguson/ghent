import { describe, it, expect, beforeEach } from 'vitest';
import { loadGasEnvironment } from './gas-loader.mjs';

describe('labeler', () => {
  let env;

  beforeEach(() => {
    env = loadGasEnvironment();
  });

  describe('getLabelsForThread', () => {
    function makeThread(reason, subject) {
      return {
        getMessages: () => [{
          getHeader: (name) => name === 'X-GitHub-Reason' ? reason : null,
        }],
        getFirstMessageSubject: () => subject,
      };
    }

    it('returns reason and repo labels for a mention', () => {
      const labels = env.getLabelsForThread(makeThread('mention', '[Soffi-ai/soffi-main] fix: Bug (PR #1)'));
      expect(labels).toContain('GHENT/Mention');
      expect(labels).toContain('GHENT/Repos/soffi-main');
    });

    it('returns review_requested label', () => {
      const labels = env.getLabelsForThread(makeThread('review_requested', '[my-org/my-repo] feat: Thing (PR #5)'));
      expect(labels).toContain('GHENT/Review Requested');
      expect(labels).toContain('GHENT/Repos/my-repo');
    });

    it('maps author reason to Author label', () => {
      const labels = env.getLabelsForThread(makeThread('author', '[org/repo] Something (#10)'));
      expect(labels).toContain('GHENT/Author');
    });

    it('maps comment reason to Author label', () => {
      const labels = env.getLabelsForThread(makeThread('comment', '[org/repo] Something (#10)'));
      expect(labels).toContain('GHENT/Author');
    });

    it('returns Unknown label when no reason found', () => {
      const thread = {
        getMessages: () => [{ getHeader: () => null }],
        getFirstMessageSubject: () => '[org/repo] Something',
      };
      expect(env.getLabelsForThread(thread)).toContain('GHENT/Unknown');
    });

    it('skips repo label when subject has no org/repo', () => {
      const labels = env.getLabelsForThread(makeThread('mention', 'Some random subject'));
      expect(labels).toEqual(['GHENT/Mention']);
    });
  });

  describe('buildQuery', () => {
    it('returns base query when no last run', () => {
      expect(env.buildQuery()).toBe('in:inbox from:notifications@github.com');
    });

    it('adds after: filter when last run exists', () => {
      env = loadGasEnvironment({
        PropertiesService: {
          getUserProperties: () => ({
            getProperty: (key) => key === 'ghent_last_run_timestamp' ? '2026-03-08T12:00:00Z' : null,
            setProperty: () => {},
            deleteProperty: () => {},
          }),
        },
      });

      const query = env.buildQuery();
      expect(query).toContain('after:');
      expect(query).toContain('2026/03/07');
    });
  });
});
