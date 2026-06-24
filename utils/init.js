var storage = require('./storage');
function initApp() {
  var u = storage.getUser();
  if (!u || !u.userId) {
    storage.setUser(storage.buildGuestUser());
  }
}
module.exports = { initApp: initApp };
