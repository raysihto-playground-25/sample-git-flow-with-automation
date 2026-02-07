module.exports = {
  target: (/** @type {string} */ name /*, semver */) => {
    if (
      // Node: execution environment is Node 24; do not upgrade to Node 25+.
      name === '@types/node'
    ) {
      return 'minor';
    }
    return 'latest';
  },
};
