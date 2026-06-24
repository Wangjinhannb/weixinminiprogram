var bookingApi = require('../../utils/bookingApi');
var ui = require('../../utils/ui');
var storage = require('../../utils/storage');
var statusText = require('../../utils/ui').statusText;
var subscriptionUtil = require('../../utils/subscription');

function canCancel(booking, user) {
  if (!booking || !user) return false;
  if (booking.status === 'cancelled' || booking.status === 'rejected') return false;
  return booking.userId === user.userId || !!user.canEnterAdmin;
}

function buildSubscriptionContext(booking, acceptResultMap) {
  return {
    booking: booking,
    tmplIds: subscriptionUtil.getRequestTemplateIds(),
    acceptResultMap: acceptResultMap || {},
    templateConfigMap: subscriptionUtil.getTemplateConfigMap()
  };
}

Page({
  data: {
    uiFontSizePx: 16,
    booking: null,
    loading: true,
    loadError: '',
    empty: false,
    subscribed: false,
    subscriptionLoading: false,
    statusText: statusText,
    reminderModalVisible: false,
    reminderBooking: null,
    reminderDefaultLeadMinutes: 30,
    pendingSubscriptionContext: null,
    subscriptionDetail: null
  },

  onLoad: function (query) {
    query = query || {};
    this.bookingId = query.id || '';
    this.loadBooking(this.bookingId);
  },

  onShow: function () {
    try {
      this.setData({ uiFontSizePx: getApp().globalData.uiFontSizePx || 16 });
      var tb = this.getTabBar && this.getTabBar();
      if (tb && tb.syncFont) tb.syncFont();
    } catch (e) {}
    if (this.bookingId && !this.data.loading) this.loadBooking(this.bookingId);
  },

  loadBooking: function (id) {
    var that = this;
    if (!id) {
      that.setData({ loading: false, loadError: '缺少预约ID', empty: true, booking: null });
      return;
    }
    that.setData({ loading: true, loadError: '', empty: false });
    bookingApi.getBooking(id).then(function (bk) {
      if (!bk) {
        that.setData({ booking: null, empty: true, loadError: '' });
        return;
      }
      var user = storage.getUser() || {};
      bk.statusLabel = statusText(bk.status);
      bk.canCancel = canCancel(bk, user);
      bk.canEdit = bk.canCancel && bk.status !== 'cancelled';
      bk.canSubscribe = bk.status !== 'cancelled' && bk.userId === user.userId;
      that.setData({ booking: bk, empty: false, loadError: '' });
      that.loadSubscriptionStatus(bk.id);
    }).catch(function (e) {
      that.setData({ booking: null, loadError: (e && e.message) || '加载失败', empty: false });
    }).finally(function () {
      that.setData({ loading: false });
    });
  },

  loadSubscriptionStatus: function (bookingId) {
    var user = storage.getUser();
    if (!bookingId || !user || user.nickName === '游客') {
      this.setData({ subscribed: false, subscriptionDetail: null });
      return;
    }
    var that = this;
    bookingApi.getSubscriptionStatus(bookingId, user.userId).then(function (res) {
      that.setData({
        subscribed: !!(res && res.enabled),
        subscriptionDetail: (res && res.detail) || null
      });
    }).catch(function () {
      that.setData({ subscribed: false, subscriptionDetail: null });
    });
  },

  onRetry: function () { this.loadBooking(this.bookingId); },

  onEdit: function () {
    var bk = this.data.booking;
    if (!bk || !bk.id) return;
    var url = '/pages/booking_form/booking_form?edit=1&id=' + encodeURIComponent(bk.id)
      + '&bookingId=' + encodeURIComponent(bk.id)
      + '&venueId=' + encodeURIComponent(bk.venueId || '')
      + '&date=' + encodeURIComponent(bk.date || '');
    wx.navigateTo({ url: url });
  },

  onCancel: function () {
    var that = this;
    var bk = this.data.booking;
    if (!bk || !bk.id || !bk.canCancel) return;
    wx.showModal({
      title: '取消预约',
      content: '确认取消该预约吗？取消后会释放对应时间段。',
      confirmText: '确认取消',
      confirmColor: '#e64340',
      success: function (res) {
        if (!res.confirm) return;
        ui.loading('取消中');
        bookingApi.cancelBooking(bk.id).then(function (cancelledBooking) {
          var pages = getCurrentPages();
          var prev = pages.length > 1 ? pages[pages.length - 2] : null;
          if (prev && typeof prev.applyCancelledBooking === 'function') prev.applyCancelledBooking(cancelledBooking);
          ui.toast('取消成功');
          setTimeout(function () {
            if (prev) wx.navigateBack({ delta: 1 });
            else that.loadBooking(bk.id);
          }, 700);
        }).catch(function (e) {
          ui.toast((e && e.message) || '取消失败');
        }).finally(function () { ui.hideLoading(); });
      }
    });
  },

  onToggleSubscribe: function () {
    var user = storage.getUser();
    var booking = this.data.booking;
    var that = this;
    if (!user || user.nickName === '游客') return ui.toast('请先登录');
    if (!booking || !booking.id) return;
    if (this.data.subscriptionLoading) return;

    var nextEnabled = !this.data.subscribed;
    if (!nextEnabled) {
      that.setData({ subscriptionLoading: true });
      bookingApi.saveSubscription({ bookingId: booking.id, enabled: false, reminderEnabled: false }).then(function () {
        that.setData({ subscribed: false, subscriptionDetail: null });
        ui.toast('已取消订阅');
      }).catch(function (e) {
        ui.toast((e && e.message) || '取消订阅失败');
      }).finally(function () {
        that.setData({ subscriptionLoading: false });
      });
      return;
    }

    if (!subscriptionUtil.isTemplateConfigReady()) return ui.toast('请先在 app.js 配置订阅消息模板 ID');
    var tmplIds = subscriptionUtil.getRequestTemplateIds();
    that.setData({ subscriptionLoading: true });
    wx.requestSubscribeMessage({
      tmplIds: tmplIds,
      success: function (res) {
        that.setData({ subscriptionLoading: false });
        if (!subscriptionUtil.hasAcceptedTemplate(res || {})) {
          ui.toast('未同意订阅，可稍后再次开启');
          return;
        }
        that.setData({
          reminderModalVisible: true,
          reminderBooking: booking,
          reminderDefaultLeadMinutes: subscriptionUtil.getDefaultLeadMinutes(booking),
          pendingSubscriptionContext: buildSubscriptionContext(booking, res || {})
        });
      },
      fail: function (err) {
        that.setData({ subscriptionLoading: false });
        ui.toast((err && err.errMsg) || '订阅授权未完成');
      }
    });
  },

  onReminderConfirm: function (e) {
    var that = this;
    var detail = e.detail || {};
    var ctx = this.data.pendingSubscriptionContext;
    if (!ctx || !ctx.booking || !ctx.booking.id) {
      this.closeReminderModal();
      return;
    }
    ui.loading('保存提醒中');
    bookingApi.saveSubscription({
      bookingId: ctx.booking.id,
      enabled: true,
      tmplIds: ctx.tmplIds,
      acceptResultMap: ctx.acceptResultMap,
      templateConfigMap: ctx.templateConfigMap,
      reminderEnabled: true,
      reminderLeadMinutes: detail.leadMinutes
    }).then(function (saved) {
      that.setData({ subscribed: true, subscriptionDetail: saved || null });
      that.closeReminderModal();
      ui.toast('已订阅并设置提醒');
    }).catch(function (e) {
      ui.toast((e && e.message) || '保存提醒失败');
    }).finally(function () { ui.hideLoading(); });
  },

  onReminderSkip: function () {
    var that = this;
    var ctx = this.data.pendingSubscriptionContext;
    if (!ctx || !ctx.booking || !ctx.booking.id) {
      this.closeReminderModal();
      return;
    }
    ui.loading('保存订阅中');
    bookingApi.saveSubscription({
      bookingId: ctx.booking.id,
      enabled: true,
      tmplIds: ctx.tmplIds,
      acceptResultMap: ctx.acceptResultMap,
      templateConfigMap: ctx.templateConfigMap,
      reminderEnabled: false,
      reminderLeadMinutes: 0
    }).then(function (saved) {
      that.setData({ subscribed: true, subscriptionDetail: saved || null });
      that.closeReminderModal();
      ui.toast('已订阅状态通知');
    }).catch(function (e) {
      ui.toast((e && e.message) || '保存订阅失败');
    }).finally(function () { ui.hideLoading(); });
  },

  closeReminderModal: function () {
    this.setData({
      reminderModalVisible: false,
      reminderBooking: null,
      reminderDefaultLeadMinutes: 30,
      pendingSubscriptionContext: null
    });
  }
});
