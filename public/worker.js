'use strict';
importScripts('diff.js?v=__V__');

self.onmessage = (e) => {
  const { id, left, right, opts } = e.data;
  try {
    const t0 = Date.now();
    const result = DiffEngine.compare(left, right, opts);
    result.ms = Date.now() - t0;
    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({ id, error: String(err && err.message || err) });
  }
};
