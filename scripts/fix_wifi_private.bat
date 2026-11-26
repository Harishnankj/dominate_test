@echo off
echo Fixing network profile to Private...
echo.

REM List all network profiles
for /f "tokens=*" %%k in ('reg query "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\NetworkList\Profiles" /f "DOMINATEE" /s /d 2^>nul') do (
    echo Found: %%k
)

REM Set all Wi-Fi profiles to Private (Category=1)
for /f "tokens=*" %%k in ('reg query "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\NetworkList\Profiles" 2^>nul') do (
    for /f "tokens=2*" %%a in ('reg query "%%k" /v "ProfileName" 2^>nul') do (
        echo Profile: %%b
    )
    reg add "%%k" /v "Category" /t REG_DWORD /d 1 /f >nul 2>&1
    echo Set %%k to Private
)

echo.
echo Done! All profiles set to Private.
pause
