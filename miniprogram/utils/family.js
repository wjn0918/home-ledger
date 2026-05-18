const { request } = require('./request')

async function syncFamilies(app) {
  const families = await request('/families/mine')
  const currentFamilyId = app.globalData.familyId
  const matched = families.find((f) => f.id === currentFamilyId)
  const selected = matched || families[0] || null

  app.globalData.families = families
  app.globalData.familyId = selected ? selected.id : null

  if (selected) {
    wx.setStorageSync('familyId', selected.id)
  } else {
    wx.removeStorageSync('familyId')
  }

  return {
    families,
    selectedFamilyId: app.globalData.familyId,
    selectedFamilyName: selected ? selected.name : ''
  }
}

function switchFamily(app, families, index) {
  const target = families[index]
  if (!target) return null
  app.globalData.familyId = target.id
  wx.setStorageSync('familyId', target.id)
  return target
}

module.exports = {
  syncFamilies,
  switchFamily
}
