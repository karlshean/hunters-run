# PowerShell script to create a simple test image
Add-Type -AssemblyName System.Drawing

# Create a simple 100x100 test image
$bitmap = New-Object System.Drawing.Bitmap(100, 100)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)

# Fill with blue background
$graphics.Clear([System.Drawing.Color]::Blue)

# Draw text
$font = New-Object System.Drawing.Font("Arial", 12)
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$graphics.DrawString("TEST", $font, $brush, 25, 40)

# Save as JPEG
$bitmap.Save("$PSScriptRoot\test.jpg", [System.Drawing.Imaging.ImageFormat]::Jpeg)

# Cleanup
$graphics.Dispose()
$bitmap.Dispose()

Write-Host "Test image created: test.jpg"