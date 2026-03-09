import { describe, it, expect, beforeEach } from 'vitest';
import { loadGasEnvironment } from './gas-loader.mjs';

describe('labeler', () => {
  let env;
  let prefix;

  beforeEach(() => {
    env = loadGasEnvironment();
    prefix = env.CONFIG.LABEL_PREFIX;
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
      expect(labels).toContain(`${prefix}/Mention`);
      expect(labels).toContain(`${prefix}/Repos/soffi-main`);
    });

    it('returns review_requested label', () => {
      const labels = env.getLabelsForThread(makeThread('review_requested', '[my-org/my-repo] feat: Thing (PR #5)'));
      expect(labels).toContain(`${prefix}/Review Requested`);
      expect(labels).toContain(`${prefix}/Repos/my-repo`);
    });

    it('maps author reason to Author label', () => {
      const labels = env.getLabelsForThread(makeThread('author', '[org/repo] Something (#10)'));
      expect(labels).toContain(`${prefix}/Author`);
    });

    it('maps comment reason to Author label', () => {
      const labels = env.getLabelsForThread(makeThread('comment', '[org/repo] Something (#10)'));
      expect(labels).toContain(`${prefix}/Author`);
    });

    it('returns Unknown label when no reason found', () => {
      const thread = {
        getMessages: () => [{ getHeader: () => null }],
        getFirstMessageSubject: () => '[org/repo] Something',
      };
      expect(env.getLabelsForThread(thread)).toContain(`${prefix}/Unknown`);
    });

    it('skips repo label when subject has no org/repo', () => {
      const labels = env.getLabelsForThread(makeThread('mention', 'Some random subject'));
      expect(labels).toEqual([`${prefix}/Mention`]);
    });

    it('respects custom label prefix', () => {
      env = loadGasEnvironment({
        PropertiesService: {
          getUserProperties: () => ({
            getProperty: (key) => key === 'label_prefix' ? 'MyGH' : null,
            setProperty: () => {},
            deleteProperty: () => {},
          }),
        },
      });
      const labels = env.getLabelsForThread(makeThread('mention', '[org/repo] Something'));
      expect(labels).toContain('MyGH/Mention');
      expect(labels).toContain('MyGH/Repos/repo');
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
