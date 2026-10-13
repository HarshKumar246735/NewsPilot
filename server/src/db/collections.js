// Single source of truth for collections: unique fields and secondary indexes.
// Both the Mongoose adapter (production) and the in-memory adapter (tests, local trial) read this.
export const COLLECTIONS = {
  users: { unique: ['id', 'email'], fields: { id: String, email: String, name: String, role: String, passwordHash: String, tokenVersion: Number, active: Boolean, createdAt: String, lastLoginAt: String } },
  articles: { unique: ['id', 'slug'], index: [['status', 'publishedAt'], ['categorySlug', 'publishedAt'], ['authorSlug', 'publishedAt'], ['isBreaking', 'status'], ['views']] },
  categories: { unique: ['id', 'slug'], index: [['parentSlug', 'order']] },
  authors: { unique: ['id', 'slug'] },
  media: { unique: ['id'], index: [['createdAt']] },
  settings: { unique: ['id'] },
  redirects: { unique: ['id', 'from'] },
  subscribers: { unique: ['id', 'email', 'token'] },
  comments: { unique: ['id'], index: [['articleId', 'status'], ['status', 'createdAt']] },
  ads: { unique: ['id'], index: [['placement']] },
  audit: { unique: ['id'], index: [['createdAt']] },
};
