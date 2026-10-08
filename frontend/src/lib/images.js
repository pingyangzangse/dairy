// 后端 images 是 JSON 列：mysql2 返回已解析数组；兼容字符串/空值，统一输出数组
export function parseImages(images) {
  if (!images) return []
  if (Array.isArray(images)) return images.filter(u => typeof u === 'string' && u)
  if (typeof images === 'string') {
    try {
      const parsed = JSON.parse(images)
      return Array.isArray(parsed) ? parsed.filter(u => typeof u === 'string' && u) : []
    } catch {
      return []
    }
  }
  return []
}
