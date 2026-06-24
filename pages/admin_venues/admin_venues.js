var bookingApi = require('../../utils/bookingApi');
var ui = require('../../utils/ui');
var storage = require('../../utils/storage');
var timeUtil = require('../../utils/time');

Page({
  data: {
    uiFontSizePx: 16,
    user: null,
    venues: [],
    loading: false,
    loadError: '',
    emptyText: ''
  },

  onShow: function () {
    this.setData({ uiFontSizePx: getApp().globalData.uiFontSizePx || 16, user: storage.getUser() || null });
    var tb = this.getTabBar && this.getTabBar();
    if (tb && tb.syncFont) tb.syncFont();
    this.reload();
  },

  reload: function () {
    var that = this;
    var user = this.data.user;
    if (!user || !user.canEnterAdmin) {
      this.setData({ venues: [], loadError: '当前账号暂无管理员权限' });
      return;
    }
    this.setData({ loading: true, loadError: '', emptyText: '' });
    bookingApi.getAdminVenues().then(function (list) {
      list = (list || []).filter(function (item) { return !(item && item.deleted); });
      for (var i = 0; i < list.length; i++) {
        var item = list[i];
        item.statusText = item.enabled ? '可预约' : '已停用';
        item.maxPeopleLimitText = timeUtil.formatMaxPeopleLimitText(item.maxPeopleLimit);
        item.timeSlotText = [];
        var ts = item.timeSlots || [];
        for (var j = 0; j < ts.length; j++) {
          var slot = ts[j] || {};
          var limitText = timeUtil.formatMaxPeopleLimitText(slot.maxPeopleLimit || 0);
          item.timeSlotText.push((slot.label || (slot.start + '-' + slot.end)) + ' · 上限' + limitText);
        }
        item.dateOverrideCount = (item.dateOverrides || []).length;
        item.dateOverrideTextList = [];
        for (var k = 0; k < (item.dateOverrides || []).length; k++) {
          var override = item.dateOverrides[k] || {};
          var labels = [];
          for (var n = 0; n < (override.timeSlots || []).length; n++) {
            var overrideSlot = override.timeSlots[n] || {};
            var slotLabel = overrideSlot.dateTimeLabel || ((override.date || '') + ' ' + (overrideSlot.start || '') + ' - ' + (override.date || '') + ' ' + (overrideSlot.end || ''));
            labels.push(slotLabel + ' · 上限' + timeUtil.formatMaxPeopleLimitText(overrideSlot.maxPeopleLimit || 0));
          }
          item.dateOverrideTextList.push((override.date || '未设日期') + '：' + (labels.join('；') || '未配置时段'));
        }
      }
      that.setData({ venues: list, emptyText: list.length ? '' : '当前暂无场室，可新增场室或点击“初始化默认场室”。' });
    }).catch(function (e) {
      that.setData({ loadError: (e && e.message) || '加载场室失败' });
      ui.toast((e && e.message) || '加载场室失败');
    }).finally(function () { that.setData({ loading: false }); });
  },

  onAdd: function () { wx.navigateTo({ url: '/pages/admin_venue_form/admin_venue_form' }); },
  onEdit: function (e) { wx.navigateTo({ url: '/pages/admin_venue_form/admin_venue_form?id=' + encodeURIComponent(e.currentTarget.dataset.id || '') }); },

  onToggleEnabled: function (e) {
    var that = this;
    var venueId = e.currentTarget.dataset.venueId;
    var enabled = e.currentTarget.dataset.enabled === true || e.currentTarget.dataset.enabled === 'true';
    var visible = e.currentTarget.dataset.visible === true || e.currentTarget.dataset.visible === 'true';
    var nextEnabled = !enabled;
    ui.loading('处理中');
    bookingApi.toggleVenueStatus(venueId, nextEnabled).then(function () {
      if (!visible) return bookingApi.toggleVenueVisible(venueId, true);
      return null;
    }).then(function () {
      ui.toast(nextEnabled ? '已启用' : '已停用');
      that.reload();
    }).catch(function (err) {
      ui.toast((err && err.message) || '操作失败');
    }).finally(function () { ui.hideLoading(); });
  },

  onDelete: function (e) {
    var that = this;
    var venueId = e.currentTarget.dataset.venueId;
    wx.showModal({
      title: '删除场室',
      content: '删除后用户不可见且不可预约，确认继续吗？',
      confirmColor: '#e64340',
      success: function (res) {
        if (!res.confirm) return;
        ui.loading('删除中');
        bookingApi.deleteVenue(venueId).then(function () {
          ui.toast('已删除');
          var venues = (that.data.venues || []).filter(function (item) { return item && item.venueId !== venueId; });
          that.setData({ venues: venues });
          that.reload();
        }).catch(function (err) {
          ui.toast((err && err.message) || '删除失败');
        }).finally(function () { ui.hideLoading(); });
      }
    });
  },

  onInitDefault: function () {
    var that = this;
    ui.loading('初始化中');
    bookingApi.initVenueData().then(function (res) {
      ui.toast((res && res.skipped) ? '已存在场室数据' : '默认场室已初始化');
      that.reload();
    }).catch(function (err) {
      ui.toast((err && err.message) || '初始化失败');
    }).finally(function () { ui.hideLoading(); });
  }
});
