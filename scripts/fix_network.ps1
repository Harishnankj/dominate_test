$regPath = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\NetworkList\Profiles"
$profiles = Get-ChildItem $regPath
foreach ($profile in $profiles) {
    $props = Get-ItemProperty $profile.PSPath
    Write-Host ("ProfileName: " + $props.ProfileName + " | Category: " + $props.Category)
    if ($props.ProfileName -like "*DOMINATEE*" -or $props.ProfileName -like "*domina*" -or $props.ProfileName -like "*OUTDOOR*") {
        Write-Host ">> Found target profile! Changing to Private (1)..."
        Set-ItemProperty -Path $profile.PSPath -Name "Category" -Value 1
        Write-Host ">> Done! Category set to 1 (Private)"
    }
}
Write-Host "--- All done ---"
