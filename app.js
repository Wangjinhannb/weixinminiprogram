var uiFont = require("./utils/ui_font");
var initApp = require("./utils/init").initApp;
var activityNotice = require("./utils/activityNotice");

(function enhancePageForActivityNotice() {
  if (typeof Page !== "function" || Page.__activityNoticeEnhanced) return;
  var nativePage = Page;
  var tabPages = {
    "/pages/home/home": true,
    "/pages/activity/activity": true,
    "/pages/book/book": true,
    "/pages/schedule/schedule": true,
    "/pages/my/my": true
  };
  var defaultShareTitle = "书香海龙 场地预约";

  function mergeActivityNoticeData(data) {
    var next = data || {};
    if (typeof next.activityNoticeVisible === "undefined") next.activityNoticeVisible = false;
    if (typeof next.activityNoticeLoading === "undefined") next.activityNoticeLoading = false;
    if (typeof next.activityNotice === "undefined") next.activityNotice = activityNotice.emptyNotice();
    return next;
  }

  function encodeQuery(options) {
    var query = [];
    options = options || {};
    Object.keys(options).forEach(function (key) {
      var value = options[key];
      if (typeof value === "undefined" || value === null || value === "") return;
      query.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(value)));
    });
    return query.join("&");
  }

  function buildSharePath(page) {
    var route = page && page.route ? page.route : "pages/home/home";
    if (route.charAt(0) !== "/") route = "/" + route;
    var query = encodeQuery(page && page.options);
    return query ? route + "?" + query : route;
  }

  function enableShareMenu() {
    try {
      if (typeof wx === "undefined" || typeof wx.showShareMenu !== "function") return;
      wx.showShareMenu({
        withShareTicket: true,
        menus: ["shareAppMessage", "shareTimeline"]
      });
    } catch (e) {}
  }

  function createDefaultShareMessage(page) {
    return {
      title: defaultShareTitle,
      path: buildSharePath(page)
    };
  }

  function createDefaultShareTimeline(page) {
    return {
      title: defaultShareTitle,
      query: encodeQuery(page && page.options)
    };
  }

  Page = function (pageConfig) {
    pageConfig = pageConfig || {};
    var originalOnLoad = pageConfig.onLoad;
    var originalOnShow = pageConfig.onShow;
    pageConfig.data = mergeActivityNoticeData(pageConfig.data);

    if (!pageConfig.onActivityNoticeClose) {
      pageConfig.onActivityNoticeClose = function () {
        try {
          var app = getApp();
          if (app && app.hideActivityNoticeForPage) app.hideActivityNoticeForPage(this);
          else this.setData({ activityNoticeVisible: false });
        } catch (e) {
          this.setData({ activityNoticeVisible: false });
        }
      };
    }

    if (!pageConfig.onActivityNoticeOpenLink) {
      pageConfig.onActivityNoticeOpenLink = function (e) {
        var detail = (e && e.detail) || {};
        try {
          var app = getApp();
          if (app && app.openActivityDetail) {
            app.openActivityDetail(detail.id || detail.activityId || "", detail.linkUrl || "");
          } else if (app && app.openActivityNoticeLink) {
            app.openActivityNoticeLink(detail.linkUrl || "");
          }
        } catch (err) {}
      };
    }

    if (!pageConfig.onShareAppMessage) {
      pageConfig.onShareAppMessage = function () {
        return createDefaultShareMessage(this);
      };
    }

    if (!pageConfig.onShareTimeline) {
      pageConfig.onShareTimeline = function () {
        return createDefaultShareTimeline(this);
      };
    }

    pageConfig.onLoad = function () {
      enableShareMenu();
      if (typeof originalOnLoad === "function") return originalOnLoad.apply(this, arguments);
    };

    pageConfig.onShow = function () {
      enableShareMenu();
      try {
        var app = getApp();
        var routePath = this && this.route ? (this.route.charAt(0) === "/" ? this.route : "/" + this.route) : "";
        var canShowActivityNotice = !!(tabPages && tabPages[routePath]);
        if (app && app.showActivityNoticeForPage && canShowActivityNotice) app.showActivityNoticeForPage(this);
      } catch (e) {}
      if (typeof originalOnShow === "function") return originalOnShow.apply(this, arguments);
    };

    return nativePage(pageConfig);
  };
  Page.__activityNoticeEnhanced = true;
  Page.__activityNoticeTabPages = tabPages;
})();

App({
  globalData: {
    uiFontSizePx: 16,
    prefVenueId: "",
    prefActivityId: "",
    activityNoticeShown: false,
    activityNoticeInFlight: false,
    subscribeMessageTemplates: {
      bookingSuccess: {
        id: 'c-V8l2bhSuvUCkoubzS93kp1DWb9_o8SImMJPZYkp9o',
        page: 'pages/booking_detail/booking_detail?id={{bookingId}}',
        fields: [
          { key: 'name1', source: 'contactName', maxLength: 10 },
          { key: 'thing2', source: 'venueName', maxLength: 20 },
          { key: 'date3', source: 'bookingStartText', maxLength: 32 },
          { key: 'phone_number4', source: 'contactPhone', maxLength: 11 },
          { key: 'thing13', source: 'bookingItem', maxLength: 20, fallback: '场室预约' }
        ]
      },
      bookingReminder: {
        id: 'RKgIUQZMAg0lOxqhA_pXSBfeg9ESR9-Ceatl5nueBjM',
        page: 'pages/booking_detail/booking_detail?id={{bookingId}}',
        fields: [
          { key: 'thing2', source: 'reminderContent', maxLength: 20, fallback: '您预约的活动即将开始' },
          { key: 'date3', source: 'bookingStartText', maxLength: 32 },
          { key: 'date5', source: 'reminderAtText', maxLength: 32 },
          { key: 'thing6', source: 'venueName', maxLength: 20 }
        ]
      }
    },
    subscribeTemplateIds: ['c-V8l2bhSuvUCkoubzS93kp1DWb9_o8SImMJPZYkp9o', 'RKgIUQZMAg0lOxqhA_pXSBfeg9ESR9-Ceatl5nueBjM']
  },

  onLaunch: function () {
    this.globalData.uiFontSizePx = uiFont.getFontSizePx();
    initApp();

    if (wx.cloud) {
      wx.cloud.init({
        env: wx.cloud.DYNAMIC_CURRENT_ENV,
        traceUser: true
      });
    }
  },

  onShow: function () {
    // 不在每次从相册/摄像头返回时重置活动弹窗状态，避免管理员上传图片后弹出活动预告。
  },

  showActivityNoticeForPage: function (page) {
    var that = this;
    if (!page || !page.setData) return;
    if (this.globalData.activityNoticeShown || this.globalData.activityNoticeInFlight) return;
    this.globalData.activityNoticeShown = true;
    this.globalData.activityNoticeInFlight = true;

    page.setData({
      activityNoticeVisible: true,
      activityNoticeLoading: true,
      activityNotice: activityNotice.emptyNotice()
    });

    activityNotice.getNotice().then(function (notice) {
      page.setData({
        activityNotice: activityNotice.normalizeNoticeGroup(notice),
        activityNoticeLoading: false,
        activityNoticeVisible: true
      });
    }).catch(function (err) {
      console.error('活动预告弹窗加载失败', err);
      page.setData({
        activityNotice: activityNotice.emptyNotice(),
        activityNoticeLoading: false,
        activityNoticeVisible: true
      });
    }).finally(function () {
      that.globalData.activityNoticeInFlight = false;
    });
  },

  hideActivityNoticeForPage: function (page) {
    if (page && page.setData) page.setData({ activityNoticeVisible: false });
  },


  openActivityDetail: function (activityId, linkUrl) {
    activityId = String(activityId || '').trim();
    linkUrl = String(linkUrl || '').trim();
    if (this.globalData) {
      this.globalData.prefActivityId = activityId;
      this.globalData.prefActivityLinkUrl = linkUrl;
    }
    wx.switchTab({
      url: '/pages/activity/activity',
      fail: function () {
        wx.navigateTo({
          url: '/pages/activity/activity' + (activityId ? ('?id=' + encodeURIComponent(activityId)) : '')
        });
      }
    });
  },

  openActivityNoticeLink: function (linkUrl) {
    linkUrl = String(linkUrl || '').trim();
    if (!linkUrl) return;

    if (linkUrl.indexOf('pages/') === 0) linkUrl = '/' + linkUrl;
    if (linkUrl.indexOf('/pages/') === 0) {
      var tabPages = (Page && Page.__activityNoticeTabPages) || {};
      var cleanPath = linkUrl.split('?')[0];
      if (tabPages[cleanPath]) {
        wx.switchTab({ url: cleanPath });
        return;
      }
      wx.navigateTo({
        url: linkUrl,
        fail: function () {
          wx.setClipboardData({ data: linkUrl, success: function () { wx.showToast({ title: '链接已复制', icon: 'none' }); } });
        }
      });
      return;
    }

    wx.setClipboardData({
      data: linkUrl,
      success: function () { wx.showToast({ title: '链接已复制', icon: 'none' }); },
      fail: function () { wx.showToast({ title: '链接处理失败', icon: 'none' }); }
    });
  },

  onPageNotFound: function (res) {
    try {
      console.error("onPageNotFound:", res);
      wx.showToast({ title: "页面不存在：" + res.path, icon: "none" });
      wx.switchTab({ url: "/pages/home/home" });
    } catch (e) {}
  }
});
