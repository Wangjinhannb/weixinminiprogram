function toast(msg){ wx.showToast({title:msg||"提示",icon:"none"}); }
function loading(msg){ wx.showLoading({title:msg||"加载中",mask:true}); }
function hideLoading(){ wx.hideLoading(); }
function statusText(s){
  if(s==='pending') return '待确认';
  if(s==='approved') return '已通过';
  if(s==='rejected') return '已拒绝';
  if(s==='cancelled') return '已取消';
  if(s==='active') return '已预约';
  if(s==='rescheduled') return '已改期';
  return s||'-';
}
module.exports={toast:toast,loading:loading,hideLoading:hideLoading,statusText:statusText};
