tell application "System Events"
 tell process "Google Chrome"
  set frontmost to true
  perform action "AXRaise" of (first window whose name contains "日语听力工作室")
  set elementsList to entire contents of (first window whose name contains "日语听力工作室")
  repeat with uiItem in elementsList
   try
    if role of uiItem is "AXPopUpButton" and description of uiItem contains "日语实时字幕" then
     click uiItem
     return "Opened demo popup"
    end if
   end try
  end repeat
 end tell
end tell
