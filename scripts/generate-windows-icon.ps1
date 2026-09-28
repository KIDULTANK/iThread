Add-Type -AssemblyName System.Drawing

$size = 512
$outputDir = Join-Path $PSScriptRoot "..\build"
$outputPath = Join-Path $outputDir "icon.png"
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$bitmap = New-Object System.Drawing.Bitmap($size, $size)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::Transparent)

$background = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#26215c"))
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$radius = 96
$diameter = $radius * 2
$path.AddArc(0, 0, $diameter, $diameter, 180, 90)
$path.AddArc($size - $diameter, 0, $diameter, $diameter, 270, 90)
$path.AddArc($size - $diameter, $size - $diameter, $diameter, $diameter, 0, 90)
$path.AddArc(0, $size - $diameter, $diameter, $diameter, 90, 90)
$path.CloseFigure()
$graphics.FillPath($background, $path)

$linePen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml("#cecbf6"), 14)
$linePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$linePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$branches = @(
  @(256, 256, 196, 212, 168, 184, 132, 156),
  @(256, 256, 196, 300, 168, 328, 132, 356),
  @(256, 256, 316, 212, 344, 184, 380, 156),
  @(256, 256, 316, 300, 344, 328, 380, 356)
)
foreach ($branch in $branches) {
  $curve = New-Object System.Drawing.Drawing2D.GraphicsPath
  $curve.AddBezier($branch[0], $branch[1], $branch[2], $branch[3], $branch[4], $branch[5], $branch[6], $branch[7])
  $graphics.DrawPath($linePen, $curve)
  $curve.Dispose()
}

$nodeBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#7f77dd"))
foreach ($point in @(@(132, 156), @(132, 356), @(380, 156), @(380, 356))) {
  $graphics.FillEllipse($nodeBrush, $point[0] - 30, $point[1] - 30, 60, 60)
}
$centerBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$graphics.FillEllipse($centerBrush, 208, 208, 96, 96)

$bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

$centerBrush.Dispose()
$nodeBrush.Dispose()
$linePen.Dispose()
$path.Dispose()
$background.Dispose()
$graphics.Dispose()
$bitmap.Dispose()

Write-Output $outputPath
