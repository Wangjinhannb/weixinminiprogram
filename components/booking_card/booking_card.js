var statusText=require("../../utils/ui").statusText;
Component({
  properties:{ item:{ type:Object, value:{} } },
  methods:{
    emitDetail:function(e){ this.triggerEvent("detail",{id:e.currentTarget.dataset.id}); },
    emitEdit:function(e){ this.triggerEvent("edit",{id:e.currentTarget.dataset.id}); },
    emitCancel:function(e){ this.triggerEvent("cancel",{id:e.currentTarget.dataset.id}); }
  }
});
