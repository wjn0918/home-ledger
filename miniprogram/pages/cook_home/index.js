Page({
  onSwitchAppMode() {
    getApp().switchAppMode()
  },

  onShow() {
    getApp().setAppMode('cook')
  }
})