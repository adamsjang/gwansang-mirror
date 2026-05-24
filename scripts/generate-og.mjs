import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import sharp from 'sharp'

const svgPath = resolve('public/og.svg')
const pngPath = resolve('public/og.png')

const svg = readFileSync(svgPath)
const png = await sharp(svg, { density: 150 }).png().toBuffer()
writeFileSync(pngPath, png)
console.log(`og.png written (${png.length} bytes)`)
