export class NotFoundError extends Error { constructor(m = 'Not found') { super(m); this.name = 'NotFoundError'; } }
export class DataError extends Error { constructor(m = 'Data source error') { super(m); this.name = 'DataError'; } }
