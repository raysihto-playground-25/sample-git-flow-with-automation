export default {
  target: (name /*, semver */) => (name === '@types/node' ? 'minor' : 'latest'),
};
