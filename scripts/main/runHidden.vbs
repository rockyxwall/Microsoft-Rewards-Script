Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
projectRoot = fso.GetParentFolderName(fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName)))
shell.CurrentDirectory = projectRoot
exitCode = shell.Run("""node.exe"" """ & projectRoot & "\scripts\main\runTask.js""", 0, True)
WScript.Quit exitCode
