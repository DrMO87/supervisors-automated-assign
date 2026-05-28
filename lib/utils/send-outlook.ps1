param (
    [string]$JsonPath
)

# Set console output encoding to UTF8 to prevent encoding issues with non-ASCII text
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

try {
    if (-not (Test-Path $JsonPath)) {
        throw "JSON configuration file not found at $JsonPath"
    }

    # Read config with UTF8 encoding
    $ConfigJson = Get-Content -Raw -Path $JsonPath -Encoding UTF8
    $Config = ConvertFrom-Json $ConfigJson
    
    # Initialize Outlook COM Application
    $Outlook = New-Object -ComObject Outlook.Application
    $Mail = $Outlook.CreateItem(0)
    
    # Configure Mail Attributes
    $Mail.To = $Config.toEmail
    $Mail.Subject = $Config.subject
    $Mail.HTMLBody = $Config.htmlContent
    
    # Attach PDF if path is specified and exists
    if ($Config.pdfPath -and (Test-Path $Config.pdfPath)) {
        $Mail.Attachments.Add($Config.pdfPath)
    }
    
    # Queue / Send Mail
    $Mail.Send()
    
    # Output SUCCESS indicator so Node.js can confirm completion
    Write-Host "SUCCESS"
} catch {
    Write-Error "Failed to send email via Outlook COM: $_"
    exit 1
}
