import { encyclopediaItems } from '../mock/encyclopedia'

describe('encyclopedia dataset scale and quality', () => {
  test('contains at least 50 insects and 50 diseases with key professional fields', () => {
    const insects = encyclopediaItems.filter((item) => item.type === 'insect')
    const diseases = encyclopediaItems.filter((item) => item.type === 'disease')

    expect(insects.length).toBeGreaterThanOrEqual(50)
    expect(diseases.length).toBeGreaterThanOrEqual(50)

    for (const item of encyclopediaItems) {
      expect(item.name.trim().length).toBeGreaterThan(0)
      expect(item.scientificName.trim().length).toBeGreaterThan(0)
      expect(item.genus.trim().length).toBeGreaterThan(0)
      expect(item.categoryCode.trim().length).toBeGreaterThan(0)
      expect(item.category.trim().length).toBeGreaterThan(0)
      expect(item.host.trim().length).toBeGreaterThan(0)
      expect(item.season.trim().length).toBeGreaterThan(0)
      expect(item.summary.trim().length).toBeGreaterThan(0)
      expect(item.morphology.trim().length).toBeGreaterThan(0)
      expect(item.symptoms.trim().length).toBeGreaterThan(0)
      expect(item.controlTips.length).toBeGreaterThanOrEqual(3)
      expect(item.placementTips.length).toBeGreaterThanOrEqual(3)
      expect(item.references.length).toBeGreaterThanOrEqual(1)
      expect(item.image.trim().length).toBeGreaterThan(0)
    }
  })

  test('does not include beneficial category and random placeholder image source', () => {
    const hasBeneficialCategory = encyclopediaItems.some((item) => item.category === '天敌益虫' || item.categoryCode === 'beneficial')
    const hasRandomPlaceholderImage = encyclopediaItems.some((item) => item.image.includes('loremflickr.com'))

    expect(hasBeneficialCategory).toBe(false)
    expect(hasRandomPlaceholderImage).toBe(false)
  })
})