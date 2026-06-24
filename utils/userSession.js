var storage = require('./storage');

function isGuest(user) {
  return storage.isGuest(user);
}

function refreshCurrentUser(options) {
  options = options || {};
  var silent = options.silent !== false;
  var currentUser = storage.normalizeUser(options.user || storage.getUser());
  if (isGuest(currentUser)) {
    return Promise.resolve({ skipped: true, user: currentUser || null, changed: false, silent: silent });
  }
  return new Promise(function (resolve, reject) {
    wx.cloud.callFunction({
      name: 'syncUser',
      data: { action: 'refresh' },
      success: function (res) {
        var result = (res && res.result) || {};
        if (result.code !== 200) {
          var err = new Error(result.message || '同步用户失败');
          err.result = result;
          reject(err);
          return;
        }
        var latestUser = storage.normalizeUser(result.data || {});
        var changed = (
          !!currentUser.canEnterAdmin !== !!latestUser.canEnterAdmin ||
          !!currentUser.isAdmin !== !!latestUser.isAdmin ||
          !!currentUser.isSuperAdmin !== !!latestUser.isSuperAdmin ||
          (currentUser.adminRole || '') !== (latestUser.adminRole || '') ||
          (currentUser.nickName || '') !== (latestUser.nickName || '') ||
          (currentUser.avatarUrl || '') !== (latestUser.avatarUrl || '') ||
          (currentUser.phone || '') !== (latestUser.phone || '') ||
          !!currentUser.isPhoneBound !== !!latestUser.isPhoneBound ||
          !!currentUser.isWechatBound !== !!latestUser.isWechatBound ||
          (currentUser.loginType || '') !== (latestUser.loginType || '')
        );
        storage.setUser(latestUser);
        resolve({
          skipped: false,
          changed: changed,
          user: latestUser,
          adminChanged: !!currentUser && (
          !!currentUser.canEnterAdmin !== !!latestUser.canEnterAdmin ||
          !!currentUser.isSuperAdmin !== !!latestUser.isSuperAdmin ||
          (currentUser.adminRole || '') !== (latestUser.adminRole || '')
        ),
          silent: silent
        });
      },
      fail: function (err) {
        reject(err);
      }
    });
  });
}

module.exports = {
  isGuest: isGuest,
  refreshCurrentUser: refreshCurrentUser
};
