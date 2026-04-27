$ErrorActionPreference = 'SilentlyContinue'
$base = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\microphone"
$inUse = Get-ChildItem $base -Recurse |
    Get-ItemProperty |
    Where-Object { $_.LastUsedTimeStart -and $_.LastUsedTimeStop -eq 0 } |
    Select-Object -First 1
if ($inUse) { Write-Output "active" } else { Write-Output "inactive" }
