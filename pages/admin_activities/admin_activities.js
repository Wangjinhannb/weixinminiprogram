var activityNotice = require('../../utils/activityNotice');
var ui = require('../../utils/ui');
var storage = require('../../utils/storage');
var userSession = require('../../utils/userSession');

function pad2(n) {
  n = Number(n || 0) || 0;
  return n < 10 ? '0' + n : '' + n;
}

function formatDateTime(value) {
  if (!value) return '';
  var d = null;
  if (value instanceof Date) d = value;
  else if (typeof value === 'string' || typeof value === 'number') d = new Date(value);
  else if (value.$date) d = new Date(value.$date);
  if (!d || isNaN(d.getTime())) return '';
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

Page({
  data: {
    uiFontSizePx: 16,
    user: null,
    activities: [],
    loading: false,
    loadError: ''
  },

  onShow: function () {
    var that = this;
    try {
      this.setData({ uiFontSizePx: getApp().globalData.uiFontSizePx || 16 });
      var tb = this.getTabBar && this.getTabBar();
      if (tb && tb.syncFont) tb.syncFont();
    } catch (e) {}
    var user = storage.getUser() || null;
    this.setData({ user: user });
    userSession.refreshCurrentUser({ user: user, silent: true }).then(function (syncRes) {
      var latestUser = syncRes && syncRes.user ? syncRes.user : (storage.getUser() || null);
      that.setData({ user: latestUser });
      if (!latestUser || !latestUser.canEnterAdmin) {
        ui.toast('当前账号暂无管理员权限');
        wx.switchTab({ url: '/pages/my/my' });
        return;
      }
      that.reload();
    }).catch(function (err) {
      console.error('活动管理页静默同步用户失败', err);
      var fallbackUser = storage.getUser() || null;
      that.setData({ user: fallbackUser });
      if (!fallbackUser || !fallbackUser.canEnterAdmin) {
        ui.toast('当前账号暂无管理员权限');
        wx.switchTab({ url: '/pages/my/my' });
        return;
      }
      that.reload();
    });
  },

  reload: function () {
    var that = this;
    this.setData({ loading: true, loadError: '' });
    activityNotice.getActivityList().then(function (list) {
      list = list || [];
      for (var i = 0; i < list.length; i++) {
        list[i].updatedAtText = formatDateTime(list[i].updatedAt || list[i].createdAt);
      }
      that.setData({ activities: list, loadError: '' });
    }).catch(function (err) {
      that.setData({ activities: [], loadError: (err && err.message) || '加载活动失败' });
      ui.toast((err && err.message) || '加载活动失败');
    }).finally(function () {
      that.setData({ loading: false });
    });
  },

  onAdd: function () {
    wx.navigateTo({ url: '/pages/admin_activity_form/admin_activity_form' });
  },

  onEdit: function (e) {
    var id = e.currentTarget.dataset.id || '';
    if (!id) return ui.toast('缺少活动ID');
    wx.navigateTo({ url: '/pages/admin_activity_form/admin_activity_form?id=' + encodeURIComponent(id) });
  },

  onPreview: function (e) {
    var url = e.currentTarget.dataset.url || '';
    if (!url) return;
    wx.previewImage({ current: url, urls: [url] });
  },

  onDelete: function (e) {
    var that = this;
    var id = e.currentTarget.dataset.id || '';
    if (!id) return ui.toast('缺少活动ID');
    wx.showModal({
      title: '删除活动',
      content: '删除后用户端活动弹窗不会再展示该活动，确认继续吗？',
      confirmText: '删除',
      confirmColor: '#A73A20',
      success: function (res) {
        if (!res.confirm) return;
        ui.loading('删除中');
        activityNotice.deleteNotice(id).then(function () {
          ui.toast('已删除');
          that.setData({ activities: (that.data.activities || []).filter(function (item) { return item && item.id !== id; }) });
          that.reload();
        }).catch(function (err) {
          ui.toast((err && err.message) || '删除失败');
        }).finally(function () { ui.hideLoading(); });
      }
    });
  }
});
