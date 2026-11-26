Set oShell = CreateObject("Shell.Application")
oShell.ShellExecute "powershell.exe", "-ExecutionPolicy Bypass -File ""d:\dominatee new\1111111\scripts\fix_network.ps1"" -NoExit", "", "runas", 1
