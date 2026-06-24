var KEY="UI_FONT_SIZE_PX";
function getFontSizePx(){
  try{
    var v=wx.getStorageSync(KEY);
    var n=Number(v);
    return n? n:16;
  }catch(e){
    return 16;
  }
}
function setFontSizePx(px){
  try{
    var n=Number(px);
    wx.setStorageSync(KEY,n);
    return n;
  }catch(e){
    return Number(px)||16;
  }
}
module.exports={ getFontSizePx:getFontSizePx, setFontSizePx:setFontSizePx };
