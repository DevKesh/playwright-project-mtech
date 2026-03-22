/**
 * RAG Retriever: performs top-K similarity searches against the vector store.
 *
 * Provides semantic retrieval of similar past cases for each agent type.
 */

class RAGRetriever {
  constructor(chromaStore, embeddingService) {
    this.chromaStore = chromaStore;
    this.embeddingService = embeddingService;
  }

  /**
   * Retrieve similar past healing events given a new failure context.
   * @param {string} query - Description of the current failure
   * @param {number} [topK=3] - Number of results
   * @returns {Promise<{ ids: string[], documents: string[], distances: number[], metadatas: object[] }>}
   */
  async retrieveSimilarHealingEvents(query, topK = 3) {
    const count = await this.chromaStore.count('healing-events');
    if (count === 0) return { ids: [], documents: [], distances: [], metadatas: [] };

    const queryEmbedding = await this.embeddingService.embed(query);
    return await this.chromaStore.query('healing-events', {
      queryEmbedding,
      nResults: Math.min(topK, count),
    });
  }

  /**
   * Retrieve similar past failure reports.
   * @param {string} query - Description of the current failure
   * @param {number} [topK=3]
   * @returns {Promise<object>}
   */
  async retrieveSimilarFailures(query, topK = 3) {
    const count = await this.chromaStore.count('failure-reports');
    if (count === 0) return { ids: [], documents: [], distances: [], metadatas: [] };

    const queryEmbedding = await this.embeddingService.embed(query);
    return await this.chromaStore.query('failure-reports', {
      queryEmbedding,
      nResults: Math.min(topK, count),
    });
  }

  /**
   * Retrieve page objects relevant to a given query.
   * @param {string} query - Failure or selector context
   * @param {number} [topK=2]
   * @returns {Promise<object>}
   */
  async retrieveRelevantPageObjects(query, topK = 2) {
    const count = await this.chromaStore.count('page-objects');
    if (count === 0) return { ids: [], documents: [], distances: [], metadatas: [] };

    const queryEmbedding = await this.embeddingService.embed(query);
    return await this.chromaStore.query('page-objects', {
      queryEmbedding,
      nResults: Math.min(topK, count),
    });
  }

  /**
   * Find tests related to a requirement description (semantic search).
   * @param {string} requirementDescription
   * @param {number} [topK=5]
   * @returns {Promise<object>}
   */
  async findRelatedTests(requirementDescription, topK = 5) {
    const count = await this.chromaStore.count('test-specs');
    if (count === 0) return { ids: [], documents: [], distances: [], metadatas: [] };

    const queryEmbedding = await this.embeddingService.embed(requirementDescription);
    return await this.chromaStore.query('test-specs', {
      queryEmbedding,
      nResults: Math.min(topK, count),
    });
  }
}

module.exports = { RAGRetriever };
