var activityNotice = require('../../utils/activityNotice');
var activityRegistration = require('../../utils/activityRegistration');
var ui = require('../../utils/ui');
var storage = require('../../utils/storage');
var userSession = require('../../utils/userSession');

function normalizePeople(value) {
  var num = Number(value);
  if (!isFinite(num) || num <= 0) return 0;
  return Math.floor(num);
}

function normalizeName(value) {
  return String(value == null ? '' : value).trim();
}

function setActivityTabBarHidden(page, hidden) {
  try {
    var tb = page && page.getTabBar && page.getTabBar();
    if (tb && tb.setData) tb.setData({ hidden: !!hidden });
  } catch (e) {}
}

function findActivityIndex(list, id) {
  id = String(id || '').trim();
  if (!id) return -1;
  list = list || [];
  for (var i = 0; i < list.length; i++) {
    if (list[i] && String(list[i].id || list[i]._id || '') === id) return i;
  }
  return -1;
}

function getActivityId(item) {
  return String((item && (item.id || item._id)) || '').trim();
}

function buildRegistrationMap(list) {
  var map = {};
  list = list || [];
  for (var i = 0; i < list.length; i++) {
    var item = activityRegistration.normalizeRegistration(list[i]);
    if (item.activityId && item.status !== 'cancelled') map[item.activityId] = item;
  }
  return map;
}

Page({
  data: {
    uiFontSizePx: 16,
    activities: [],
    activeIndex: 0,
    selectedActivity: null,
    loading: false,
    loadError: '',
    submitting: false,
    cancelling: false,
    signupVisible: false,
    childOptions: ['不带小孩', '带小孩'],
    form: {
      name: '',
      phone: '',
      people: '',
      hasChild: '',
      hasChildText: ''
    },
    registrationMap: {},
    latestRegistration: null
  },

  onLoad: function (options) {
    options = options || {};
    if (options.id) this.pendingActivityId = decodeURIComponent(options.id);
  },

  onShow: function () {
    var app = getApp();
    try {
      this.setData({ uiFontSizePx: (app && app.globalData && app.globalData.uiFontSizePx) || 16 });
      var tb = this.getTabBar && this.getTabBar();
      if (tb) {
        if (tb.setSelectedByPath) tb.setSelectedByPath('/pages/activity/activity');
        if (tb.syncFont) tb.syncFont();
      }
    } catch (e) {}

    var targetId = this.pendingActivityId || (app && app.globalData && app.globalData.prefActivityId) || '';
    this.pendingActivityId = '';
    if (app && app.globalData) app.globalData.prefActivityId = '';
    this.prefillUserPhone();
    this.loadActivities(targetId);
  },

  prefillUserPhone: function () {
    var user = storage.getUser();
    if (this.data.form && this.data.form.phone) return;
    if (user && user.phone) this.setData({ 'form.phone': user.phone });
  },

  applySelectedRegistration: function (selectedActivity) {
    var id = getActivityId(selectedActivity || this.data.selectedActivity);
    var map = this.data.registrationMap || {};
    this.setData({ latestRegistration: id ? (map[id] || null) : null });
  },

  loadMyRegistrations: function (selectedActivity) {
    var that = this;
    var user = storage.getUser();
    if (!user || !user.userId || user.nickName === '游客') {
      this.setData({ registrationMap: {}, latestRegistration: null });
      return Promise.resolve();
    }
    return activityRegistration.listMyRegistrations().then(function (list) {
      var map = buildRegistrationMap(list);
      var id = getActivityId(selectedActivity || that.data.selectedActivity);
      that.setData({
        registrationMap: map,
        latestRegistration: id ? (map[id] || null) : null
      });
    }).catch(function (err) {
      console.error('加载我的活动报名失败', err);
      that.applySelectedRegistration(selectedActivity);
    });
  },

  loadActivities: function (targetId) {
    var that = this;
    this.setData({ loading: true, loadError: '' });
    activityNotice.getNotice().then(function (notice) {
      var group = activityNotice.normalizeNoticeGroup(notice);
      var list = group.list || [];
      var idx = findActivityIndex(list, targetId);
      if (idx < 0) idx = Math.min(that.data.activeIndex || 0, Math.max(list.length - 1, 0));
      var selected = list[idx] || null;
      that.setData({
        activities: list,
        activeIndex: idx,
        selectedActivity: selected,
        signupVisible: false,
        loadError: list.length ? '' : '暂无活动'
      });
      setActivityTabBarHidden(that, false);
      return that.loadMyRegistrations(selected);
    }).catch(function (err) {
      that.setData({ activities: [], selectedActivity: null, activeIndex: 0, signupVisible: false, latestRegistration: null, loadError: (err && err.message) || '加载活动失败' });
      setActivityTabBarHidden(that, false);
    }).finally(function () {
      that.setData({ loading: false });
    });
  },

  onActivityTap: function (e) {
    var idx = Number(e.currentTarget.dataset.index || 0);
    var list = this.data.activities || [];
    var selected = list[idx] || null;
    this.setData({ activeIndex: idx, selectedActivity: selected, signupVisible: false });
    this.applySelectedRegistration(selected);
    setActivityTabBarHidden(this, false);
  },

  openSignupModal: function () {
    if (!this.data.selectedActivity) return ui.toast('请选择活动');
    this.prefillUserPhone();
    this.setData({ signupVisible: true });
    setActivityTabBarHidden(this, true);
  },

  closeSignupModal: function () {
    if (this.data.submitting) return;
    this.setData({ signupVisible: false });
    setActivityTabBarHidden(this, false);
  },

  onHide: function () {
    setActivityTabBarHidden(this, false);
  },

  onUnload: function () {
    setActivityTabBarHidden(this, false);
  },

  noop: function () {},

  onPreviewImage: function (e) {
    var url = e.currentTarget.dataset.url || '';
    if (!url) return;
    wx.previewImage({ current: url, urls: [url] });
  },

  onInput: function (e) {
    var field = e.currentTarget.dataset.field;
    if (!field) return;
    var patch = {};
    patch['form.' + field] = e.detail.value || '';
    this.setData(patch);
  },

  onChildChange: function (e) {
    var idx = Number(e && e.detail ? e.detail.value : -1);
    var text = (this.data.childOptions || [])[idx] || '';
    this.setData({
      'form.hasChild': idx === 1 ? 'yes' : (idx === 0 ? 'no' : ''),
      'form.hasChildText': text
    });
  },

  submitRegistration: function () {
    var that = this;
    if (this.data.submitting) return;
    var item = this.data.selectedActivity || {};
    var activityId = getActivityId(item);
    if (!activityId) return ui.toast('请选择活动');

    var user = storage.getUser();
    if (!user || !user.userId || user.nickName === '游客') {
      wx.showModal({
        title: '请先登录',
        content: '需要先登录后才能报名活动',
        confirmText: '去登录',
        success: function (res) {
          if (res.confirm) wx.switchTab({ url: '/pages/my/my' });
        }
      });
      return;
    }

    var name = normalizeName(this.data.form && this.data.form.name);
    var phone = String((this.data.form && this.data.form.phone) || '').trim();
    var people = normalizePeople(this.data.form && this.data.form.people);
    var hasChildValue = String((this.data.form && this.data.form.hasChild) || '').trim();
    if (!name) return ui.toast('请填写姓名');
    if (!phone) return ui.toast('请填写手机号');
    if (!/^1\d{10}$/.test(phone)) return ui.toast('请填写正确的11位手机号');
    if (!people) return ui.toast('请填写报名人数');
    if (hasChildValue !== 'yes' && hasChildValue !== 'no') return ui.toast('请选择是否带小孩');

    this.setData({ submitting: true });
    ui.loading('提交报名中');
    userSession.refreshCurrentUser({ user: user, silent: true }).catch(function () {
      return { user: storage.getUser() || user };
    }).then(function (syncRes) {
      var latestUser = (syncRes && syncRes.user) || storage.getUser() || user;
      return activityRegistration.submitRegistration({
        activityId: activityId,
        participantName: name,
        phone: phone,
        peopleCount: people,
        hasChild: hasChildValue === 'yes',
        userProfile: {
          nickName: latestUser.nickName || '',
          phone: latestUser.phone || '',
          phoneMask: latestUser.phoneMask || '',
          loginType: latestUser.loginType || ''
        }
      });
    }).then(function (registration) {
      var map = that.data.registrationMap || {};
      if (registration && registration.activityId) map[registration.activityId] = registration;
      that.setData({
        registrationMap: map,
        latestRegistration: registration,
        signupVisible: false,
        'form.name': '',
        'form.people': '',
        'form.hasChild': '',
        'form.hasChildText': ''
      });
      setActivityTabBarHidden(that, false);
      ui.toast('报名成功');
    }).catch(function (err) {
      console.error('活动报名失败', err);
      ui.toast((err && err.message) || '报名失败');
    }).finally(function () {
      that.setData({ submitting: false });
      ui.hideLoading();
    });
  },

  cancelRegistration: function () {
    var that = this;
    if (this.data.cancelling) return;
    var item = this.data.selectedActivity || {};
    var reg = this.data.latestRegistration || {};
    var activityId = getActivityId(item) || reg.activityId;
    if (!activityId && !reg.id) return ui.toast('未找到报名信息');

    wx.showModal({
      title: '取消报名',
      content: '确定取消当前活动报名吗？',
      confirmText: '取消报名',
      confirmColor: '#A73A20',
      success: function (res) {
        if (!res.confirm) return;
        that.setData({ cancelling: true });
        ui.loading('取消中');
        activityRegistration.cancelRegistration({
          registrationId: reg.id,
          activityId: activityId
        }).then(function () {
          var map = that.data.registrationMap || {};
          if (activityId && map[activityId]) delete map[activityId];
          that.setData({ registrationMap: map, latestRegistration: null });
          ui.toast('已取消报名');
        }).catch(function (err) {
          console.error('取消活动报名失败', err);
          ui.toast((err && err.message) || '取消失败');
        }).finally(function () {
          that.setData({ cancelling: false });
          ui.hideLoading();
        });
      }
    });
  }
});
