function trim(value) {
  return String(value == null ? '' : value).trim();
}

function isCloudFileID(url) {
  return trim(url).indexOf('cloud://') === 0;
}

function isDisplayableImageUrl(url) {
  url = trim(url);
  return !!url && !isCloudFileID(url);
}

function normalizeNoticeItem(raw) {
  raw = raw || {};
  var displayImageUrl = trim(raw.displayImageUrl || raw.tempImageUrl || raw.imageTempUrl || '');
  if (!isDisplayableImageUrl(displayImageUrl)) displayImageUrl = '';
  var imageUrl = trim(raw.imageUrl || '');
  if (!displayImageUrl && isDisplayableImageUrl(imageUrl)) displayImageUrl = imageUrl;
  return {
    id: raw.id || raw._id || '',
    title: raw.title || '',
    content: raw.content || '',
    imageUrl: imageUrl,
    displayImageUrl: displayImageUrl,
    linkUrl: raw.linkUrl || '',
    linkText: raw.linkText || '立即报名',
    hasActivity: raw.hasActivity !== false && !!(raw.title || raw.content || raw.imageUrl || raw.displayImageUrl || raw.linkUrl)
  };
}

function normalizeNoticeList(notice) {
  notice = notice || {};
  var source = [];
  if (Array.isArray(notice)) source = notice;
  else if (Array.isArray(notice.list)) source = notice.list;
  else if (Array.isArray(notice.activities)) source = notice.activities;
  else if (notice.hasActivity) source = [notice];

  var list = [];
  for (var i = 0; i < source.length; i++) {
    var item = normalizeNoticeItem(source[i]);
    if (item.hasActivity) list.push(item);
  }
  return list;
}

Component({
  properties: {
    visible: { type: Boolean, value: false },
    loading: { type: Boolean, value: false },
    notice: {
      type: Object,
      value: {},
      observer: function (value) {
        this.updateDisplayNotices(value);
      }
    }
  },

  data: {
    displayNotices: []
  },

  lifetimes: {
    attached: function () {
      this.updateDisplayNotices(this.data.notice);
    }
  },

  methods: {
    updateDisplayNotices: function (notice) {
      this.setData({ displayNotices: normalizeNoticeList(notice) });
    },
    noop: function () {},
    onClose: function () {
      this.triggerEvent('close');
    },
    onOpenLink: function (e) {
      var index = Number(e.currentTarget.dataset.index || 0);
      var notice = (this.data.displayNotices || [])[index] || {};
      this.triggerEvent('openlink', { id: notice.id || notice._id || '', activityId: notice.id || notice._id || '', linkUrl: notice.linkUrl || '' });
    },
    onPreviewImage: function (e) {
      var url = e.currentTarget.dataset.url || '';
      if (!url) return;
      var notices = this.data.displayNotices || [];
      var urls = [];
      for (var i = 0; i < notices.length; i++) {
        var itemUrl = notices[i].displayImageUrl || '';
        if (itemUrl) urls.push(itemUrl);
      }
      wx.previewImage({ urls: urls.length ? urls : [url], current: url });
    }
  }
});
