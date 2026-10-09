Add-Type -AssemblyName System.Drawing
$projectRoot = Join-Path $PSScriptRoot ".."
$buildDir = Join-Path $projectRoot "build"
$publicDir = Join-Path $projectRoot "public"
$sourcePath = Join-Path $buildDir "icon-master.png"
if (!(Test-Path -LiteralPath $sourcePath)) { throw "Missing icon-master.png" }
$source = [System.Drawing.Image]::FromFile($sourcePath)
function New-IconPng([int]$size, [string]$path) {
  $bitmap = New-Object System.Drawing.Bitmap($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.DrawImage($source, 0, 0, $size, $size)
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}
New-IconPng 512 (Join-Path $buildDir "icon.png")
New-IconPng 512 (Join-Path $publicDir "icon-512.png")
New-IconPng 192 (Join-Path $publicDir "icon-192.png")
New-IconPng 180 (Join-Path $publicDir "apple-touch-icon.png")
# Keep the textured brushwork in the SVG-compatible favicon without tracing it.
$encoded = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes((Join-Path $publicDir "icon-512.png")))
$svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="iThread"><image width="512" height="512" href="data:image/png;base64,' + $encoded + '"/></svg>'
[System.IO.File]::WriteAllText((Join-Path $publicDir "icon.svg"), $svg, [System.Text.UTF8Encoding]::new($false))
# PNG-compressed ICO frames retain detail at each Windows display scale.
$sizes = @(16, 24, 32, 48, 64, 128, 256)
$frames = @()
foreach ($size in $sizes) {
  $bitmap = New-Object System.Drawing.Bitmap($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.DrawImage($source, 0, 0, $size, $size)
  $stream = New-Object System.IO.MemoryStream
  $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
  $frames += ,$stream.ToArray()
  $stream.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}
$file = [System.IO.File]::Create((Join-Path $buildDir "icon.ico"))
$writer = New-Object System.IO.BinaryWriter($file)
$writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
for ($i=0; $i -lt $sizes.Count; $i++) {
  $dimension = $sizes[$i] % 256
  $writer.Write([byte]$dimension); $writer.Write([byte]$dimension)
  $writer.Write([byte]0); $writer.Write([byte]0)
  $writer.Write([uint16]1); $writer.Write([uint16]32)
  $writer.Write([uint32]$frames[$i].Length); $writer.Write([uint32]$offset)
  $offset += $frames[$i].Length
}
foreach ($frame in $frames) { $writer.Write([byte[]]$frame) }
$writer.Dispose(); $source.Dispose()
Write-Output "Updated iThread calligraphic icons (PNG, SVG and multi-resolution ICO)."
