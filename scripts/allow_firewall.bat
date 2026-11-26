@echo off
title DOMIOS Network Setup
:: Auto-request Administrator elevation if not already running as admin
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting Administrator privileges...
    powershell -Command "Start-Process cmd.exe -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

echo ========================================================
echo Configuring DOMIOS Network Access for Other Devices
echo ========================================================
echo.

echo [1/3] Switching Wi-Fi Network to Private (enables LAN device discovery)...
powershell -NoProfile -Command "Get-NetConnectionProfile | Where-Object { $_.InterfaceAlias -eq 'Wi-Fi' } | Set-NetConnectionProfile -NetworkCategory Private" 2>nul
echo Done.
echo.

echo [2/3] Opening Ports (5173, 5174, 4000, 1984, 80, 8554, 8555)...
netsh advfirewall firewall add rule name="DOMIOS Inbound" dir=in action=allow protocol=TCP localport=5173,5174,4000,1984,80,8554,8555 profile=any >nul
echo Done.
echo.

echo [3/3] Authorizing Node.js and ICMP Ping...
netsh advfirewall firewall add rule name="DOMIOS Node App" dir=in action=allow program="C:\Program Files\nodejs\node.exe" profile=any >nul
netsh advfirewall firewall add rule name="DOMIOS Ping ICMP" dir=in action=allow protocol=icmpv4:8,any profile=any >nul
echo Done.
echo.

echo ========================================================
echo [SUCCESS] Network and Firewall configured!
echo.
echo Open on your other device (phone / tablet):
echo    http://192.168.0.88:5173/
echo    https://192.168.0.88:5174/
echo ========================================================
echo.
pause
