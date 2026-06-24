Component({
  data: {
    selected: 0,
    hidden: false,
    pressingIndex: -1,
    uiFontSizePx: 16,
    list: [
      { pagePath: "/pages/home/home", text: "首页" },
      { pagePath: "/pages/activity/activity", text: "活动" },
      { pagePath: "/pages/book/book", text: "预约" },
      { pagePath: "/pages/schedule/schedule", text: "时间表" },
      { pagePath: "/pages/my/my", text: "我的" }
    ]
  },

  lifetimes: {
    attached: function () {
      this.syncSelected();
      this.syncFont();
    }
  },

  methods: {
    getIndexByPath: function (path) {
      var idx = 0;
      for (var i = 0; i < this.data.list.length; i++) {
        if (this.data.list[i].pagePath === path) {
          idx = i;
          break;
        }
      }
      return idx;
    },

    setSelectedByPath: function (path) {
      try {
        var idx = this.getIndexByPath(path || "/pages/home/home");
        if (this.data.selected !== idx) {
          this.setData({ selected: idx });
        }
      } catch (e) {
        this.setData({ selected: 0 });
      }
    },

    syncSelected: function () {
      try {
        var pages = getCurrentPages();
        var route = pages && pages.length
          ? ("/" + pages[pages.length - 1].route)
          : "/pages/home/home";

        this.setSelectedByPath(route);
      } catch (e) {
        this.setData({ selected: 0 });
      }
    },

    syncFont: function (px) {
      try {
        var app = getApp();
        var v = px;
        if (!v) {
          v = (app && app.globalData && app.globalData.uiFontSizePx)
            ? app.globalData.uiFontSizePx
            : 16;
        }
        this.setData({ uiFontSizePx: Number(v) || 16 });
      } catch (e) {
        this.setData({ uiFontSizePx: 16 });
      }
    },

    onTouchStart: function (e) {
      this.setData({ pressingIndex: Number(e.currentTarget.dataset.index || 0) });
    },

    onTouchEnd: function () {
      this.setData({ pressingIndex: -1 });
    },

    switchTab: function (e) {
      try {
        var idx = Number(e.currentTarget.dataset.index || 0);
        var path = this.data.list[idx].pagePath;

        // 点击时先给即时反馈
        if (this.data.selected !== idx) {
          this.setData({ selected: idx });
        }

        wx.switchTab({
          url: path
        });
      } catch (e) {
        this.setData({ selected: 0 });
        wx.switchTab({ url: "/pages/home/home" });
      }
    }
  }
});