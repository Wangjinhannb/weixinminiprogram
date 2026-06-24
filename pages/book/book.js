var bookingApi = require("../../utils/bookingApi");
var dateUtil = require("../../utils/date");
var ui = require("../../utils/ui");
var storage = require("../../utils/storage");
var userSession = require('../../utils/userSession');

Page({
  data: {
    uiFontSizePx: 16,
    venues: [],
    venueNames: [],
    venueIndex: 0,
    currentVenue: null,
    date: "",
    dateStart: "",
    dateEnd: "",
    features: [],
    loading: false,
    emptyText: ""
  },

  onShow: function(){
    var that = this;
    try {
      this.setData({ uiFontSizePx: getApp().globalData.uiFontSizePx || 16 });
      var tb = this.getTabBar && this.getTabBar();
      if (tb) {
        if (tb.setSelectedByPath) tb.setSelectedByPath("/pages/book/book");
        if (tb.syncFont) tb.syncFont();
      }
    } catch (e) {}
    var today = new Date();
    this.setData({ dateStart: dateUtil.fmtDate(today), dateEnd: '2099-12-31' });
    var currentUser = storage.getUser();
    userSession.refreshCurrentUser({ user: currentUser, silent: true }).catch(function(err){
      console.error('预约页静默同步用户失败', err);
    }).finally(function(){
      that.loadVenues();
    });
  },

  loadVenues: function(){
    var that = this;
    var app = getApp();
    var prefVenueId = app && app.globalData ? (app.globalData.prefVenueId || '') : '';
    var currentSelectedId = this.data.currentVenue ? (this.data.currentVenue.id || this.data.currentVenue.venueId) : '';
    var targetVenueId = prefVenueId || currentSelectedId;
    this.setData({ loading: true, emptyText: "" });
    bookingApi.getAvailableVenues().then(function(venues){
      venues = venues || [];
      var names = [];
      for (var i = 0; i < venues.length; i++) {
        var suffix = venues[i].capacity ? ('（' + venues[i].capacity + '人）') : '';
        var status = venues[i].enabled === false ? ' · 暂停预约' : '';
        names.push(venues[i].name + suffix + status);
      }
      var idx = 0;
      var removedSelected = false;
      if (targetVenueId) {
        idx = -1;
        for (var j = 0; j < venues.length; j++) {
          if ((venues[j].id || venues[j].venueId) === targetVenueId) { idx = j; break; }
        }
        if (idx < 0) {
          removedSelected = true;
          idx = 0;
        }
      }
      if (app && app.globalData) app.globalData.prefVenueId = "";
      var cur = venues[idx] || null;
      that.setData({
        venues: venues,
        venueNames: names,
        venueIndex: cur ? idx : 0,
        currentVenue: cur,
        features: cur ? (cur.features || []) : [],
        emptyText: venues.length ? "" : "当前暂无可展示场室"
      });
      if (removedSelected) {
        ui.toast('当前选中场室已下线，请重新选择');
      }
    }).catch(function(e){
      ui.toast((e && e.message) || "加载失败");
      that.setData({ venues: [], venueNames: [], currentVenue: null, features: [], emptyText: (e && e.message) || "加载场室失败" });
    }).finally(function(){ that.setData({ loading: false }); });
  },

  onVenueChange:function(e){
    var idx = Number(e.detail.value || 0);
    var v = this.data.venues[idx] || null;
    this.setData({ venueIndex: idx, currentVenue: v, features: v ? (v.features || []) : [] });
  },

  onDateChange:function(e){ this.setData({ date:e.detail.value || "" }); },

  goForm:function(){
    var user=storage.getUser();
    if(!user || user.nickName === "游客"){ ui.toast("请先在「我的」登录"); return; }
    var v=this.data.currentVenue;
    if(!v){ ui.toast(this.data.emptyText || "请选择场室"); return; }
    if(!this.data.date){ ui.toast("请选择日期"); return; }
    var venueId = v.id || v.venueId;
    var url="/pages/booking_form/booking_form?venueId="+encodeURIComponent(venueId)+"&date="+encodeURIComponent(this.data.date);
    wx.navigateTo({ url:url });
  }
});
