@echo off
echo Adding DOMIOS firewall rules...

netsh advfirewall firewall delete rule name="DOMIOS-5173" >nul 2>&1
netsh advfirewall firewall delete rule name="DOMIOS-4000" >nul 2>&1
netsh advfirewall firewall delete rule name="DOMIOS-5174" >nul 2>&1
netsh advfirewall firewall delete rule name="DOMIOS-1984" >nul 2>&1
netsh advfirewall firewall delete rule name="DOMIOS Inbound" >nul 2>&1

netsh advfirewall firewall add rule name="DOMIOS-5173" dir=in action=allow protocol=TCP localport=5173 profile=any
netsh advfirewall firewall add rule name="DOMIOS-4000" dir=in action=allow protocol=TCP localport=4000 profile=any
netsh advfirewall firewall add rule name="DOMIOS-5174" dir=in action=allow protocol=TCP localport=5174 profile=any
netsh advfirewall firewall add rule name="DOMIOS-1984" dir=in action=allow protocol=TCP localport=1984 profile=any

echo.
echo Done! Rules added:
netsh advfirewall firewall show rule name="DOMIOS-5173" | findstr "Rule Name\|Enabled\|Action\|Profiles\|LocalPort"
echo.
pause
