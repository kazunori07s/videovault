self.onmessage = function(e) {
  const files = e.data;
  const result = [];
  const CHUNK = 5000;
  for (let i = 0; i < files.length; i += CHUNK) {
    const chunk = files.slice(i, i + CHUNK).map(f => ({ name: f.name }));
    result.push(...chunk);
    self.postMessage({ type: 'progress', loaded: Math.min(i + CHUNK, files.length), total: files.length });
  }
  self.postMessage({ type: 'done' });
};
