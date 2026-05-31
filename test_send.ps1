try {
    $Outlook = New-Object -ComObject Outlook.Application
    $Mail = $Outlook.CreateItem(0)
    $Mail.To = "test@example.com"
    $Mail.Subject = "Test from PowerShell"
    $Mail.HTMLBody = "<h1>Test</h1>"
    $Mail.Send()
    Write-Host "SUCCESS"
} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
}
