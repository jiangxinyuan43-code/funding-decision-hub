import { createId } from '../../utils/ids'
import type { StoredImage } from '../../types/models'

function readAsDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.readAsDataURL(file)
  })
}

async function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片格式无法解析'))
    image.src = src
  })
}

export async function compressImage(file: File, maxDimension = 1800): Promise<StoredImage> {
  if (!file.type.startsWith('image/')) throw new Error(`${file.name} 不是支持的图片`)
  if (file.size > 20 * 1024 * 1024) throw new Error(`${file.name} 超过 20MB，请先裁剪后上传`)

  const source = await readAsDataUrl(file)
  const image = await loadImage(source)
  const ratio = Math.min(1, maxDimension / Math.max(image.width, image.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * ratio))
  canvas.height = Math.max(1, Math.round(image.height * ratio))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前浏览器无法处理图片')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.84)

  return {
    id: createId('img'),
    name: file.name,
    type: file.type,
    size: file.size,
    original: file,
    compressedDataUrl,
    createdAt: new Date().toISOString(),
  }
}

export async function compressImages(files: File[]) {
  if (files.length > 10) throw new Error('一次最多上传 10 张图片')
  return Promise.all(files.map((file) => compressImage(file)))
}
