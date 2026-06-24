var activityNotice = require('../../utils/activityNotice');
var ui = require('../../utils/ui');
var storage = require('../../utils/storage');
var userSession = require('../../utils/userSession');

function trim(value) {
  return String(value == null ? '' : value).trim();
}

function getFileExt(filePath) {
  filePath = String(filePath || '').split('?')[0];
  var matched = filePath.match(/(\.[a-zA-Z0-9]+)$/);
  return matched && matched[1] ? matched[1].toLowerCase() : '.jpg';
}

function ensureFormImages(form) {
  form = activityNotice.normalizeNotice(form || activityNotice.emptyNotice());
  if (form.displayImageUrl && !form.imageUrls.length) form.imageUrls = [form.displayImageUrl];
  return form;
}

Page({
  data: {
    uiFontSizePx: 16,
    user: null,
    id: '',
    form: activityNotice.emptyNotice(),
    loading: false,
    saving: false,
    uploading: false,
    activityLoaded: false
  },

  onLoad: function (options) {
    this.setData({ id: options && options.id ? decodeURIComponent(options.id) : '' });
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
      if (!that.data.activityLoaded) that.loadActivity();
    }).catch(function (err) {
      console.error('活动编辑页静默同步用户失败', err);
      var fallbackUser = storage.getUser() || null;
      that.setData({ user: fallbackUser });
      if (!fallbackUser || !fallbackUser.canEnterAdmin) {
        ui.toast('当前账号暂无管理员权限');
        wx.switchTab({ url: '/pages/my/my' });
        return;
      }
      if (!that.data.activityLoaded) that.loadActivity();
    });
  },

  loadActivity: function () {
    var that = this;
    var id = this.data.id || '';
    if (!id) {
      this.setData({ form: ensureFormImages(activityNotice.emptyNotice()), loading: false, activityLoaded: true });
      return;
    }
    this.setData({ loading: true });
    activityNotice.getActivityList().then(function (list) {
      var found = null;
      list = list || [];
      for (var i = 0; i < list.length; i++) {
        if (list[i] && list[i].id === id) {
          found = list[i];
          break;
        }
      }
      if (!found) {
        ui.toast('活动不存在或已删除');
        wx.navigateBack({ delta: 1 });
        return;
      }
      var form = ensureFormImages(found);
      that.setData({ form: form, activityLoaded: true });
      that.refreshActivityImageUrls();
    }).catch(function (err) {
      ui.toast((err && err.message) || '加载活动失败');
    }).finally(function () {
      that.setData({ loading: false });
    });
  },

  refreshActivityImageUrls: function () {
    var that = this;
    var currentForm = this.data.form || {};
    var expectedImageUrl = trim(currentForm.imageUrl || ((currentForm.images && currentForm.images[0]) || ''));
    var existingPreviewUrls = activityNotice.normalizeImages(currentForm.imageUrls || []).filter(function (url) {
      return activityNotice.isDisplayableImageUrl(url);
    });
    if (!expectedImageUrl) {
      this.setData({ 'form.displayImageUrl': '', 'form.imageUrls': [] });
      return;
    }
    activityNotice.resolveDisplayImageUrl(currentForm).then(function (nextForm) {
      var latestForm = that.data.form || {};
      var latestImageUrl = trim(latestForm.imageUrl || ((latestForm.images && latestForm.images[0]) || ''));
      if (latestImageUrl !== expectedImageUrl) return;
      var imageUrls = nextForm.imageUrls || [];
      var displayImageUrl = nextForm.displayImageUrl || '';
      // 上传后优先保留本地临时图预览，避免 cloud:// 转临时链接失败时预览区变空。
      if ((!imageUrls || !imageUrls.length) && existingPreviewUrls.length) {
        imageUrls = existingPreviewUrls;
        displayImageUrl = existingPreviewUrls[0];
      }
      that.setData({
        'form.displayImageUrl': displayImageUrl,
        'form.imageUrls': imageUrls
      });
    });
  },

  onInput: function (e) {
    var field = e.currentTarget.dataset.field;
    if (!field) return;
    var value = e.detail.value || '';
    var patch = {};
    patch['form.' + field] = value;
    this.setData(patch);
  },

  onChooseImage: function () {
    var that = this;
    if (this.data.uploading) return;

    function handleFile(filePath) {
      if (!filePath) return;
      that.setData({ uploading: true });
      ui.loading('上传图片中');
      var f = that.data.form || {};
      var folder = String(f.id || f._id || f.title || 'new').replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, '_') || 'new';
      var cloudPath = 'activity-images/' + folder + '/' + Date.now() + '_' + Math.floor(Math.random() * 1000000) + getFileExt(filePath);
      wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: filePath,
        success: function (res) {
          var fileID = res.fileID || '';
          that.setData({
            'form.imageUrl': fileID,
            'form.images': fileID ? [fileID] : [],
            'form.displayImageUrl': filePath,
            'form.imageUrls': filePath ? [filePath] : [],
            'form.imagesChanged': true
          });
          ui.toast('图片上传成功');
        },
        fail: function (err) {
          console.error('上传活动图片失败', err);
          ui.toast((err && err.errMsg) || '图片上传失败');
        },
        complete: function () {
          that.setData({ uploading: false });
          ui.hideLoading();
        }
      });
    }

    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed'],
        success: function (res) {
          var item = res && res.tempFiles && res.tempFiles[0] ? res.tempFiles[0] : null;
          handleFile(item && (item.tempFilePath || item.path));
        },
        fail: function (err) {
          var msg = (err && (err.errMsg || err.message)) || '';
          if (msg.indexOf('cancel') < 0) ui.toast('选择图片失败');
        }
      });
      return;
    }

    wx.chooseImage({
      count: 1,
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: function (res) {
        handleFile(res && res.tempFilePaths && res.tempFilePaths[0]);
      },
      fail: function (err) {
        var msg = (err && (err.errMsg || err.message)) || '';
        if (msg.indexOf('cancel') < 0) ui.toast('选择图片失败');
      }
    });
  },

  onPreviewImage: function (e) {
    var current = e.currentTarget.dataset.url || '';
    var urls = (this.data.form && this.data.form.imageUrls) || [];
    if (!current && urls.length) current = urls[0];
    if (!current || !urls.length) return ui.toast('暂无图片可预览');
    wx.previewImage({ current: current, urls: urls });
  },

  onClearImage: function () {
    this.setData({
      'form.imageUrl': '',
      'form.images': [],
      'form.displayImageUrl': '',
      'form.imageUrls': [],
      'form.imagesChanged': true
    });
  },

  onSave: function () {
    var that = this;
    if (this.data.saving) return;
    var form = this.data.form || activityNotice.emptyNotice();
    if (!activityNotice.hasNoticeContent(form)) return ui.toast('请至少填写活动标题、内容、图片或链接中的一项');
    var payload = {
      id: form.id || this.data.id || '',
      title: form.title || '',
      content: form.content || '',
      imageUrl: form.imageUrl || ((form.images && form.images[0]) || ''),
      images: activityNotice.normalizeImages(form.images || (form.imageUrl ? [form.imageUrl] : [])),
      imagesChanged: form.imagesChanged === true,
      linkUrl: form.linkUrl || '',
      linkText: '立即报名'
    };
    this.setData({ saving: true });
    ui.loading('保存中');
    activityNotice.saveNotice(payload).then(function (notice) {
      notice = ensureFormImages(notice);
      that.setData({ id: notice.id || '', form: notice });
      ui.toast('活动已发布');
      setTimeout(function () { wx.navigateBack({ delta: 1 }); }, 350);
    }).catch(function (err) {
      console.error('保存活动失败', err);
      ui.toast((err && err.message) || '保存失败');
    }).finally(function () {
      that.setData({ saving: false });
      ui.hideLoading();
    });
  },

  onDelete: function () {
    var that = this;
    var id = (this.data.form && this.data.form.id) || this.data.id || '';
    if (!id) return ui.toast('缺少活动ID');
    wx.showModal({
      title: '删除活动',
      content: '确认删除该活动？',
      confirmText: '删除',
      confirmColor: '#A73A20',
      success: function (res) {
        if (!res.confirm) return;
        ui.loading('删除中');
        activityNotice.deleteNotice(id).then(function () {
          ui.toast('已删除');
          setTimeout(function () { wx.navigateBack({ delta: 1 }); }, 350);
        }).catch(function (err) {
          ui.toast((err && err.message) || '删除失败');
        }).finally(function () { ui.hideLoading(); });
      }
    });
  }
});
