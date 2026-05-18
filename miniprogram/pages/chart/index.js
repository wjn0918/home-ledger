const { request } = require('../../utils/request')
const { syncFamilies, switchFamily } = require('../../utils/family')
const app = getApp()

function toDate(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function formatDay(date) {
  return date.toISOString().slice(0, 10)
}

function weekLabel(offset) {
  if (offset === 0) return '本周'
  if (offset === 1) return '上周'
  const d = new Date()
  d.setDate(d.getDate() - offset * 7)
  return `${getWeekNumber(d)}周`
}

function getWeekNumber(date) {
  const firstDay = new Date(date.getFullYear(), 0, 1)
  const diff = Math.floor((toDate(date) - toDate(firstDay)) / 86400000)
  return Math.ceil((diff + firstDay.getDay() + 1) / 7)
}

function buildPeriods(dimension) {
  const now = new Date()
  const periods = []

  if (dimension === 'week') {
    for (let i = 4; i >= 0; i--) {
      const end = new Date(now)
      const day = end.getDay() || 7
      end.setDate(end.getDate() - day + 7 - i * 7)
      const start = new Date(end)
      start.setDate(end.getDate() - 6)
      periods.push({ key: `w-${i}`, label: weekLabel(i), start: formatDay(start), end: formatDay(end) })
    }
  } else if (dimension === 'month') {
    for (let i = 4; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
      periods.push({ key: `m-${i}`, label: `${start.getMonth() + 1}月`, start: formatDay(start), end: formatDay(end) })
    }
  } else {
    for (let i = 4; i >= 0; i--) {
      const y = now.getFullYear() - i
      periods.push({ key: `y-${i}`, label: `${y}年`, start: `${y}-01-01`, end: `${y}-12-31` })
    }
  }
  return periods
}

function filterBillsByPeriod(bills, period) {
  return bills.filter((bill) => {
    const day = formatDay(new Date(bill.bill_date))
    return day >= period.start && day <= period.end
  })
}

Page({
  data: {
    families: [], familyIndex: 0, currentFamilyName: '',
    bills: [],
    dimensionOptions: ['周', '月', '年'],
    dimensionIndex: 0,
    periodOptions: [],
    periodIndex: 4,
    totalExpense: '0.00',
    trendPoints: [],
    ranking: []
  },

  async onShow() {
    if (!app.requireLogin()) return
    await this.loadFamiliesAndChart()
  },

  async loadFamiliesAndChart() {
    try {
      const data = await syncFamilies(app)
      const familyIndex = data.families.findIndex((f) => f.id === data.selectedFamilyId)
      this.setData({
        families: data.families,
        familyIndex: familyIndex >= 0 ? familyIndex : 0,
        currentFamilyName: data.selectedFamilyName
      })
      if (!data.selectedFamilyId) return
      await this.reloadBillsAndMetrics(data.selectedFamilyId)
    } catch (e) {
      wx.showToast({ title: '加载图表失败', icon: 'none' })
    }
  },

  async reloadBillsAndMetrics(familyId) {
    const bills = await request(`/bills?family_id=${familyId}`)
    this.setData({ bills })
    this.buildPeriodsAndStats()
  },

  buildPeriodsAndStats() {
    const dimMap = ['week', 'month', 'year']
    const dimension = dimMap[this.data.dimensionIndex]
    const periodOptions = buildPeriods(dimension)
    const periodIndex = Math.min(this.data.periodIndex, periodOptions.length - 1)
    this.setData({ periodOptions, periodIndex })
    this.calcStats()
  },

  calcStats() {
    const period = this.data.periodOptions[this.data.periodIndex]
    if (!period) return
    const list = filterBillsByPeriod(this.data.bills, period).filter((b) => b.type === 'expense')
    const total = list.reduce((sum, b) => sum + Number(b.amount || 0), 0)

    const byDay = {}
    list.forEach((b) => {
      const day = formatDay(new Date(b.bill_date))
      byDay[day] = (byDay[day] || 0) + Number(b.amount || 0)
    })
    const trendPoints = Object.keys(byDay).sort().map((d) => `${d}: ¥${byDay[d].toFixed(2)}`)

    const byCategory = {}
    list.forEach((b) => {
      byCategory[b.category] = (byCategory[b.category] || 0) + Number(b.amount || 0)
    })
    const ranking = Object.keys(byCategory)
      .map((c) => ({ category: c, amount: byCategory[c].toFixed(2) }))
      .sort((a, b) => Number(b.amount) - Number(a.amount))

    this.setData({ totalExpense: total.toFixed(2), trendPoints, ranking })
  },

  onDimensionChange(e) {
    this.setData({ dimensionIndex: Number(e.detail.value), periodIndex: 4 })
    this.buildPeriodsAndStats()
  },

  onPeriodChange(e) {
    this.setData({ periodIndex: Number(e.detail.value) })
    this.calcStats()
  },

  async onFamilyChange(e) {
    const index = Number(e.detail.value)
    const target = switchFamily(app, this.data.families, index)
    if (!target) return
    this.setData({ familyIndex: index, currentFamilyName: target.name })
    await this.reloadBillsAndMetrics(target.id)
  }
})
