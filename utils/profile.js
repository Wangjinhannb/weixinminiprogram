var DEFAULT_AVATAR_URL = '/assets/images/default-avatar.jpg';

function getDefaultAvatarUrl() {
  return DEFAULT_AVATAR_URL;
}

function getDisplayAvatarUrl(user) {
  user = user || {};
  return user.isWechatBound ? DEFAULT_AVATAR_URL : '';
}

module.exports = {
  DEFAULT_AVATAR_URL: DEFAULT_AVATAR_URL,
  getDefaultAvatarUrl: getDefaultAvatarUrl,
  getDisplayAvatarUrl: getDisplayAvatarUrl
};
