/**
 * Metrics Engine: computes formal reliability metrics from healing and run data.
 *
 * Metrics computed:
 * - Pass@k: probability of successful healing within k attempts
 * - Self-Healing Efficacy (SHE): ratio of successful heals to total failures
 * - AI Inference Latency: mean, median, p95, p99 of API call durations
 * - Confidence Threshold Analysis: success rates at various confidence thresholds
 */

class MetricsEngine {
  /**
   * Compute Pass@k — probability of at least one successful heal in k attempts.
   * Groups healing events by failure session (same originalSelector + testTitle within 60s).
   *
   * @param {Array} healingLog - Array of healing events from healing-log.json
   * @param {number} k - Number of attempts to consider
   * @returns {object} { k, passRate, totalSessions, successfulSessions }
   */
  computePassAtK(healingLog, k = 1) {
    if (!healingLog || healingLog.length === 0) {
      return { k, passRate: 0, totalSessions: 0, successfulSessions: 0 };
    }

    // Group events into sessions: same originalSelector within 60-second windows
    const sessions = this._groupIntoSessions(healingLog);
    let successfulSessions = 0;

    for (const session of sessions) {
      // Check if any of the first k attempts in this session succeeded
      const firstK = session.slice(0, k);
      if (firstK.some(event => event.applied === true)) {
        successfulSessions++;
      }
    }

    return {
      k,
      passRate: sessions.length > 0 ? +(successfulSessions / sessions.length).toFixed(4) : 0,
      totalSessions: sessions.length,
      successfulSessions,
    };
  }

  /**
   * Compute Self-Healing Efficacy (SHE).
   * SHE = successful_heals / total_test_failures
   *
   * @param {Array} healingLog - Healing events
   * @param {Array} runHistory - Run history entries
   * @returns {object} SHE metrics
   */
  computeSHE(healingLog, runHistory) {
    const totalHeals = (healingLog || []).filter(e => e.applied === true).length;
    const totalAttempts = (healingLog || []).length;

    // Count total test failures across all runs
    let totalFailures = 0;
    for (const run of runHistory || []) {
      for (const test of run.tests || []) {
        if (test.status === 'failed') {
          totalFailures++;
        }
      }
    }

    return {
      she: totalFailures > 0 ? +(totalHeals / totalFailures).toFixed(4) : 0,
      totalHeals,
      totalAttempts,
      totalFailures,
      healSuccessRate: totalAttempts > 0 ? +(totalHeals / totalAttempts).toFixed(4) : 0,
    };
  }

  /**
   * Compute AI inference latency statistics.
   *
   * @param {Array} latencyLog - Latency entries from latency-log.json
   * @returns {object} { mean, median, p95, p99, min, max, totalCalls, totalTimeMs }
   */
  computeLatencyStats(latencyLog) {
    if (!latencyLog || latencyLog.length === 0) {
      return {
        mean: 0, median: 0, p95: 0, p99: 0,
        min: 0, max: 0, totalCalls: 0, totalTimeMs: 0,
      };
    }

    const durations = latencyLog
      .map(e => e.durationMs)
      .filter(d => typeof d === 'number')
      .sort((a, b) => a - b);

    if (durations.length === 0) {
      return {
        mean: 0, median: 0, p95: 0, p99: 0,
        min: 0, max: 0, totalCalls: 0, totalTimeMs: 0,
      };
    }

    const sum = durations.reduce((a, b) => a + b, 0);
    const mean = Math.round(sum / durations.length);
    const median = durations[Math.floor(durations.length / 2)];
    const p95 = durations[Math.floor(durations.length * 0.95)];
    const p99 = durations[Math.floor(durations.length * 0.99)];

    return {
      mean,
      median,
      p95,
      p99,
      min: durations[0],
      max: durations[durations.length - 1],
      totalCalls: durations.length,
      totalTimeMs: sum,
      successRate: +(latencyLog.filter(e => e.success).length / latencyLog.length).toFixed(4),
      byMethod: this._groupLatencyByMethod(latencyLog),
    };
  }

  /**
   * Analyze confidence threshold effectiveness.
   * For each threshold, compute how many suggestions would pass and their success rate.
   *
   * @param {Array} healingLog - Healing events
   * @returns {Array} Threshold analysis entries
   */
  computeConfidenceAnalysis(healingLog) {
    if (!healingLog || healingLog.length === 0) return [];

    const eventsWithConfidence = healingLog.filter(
      e => typeof e.confidence === 'number' && e.confidence > 0
    );

    if (eventsWithConfidence.length === 0) return [];

    const thresholds = [0.5, 0.6, 0.7, 0.8, 0.9];

    return thresholds.map(threshold => {
      const accepted = eventsWithConfidence.filter(e => e.confidence >= threshold);
      const rejected = eventsWithConfidence.filter(e => e.confidence < threshold);
      const acceptedSuccesses = accepted.filter(e => e.applied === true).length;
      const rejectedSuccesses = rejected.filter(e => e.applied === true).length;

      return {
        threshold,
        acceptedCount: accepted.length,
        rejectedCount: rejected.length,
        acceptedSuccessRate: accepted.length > 0
          ? +(acceptedSuccesses / accepted.length).toFixed(4)
          : 0,
        rejectedSuccessRate: rejected.length > 0
          ? +(rejectedSuccesses / rejected.length).toFixed(4)
          : 0,
        missedOpportunities: rejectedSuccesses,
      };
    });
  }

  /**
   * Compute all metrics and return a comprehensive report.
   */
  computeAll(healingLog, runHistory, latencyLog) {
    return {
      timestamp: new Date().toISOString(),
      passAt1: this.computePassAtK(healingLog, 1),
      passAt2: this.computePassAtK(healingLog, 2),
      passAt3: this.computePassAtK(healingLog, 3),
      selfHealingEfficacy: this.computeSHE(healingLog, runHistory),
      latency: this.computeLatencyStats(latencyLog),
      confidenceAnalysis: this.computeConfidenceAnalysis(healingLog),
      summary: {
        totalTestRuns: (runHistory || []).length,
        totalHealingEvents: (healingLog || []).length,
        totalAICalls: (latencyLog || []).length,
      },
    };
  }

  // --- Private helpers ---

  /**
   * Group healing events into sessions (events within 60s of each other
   * for the same selector are considered one session).
   */
  _groupIntoSessions(healingLog) {
    if (healingLog.length === 0) return [];

    const sorted = [...healingLog].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const sessions = [];
    let currentSession = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];

      const timeDiff = new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime();
      const sameSelector = curr.originalSelector === prev.originalSelector;

      if (sameSelector && timeDiff < 60000) {
        currentSession.push(curr);
      } else {
        sessions.push(currentSession);
        currentSession = [curr];
      }
    }
    sessions.push(currentSession);

    return sessions;
  }

  /**
   * Group latency stats by API method.
   */
  _groupLatencyByMethod(latencyLog) {
    const groups = {};
    for (const entry of latencyLog) {
      const method = entry.method || 'unknown';
      if (!groups[method]) {
        groups[method] = { totalCalls: 0, totalMs: 0, successes: 0 };
      }
      groups[method].totalCalls++;
      groups[method].totalMs += entry.durationMs || 0;
      if (entry.success) groups[method].successes++;
    }

    for (const method of Object.keys(groups)) {
      const g = groups[method];
      g.avgMs = g.totalCalls > 0 ? Math.round(g.totalMs / g.totalCalls) : 0;
      g.successRate = g.totalCalls > 0 ? +(g.successes / g.totalCalls).toFixed(4) : 0;
    }

    return groups;
  }
}

module.exports = { MetricsEngine };
