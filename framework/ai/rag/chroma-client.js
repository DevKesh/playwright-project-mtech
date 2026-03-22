/**
 * ChromaDB Client Wrapper: local vector database for RAG.
 *
 * Uses ChromaDB with local file persistence at ai-reports/chromadb/.
 * Provides collection management, document insertion, and similarity search.
 *
 * Note: If the chromadb npm package is not installed or requires a server,
 * this module falls back to a lightweight in-memory + JSON-file vector store
 * with cosine similarity computed in Node.js.
 */

const fs = require('fs');
const path = require('path');

const CHROMA_DIR = path.resolve(__dirname, '../../../ai-reports/chromadb');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Cosine similarity between two vectors.
 */
function cosineSimilarity(a, b) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Local file-based vector store that mimics ChromaDB's API.
 * Each collection is stored as a JSON file in ai-reports/chromadb/.
 */
class ChromaStore {
  constructor(config) {
    this.config = config;
    this.baseDir = CHROMA_DIR;
    this.collections = {};
  }

  async initialize() {
    ensureDir(this.baseDir);

    // Try to load ChromaDB JS client if available
    try {
      const { ChromaClient } = require('chromadb');
      this._chromaClient = new ChromaClient({ path: this.baseDir });
      this._useNative = true;
      console.log('[RAG] Using native ChromaDB client');
    } catch {
      this._useNative = false;
      console.log('[RAG] ChromaDB not available, using local JSON vector store');
    }
  }

  /**
   * Get or create a collection.
   * @param {string} name - Collection name
   * @returns {Promise<object>} Collection reference
   */
  async getOrCreateCollection(name) {
    if (this._useNative && this._chromaClient) {
      try {
        this.collections[name] = await this._chromaClient.getOrCreateCollection({
          name,
          metadata: { 'hnsw:space': 'cosine' },
        });
        return this.collections[name];
      } catch {
        // Fall through to local store
      }
    }

    // Local file-based collection
    const collectionPath = path.join(this.baseDir, `${name}.json`);
    if (!this.collections[name]) {
      this.collections[name] = this._loadLocalCollection(collectionPath);
      this.collections[name]._path = collectionPath;
      this.collections[name]._name = name;
    }
    return this.collections[name];
  }

  /**
   * Add documents with embeddings to a collection.
   * @param {string} collectionName
   * @param {object} params
   * @param {string[]} params.ids - Document IDs
   * @param {string[]} params.documents - Document texts
   * @param {object[]} [params.metadatas] - Per-document metadata
   * @param {number[][]} params.embeddings - Embedding vectors
   */
  async addDocuments(collectionName, { ids, documents, metadatas, embeddings }) {
    const collection = await this.getOrCreateCollection(collectionName);

    if (this._useNative && collection.add) {
      try {
        await collection.add({ ids, documents, metadatas, embeddings });
        return;
      } catch {
        // Fall through to local store
      }
    }

    // Local store: append documents
    for (let i = 0; i < ids.length; i++) {
      // Overwrite if ID already exists
      const existingIdx = collection.documents.findIndex(d => d.id === ids[i]);
      const entry = {
        id: ids[i],
        document: documents[i],
        metadata: metadatas ? metadatas[i] : {},
        embedding: embeddings[i],
      };

      if (existingIdx >= 0) {
        collection.documents[existingIdx] = entry;
      } else {
        collection.documents.push(entry);
      }
    }

    this._saveLocalCollection(collection);
  }

  /**
   * Query a collection for the most similar documents.
   * @param {string} collectionName
   * @param {object} params
   * @param {number[]} params.queryEmbedding - Query vector
   * @param {number} [params.nResults=3] - Number of results to return
   * @returns {Promise<{ ids: string[], documents: string[], distances: number[], metadatas: object[] }>}
   */
  async query(collectionName, { queryEmbedding, nResults = 3 }) {
    const collection = await this.getOrCreateCollection(collectionName);

    if (this._useNative && collection.query) {
      try {
        return await collection.query({
          queryEmbeddings: [queryEmbedding],
          nResults,
        });
      } catch {
        // Fall through to local
      }
    }

    // Local similarity search
    if (collection.documents.length === 0) {
      return { ids: [], documents: [], distances: [], metadatas: [] };
    }

    const scored = collection.documents
      .filter(doc => doc.embedding && doc.embedding.length > 0)
      .map(doc => ({
        ...doc,
        similarity: cosineSimilarity(queryEmbedding, doc.embedding),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, nResults);

    return {
      ids: scored.map(s => s.id),
      documents: scored.map(s => s.document),
      distances: scored.map(s => 1 - s.similarity), // Convert similarity to distance
      metadatas: scored.map(s => s.metadata),
    };
  }

  /**
   * Get the count of documents in a collection.
   * @param {string} collectionName
   * @returns {Promise<number>}
   */
  async count(collectionName) {
    const collection = await this.getOrCreateCollection(collectionName);

    if (this._useNative && collection.count) {
      try {
        return await collection.count();
      } catch {
        // Fall through
      }
    }

    return collection.documents.length;
  }

  // --- Private helpers ---

  _loadLocalCollection(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
    } catch {
      // Corrupted file
    }
    return { documents: [] };
  }

  _saveLocalCollection(collection) {
    ensureDir(this.baseDir);
    // Don't save embeddings to disk to keep file sizes manageable for JSON
    const toSave = {
      documents: collection.documents.map(d => ({
        id: d.id,
        document: d.document,
        metadata: d.metadata,
        embedding: d.embedding,
      })),
    };
    fs.writeFileSync(collection._path, JSON.stringify(toSave, null, 2), 'utf-8');
  }
}

module.exports = { ChromaStore, cosineSimilarity };
