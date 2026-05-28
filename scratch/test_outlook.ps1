# test_outlook.ps1
try {
    Write-Host "Creating Outlook COM object..."
    $Outlook = New-Object -ComObject Outlook.Application
    
    Write-Host "Creating Mail item..."
    $Mail = $Outlook.CreateItem(0)
    
    # Send a test email to the user's address
    $Mail.To = "melkhodary@horus.edu.eg"
    $Mail.Subject = "Outlook Automation Test - ESMS"
    $Mail.HTMLBody = "<h2>Outlook COM Integration Work</h2><p>This is a test email sent from the local Outlook application via ESMS.</p>"
    
    Write-Host "Sending mail..."
    $Mail.Send()
    
    Write-Host "SUCCESS: Email queued in Outlook!"
} catch {
    Write-Error "Failed to send email via Outlook: $_"
}
