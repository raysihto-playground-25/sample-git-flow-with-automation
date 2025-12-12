module.exports = {
  target: (name /*, semver */) => (name === '@types/node' ? 'minor' : 'latest'),
};
