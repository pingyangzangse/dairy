// 上传前压缩图片：手机照片常达 5-10MB，压缩到长边 1600px / JPEG 0.82，通常 < 500KB
export async function compressImage(file, maxEdge = 1600, quality = 0.82) {
  if (!file || !file.type || !file.type.startsWith('image/')) return file
  // 小图不压
  if (file.size < 600 * 1024) return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], (file.name || 'image').replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return file // 压缩失败就用原图，后端还能扛 10MB
  }
}
