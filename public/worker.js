'use strict';
importScripts('diff.js?v=__V__');

self.onmessage = (e) => {
  const { id, left, right, opts } = e.data;
  try {
    self.postMessage({ id, result: DiffEngine.compare(left, right, opts) });
  } catch (err) {
    self.postMessage({ id, error: String(err && err.message || err) });
  }
};
