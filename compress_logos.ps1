Add-Type -AssemblyName System.Drawing

$src = "d:\HUE\DEVELOPED SOFTWARE\Supervisors Automated Assign\public\images\"
$files = Get-ChildItem -Path $src -Filter "*.png"

$outObj = @{}

foreach ($file in $files) {
    $img = [System.Drawing.Image]::FromFile($file.FullName)
    $newWidth = 150
    $newHeight = [int]($img.Height * ($newWidth / $img.Width))
    $bmp = New-Object System.Drawing.Bitmap $newWidth, $newHeight
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    
    # Fill white background
    $g.Clear([System.Drawing.Color]::White)
    
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($img, 0, 0, $newWidth, $newHeight)
    $g.Dispose()

    $ms = New-Object System.IO.MemoryStream
    $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageDecoders() | Where-Object { $_.FormatID -eq [System.Drawing.Imaging.ImageFormat]::Jpeg.Guid }
    $ep = New-Object System.Drawing.Imaging.EncoderParameters 1
    $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality, [long]90)
    
    $bmp.Save($ms, $codec, $ep)
    $bmp.Dispose()
    $img.Dispose()

    $bytes = $ms.ToArray()
    $ms.Dispose()

    $b64 = [Convert]::ToBase64String($bytes)
    $outObj[$file.Name] = "data:image/jpeg;base64,$b64"
}

$outObj | ConvertTo-Json | Out-File "d:\HUE\DEVELOPED SOFTWARE\Supervisors Automated Assign\compressed_logos.json" -Encoding UTF8
