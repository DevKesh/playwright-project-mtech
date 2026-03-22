/**
 * Embedding Service: generates vector embeddings via OpenAI's text-embedding API.
 *
 * Uses text-embedding-3-small (1536 dimensions) for cost-effective embeddings.
 * Supports single and batch embedding generation.
 */

const OpenAI = require('openai');

class EmbeddingService {
  constructor(config) {
    this.config = config;
    this.client = new OpenAI({ apiKey: config.openaiApiKey });
    this.model = config.embeddingModel || 'text-embedding-3-small';
  }

  /**
   * Generate an embedding for a single text.
   * @param {string} text - Text to embed
   * @returns {Promise<number[]>} Embedding vector
   */
  async embed(text) {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: text,
    });
    return response.data[0].embedding;
  }

  /**
   * Generate embeddings for multiple texts in a single API call.
   * @param {string[]} texts - Array of texts to embed (max 2048 per call)
   * @returns {Promise<number[][]>} Array of embedding vectors
   */
  async embedBatch(texts) {
    if (texts.length === 0) return [];

    // OpenAI supports up to 2048 inputs per call
    const batchSize = 2048;
    const allEmbeddings = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const response = await this.client.embeddings.create({
        model: this.model,
        input: batch,
      });
      allEmbeddings.push(...response.data.map(d => d.embedding));
    }

    return allEmbeddings;
  }
}

module.exports = { EmbeddingService };
