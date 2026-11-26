$s = New-Object -ComObject Shell.Application
$batchPath = "d:\dominatee new\1111111\scripts\allow_firewall.bat"
$s.ShellExecute("cmd.exe", "/c `"" + $batchPath + "`"", "", "runas", 1)
