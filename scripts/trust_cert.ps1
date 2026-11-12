$cert = (Get-AuthenticodeSignature "bin\go2rtc.exe").SignerCertificate

if ($cert) {
    $rootStore = Get-Item "Cert:\CurrentUser\Root"
    $rootStore.Open("ReadWrite")
    $rootStore.Add($cert)
    $rootStore.Close()

    $pubStore = Get-Item "Cert:\CurrentUser\TrustedPublisher"
    $pubStore.Open("ReadWrite")
    $pubStore.Add($cert)
    $pubStore.Close()

    Write-Host "Certificate added to CurrentUser Root and TrustedPublisher stores"
}

Get-AuthenticodeSignature "bin\go2rtc.exe"

