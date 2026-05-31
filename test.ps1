try {
    $Outlook = New-Object -ComObject Outlook.Application
    Write-Host "SUCCESS"
} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
}
