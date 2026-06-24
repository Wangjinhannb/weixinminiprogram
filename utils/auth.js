var storage = require('./storage');

function callSyncUser(payload) {
  return new Promise(function (resolve, reject) {
    wx.cloud.callFunction({
      name: 'syncUser',
      data: payload || {},
      success: function (res) {
        var result = res && res.result ? res.result : {};
        if (result.code === 200) {
          var user = storage.normalizeUser(result.data || {});
          storage.setUser(user);
          resolve(user);
        } else {
          var err = new Error(result.message || '服务异常');
          err.code = result.code;
          err.result = result;
          reject(err);
        }
      },
      fail: function (err) {
        reject(err);
      }
    });
  });
}

function uploadAvatarIfNeeded(filePath) {
  filePath = String(filePath || '').trim();
  if (!filePath) return Promise.resolve('');
  if (filePath.indexOf('cloud://') === 0 || /^https?:\/\//.test(filePath)) return Promise.resolve(filePath);
  var ext = '.png';
  var matched = filePath.match(/(\.[a-zA-Z0-9]+)$/);
  if (matched && matched[1]) ext = matched[1];
  var cloudPath = 'user-avatars/' + Date.now() + '_' + Math.floor(Math.random() * 1000000) + ext;
  return new Promise(function (resolve, reject) {
    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: filePath,
      success: function (res) {
        resolve((res && res.fileID) || '');
      },
      fail: reject
    });
  });
}

function saveWechatIdentity(action) {
  return callSyncUser({ action: action });
}

function loginWithWechat() {
  return saveWechatIdentity('wechatLogin');
}

function bindWechat() {
  return saveWechatIdentity('bindWechat');
}

function loginWithPhone(code) {
  return callSyncUser({ action: 'phoneLogin', phoneCode: code });
}

function bindPhone(code) {
  return callSyncUser({ action: 'bindPhone', phoneCode: code });
}

function logout() {
  var guest = storage.buildGuestUser();
  storage.setUser(guest);
  return guest;
}

module.exports = {
  callSyncUser: callSyncUser,
  loginWithWechat: loginWithWechat,
  loginWithPhone: loginWithPhone,
  bindWechat: bindWechat,
  bindPhone: bindPhone,
  uploadAvatarIfNeeded: uploadAvatarIfNeeded,
  logout: logout
};
