/**
 * RAG Prompt Enhancer: injects similar past cases into agent prompts.
 *
 * This is the integration layer between the RAG retriever and the existing
 * prompt builders. It enhances prompt params with a ragContext field that
 * prompt builders append to their user prompts.
 */

class RAGPromptEnhancer {
  constructor(retriever) {
    this.retriever = retriever;
  }

  /**
   * Enhance locator healing prompt params with similar past healings.
   * @param {object} promptParams - Original params for buildLocatorHealingPrompt
   * @returns {Promise<object>} Enhanced params with ragContext
   */
  async enhanceLocatorHealingPrompt(promptParams) {
    try {
      const query = `Selector "${promptParams.failedSelector}" failed with error: ${promptParams.errorMessage}. Action: ${promptParams.action}`;
      const similar = await this.retriever.retrieveSimilarHealingEvents(query, 3);
      const ragContext = this._formatContext('Similar past healing events', similar);
      return { ...promptParams, ragContext };
    } catch (err) {
      console.log(`[RAG] Failed to enhance locator healing prompt: ${err.message}`);
      return promptParams;
    }
  }

  /**
   * Enhance failure analysis prompt params with similar past failures.
   * @param {object} promptParams - Original params for buildFailureAnalysisPrompt
   * @returns {Promise<object>} Enhanced params with ragContext
   */
  async enhanceFailureAnalysisPrompt(promptParams) {
    try {
      const query = `Test "${promptParams.testTitle}" failed: ${promptParams.errorMessage}`;
      const similar = await this.retriever.retrieveSimilarFailures(query, 3);
      const ragContext = this._formatContext('Similar past failures from knowledge base', similar);
      return { ...promptParams, ragContext };
    } catch (err) {
      console.log(`[RAG] Failed to enhance failure analysis prompt: ${err.message}`);
      return promptParams;
    }
  }

  /**
   * Enhance test case healing prompt params with similar past fixes.
   * @param {object} promptParams - Original params for buildTestCaseHealingPrompt
   * @returns {Promise<object>} Enhanced params with ragContext
   */
  async enhanceTestCaseHealingPrompt(promptParams) {
    try {
      const query = `Test "${promptParams.testTitle}" failed: ${promptParams.errorMessage}. File: ${promptParams.testFile}`;
      const [failures, healings] = await Promise.all([
        this.retriever.retrieveSimilarFailures(query, 2),
        this.retriever.retrieveSimilarHealingEvents(query, 2),
      ]);

      let ragContext = '';
      ragContext += this._formatContext('Similar past failures', failures);
      ragContext += this._formatContext('Related healing attempts', healings);
      return { ...promptParams, ragContext };
    } catch (err) {
      console.log(`[RAG] Failed to enhance test case healing prompt: ${err.message}`);
      return promptParams;
    }
  }

  /**
   * Format retrieved results into a context block for prompt injection.
   * @param {string} title - Section title
   * @param {object} results - Query results with documents array
   * @returns {string} Formatted context or empty string
   */
  _formatContext(title, results) {
    if (!results || !results.documents || results.documents.length === 0) {
      return '';
    }

    const entries = results.documents.map((doc, i) => {
      const distance = results.distances?.[i] !== undefined
        ? ` (relevance: ${(1 - results.distances[i]).toFixed(2)})`
        : '';
      return `${i + 1}. ${doc}${distance}`;
    });

    return `\n\n**${title}:**\n${entries.join('\n')}\n`;
  }
}

module.exports = { RAGPromptEnhancer };
