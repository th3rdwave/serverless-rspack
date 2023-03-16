const log = jest.fn();
log.error = jest.fn();
log.get = jest.fn(() => log);
log.verbose = jest.fn();
log.warning = jest.fn();

const progress = jest.fn();
progress.get = jest.fn(() => progress);
progress.update = jest.fn();
progress.notice = jest.fn();
progress.remove = jest.fn();

module.exports = {
  log,
  progress,
};
