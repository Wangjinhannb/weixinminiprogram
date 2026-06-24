var bookingApi = require('../../utils/bookingApi');
var ui = require('../../utils/ui');
var storage = require('../../utils/storage');
var userSession = require('../../utils/userSession');

function buildUserCard(item) {
  item = item || {};
  item.roleText = item.isSuperAdmin ? '超级管理员' : (item.canEnterAdmin ? '普通管理员' : '普通用户');
  item.loginTypeText = item.loginType === 'phone' ? '手机号登录' : (item.loginType === 'wechat' ? '微信登录' : '未识别登录方式');
  item.displayName = item.nickName || item.phoneMask || item.userId || '未命名用户';
  item.bindText = (item.isWechatBound ? '已绑定微信' : '未绑定微信') + ' / ' + (item.isPhoneBound ? '已绑定手机号' : '未绑定手机号');
  item.actionText = item.canEnterAdmin ? '移除管理员' : '设为管理员';
  return item;
}

Page({
  data: {
    uiFontSizePx: 16,
    user: null,
    keyword: '',
    list: [],
    loading: false,
    loadError: ''
  },

  onShow: function () {
    try {
      this.setData({ uiFontSizePx: getApp().globalData.uiFontSizePx || 16 });
      var tb = this.getTabBar && this.getTabBar();
      if (tb && tb.syncFont) tb.syncFont();
    } catch (e) {}
    this.ensurePermissionAndLoad(true);
  },

  ensurePermissionAndLoad: function (silent) {
    var that = this;
    var user = storage.getUser() || null;
    this.setData({ user: user });
    return userSession.refreshCurrentUser({ user: user, silent: silent !== false }).then(function (syncRes) {
      var latestUser = syncRes && syncRes.user ? syncRes.user : (storage.getUser() || null);
      that.setData({ user: latestUser });
      if (!latestUser || !latestUser.canManageAdmins) {
        ui.toast('仅超级管理员可访问');
        wx.switchTab({ url: '/pages/my/my' });
        return;
      }
      that.reload();
    }).catch(function (err) {
      console.error('管理员权限页静默同步失败', err);
      var fallbackUser = storage.getUser() || null;
      that.setData({ user: fallbackUser });
      if (!fallbackUser || !fallbackUser.canManageAdmins) {
        ui.toast('仅超级管理员可访问');
        wx.switchTab({ url: '/pages/my/my' });
        return;
      }
      that.reload();
    });
  },

  onKeywordInput: function (e) {
    this.setData({ keyword: (e.detail && e.detail.value) || '' });
  },

  onSearch: function () {
    this.reload();
  },

  onClear: function () {
    this.setData({ keyword: '' });
    this.reload();
  },

  reload: function () {
    var that = this;
    this.setData({ loading: true, loadError: '' });
    bookingApi.listAdminUsers(this.data.keyword).then(function (list) {
      list = list || [];
      for (var i = 0; i < list.length; i++) list[i] = buildUserCard(list[i]);
      that.setData({ list: list, loadError: '' });
    }).catch(function (err) {
      console.error('加载管理员用户列表失败', err);
      that.setData({ list: [], loadError: (err && err.message) || '加载失败' });
      ui.toast((err && err.message) || '加载失败');
    }).finally(function () {
      that.setData({ loading: false });
    });
  },

  onToggleAdmin: function (e) {
    var that = this;
    var userId = e.currentTarget.dataset.userId || '';
    var canEnterAdmin = e.currentTarget.dataset.canEnterAdmin === true || e.currentTarget.dataset.canEnterAdmin === 'true';
    var isSuperAdmin = e.currentTarget.dataset.isSuperAdmin === true || e.currentTarget.dataset.isSuperAdmin === 'true';
    var targetName = e.currentTarget.dataset.name || userId || '该用户';
    if (!userId) return ui.toast('缺少用户标识');
    if (isSuperAdmin) return ui.toast('超级管理员权限固定，不支持修改');

    wx.showModal({
      title: canEnterAdmin ? '移除管理员' : '设为管理员',
      content: canEnterAdmin
        ? ('确认移除“' + targetName + '”的管理员权限吗？')
        : ('确认授予“' + targetName + '”普通管理员权限吗？'),
      confirmColor: canEnterAdmin ? '#e64340' : '#111827',
      success: function (res) {
        if (!res.confirm) return;
        ui.loading('处理中');
        bookingApi.setUserAdminPermission(userId, !canEnterAdmin).then(function () {
          ui.toast(!canEnterAdmin ? '已设为普通管理员' : '已移除管理员权限');
          that.reload();
        }).catch(function (err) {
          console.error('更新管理员权限失败', err);
          ui.toast((err && err.message) || '操作失败');
        }).finally(function () {
          ui.hideLoading();
        });
      }
    });
  }
});
