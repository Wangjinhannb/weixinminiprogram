var bookingApi = require('../../utils/bookingApi');
var ui = require('../../utils/ui');
var storage = require('../../utils/storage');
var statusText = require('../../utils/ui').statusText;

Page({
  data: { uiFontSizePx: 16, booking: null, loading: true, loadError: '', statusText: statusText },
  onLoad: function (query) {
    query = query || {};
    var u = storage.getUser();
    if (!u || !u.canEnterAdmin) {
      ui.toast('仅管理员可访问');
      wx.switchTab({ url: '/pages/my/my' });
      return;
    }
    this.loadBooking(query.id);
  },
  onShow: function () {
    try {
      this.setData({ uiFontSizePx: getApp().globalData.uiFontSizePx || 16 });
      var tb = this.getTabBar && this.getTabBar(); if (tb && tb.syncFont) tb.syncFont();
    } catch (e) {}
  },
  loadBooking: function (id) {
    var that = this;
    if (!id) return that.setData({ loading: false, loadError: '缺少预约ID' });
    that.setData({ loading: true, loadError: '' });
    bookingApi.getBooking(id).then(function (bk) { if (bk) bk.statusLabel = statusText(bk.status); that.setData({ booking: bk || null }); }).catch(function (e) { that.setData({ loadError: (e && e.message) || '加载失败' }); }).finally(function () { that.setData({ loading: false }); });
  }
});
