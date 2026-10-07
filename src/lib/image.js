// Compress image in the browser to save free storage + bandwidth
export async function compressImage(file, maxWidth = 1080, quality = 0.7) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxWidth / bitmap.width)
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0, width, height)

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/webp', quality)
  )

  return new File([blob], file.name.replace(/\.\w+$/, '.webp'), {
    type: 'image/webp',
  })
}
