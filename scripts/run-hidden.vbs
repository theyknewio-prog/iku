' Lance une commande sans fenêtre visible (pour les tâches planifiées).
' Usage: wscript.exe run-hidden.vbs <exe> <args...>
Dim args, i, cmd
Set args = WScript.Arguments
cmd = ""
For i = 0 To args.Count - 1
  cmd = cmd & """" & args(i) & """ "
Next
CreateObject("WScript.Shell").Run cmd, 0, False
