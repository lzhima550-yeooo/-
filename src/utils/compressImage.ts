export async function compressImageFile(file: File, maxWidth = 1600, quality = 0.82): Promise<File> {
  if (!file.type.startsWith('image/')) {
    return file
  }

  if (typeof createImageBitmap !== 'function') {
    return file
  }

  try {
    const bitmap = await createImageBitmap(file)
    const ratio = Math.min(1, maxWidth / bitmap.width)
    const targetWidth = Math.max(1, Math.round(bitmap.width * ratio))
    const targetHeight = Math.max(1, Math.round(bitmap.height * ratio))

    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return file
    }

    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight)
    if (typeof bitmap.close === 'function') {
      bitmap.close()
    }

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', quality)
    })

    if (!blob) {
      return file
    }

    return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })
  } catch {
    return file
  }
}
